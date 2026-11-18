"""
OmniVoice Studio - Local Desktop GUI Bridge
Spawns a local lightweight FastAPI daemon and opens pywebview (Edge WebView2)
Features:
- Instant 0ms local auditioning of all 108 voice samples from presets/audio/
- Relays synthesis requests to your remote Modal Cloud T4 GPU endpoint
- Automatically downloads and saves all 3 files (speech.mp3, speech.srt, speech.json) into local output/<folder>/
- Direct "Open in Explorer" button to reveal generated files in Windows Explorer
"""

import os
import sys
import json
import base64
import time
import urllib.request
import webbrowser
import concurrent.futures
from pathlib import Path
from typing import Optional, Dict, Any

import uvicorn
from starlette.concurrency import run_in_threadpool
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

BASE_DIR = Path(__file__).resolve().parent
MODAL_GUI_DIR = BASE_DIR / "modal_gui"
PRESETS_DIR = BASE_DIR / "presets"
PRESETS_AUDIO_DIR = PRESETS_DIR / "audio"
OUTPUT_DIR = BASE_DIR / "output"

OUTPUT_DIR.mkdir(exist_ok=True)
PRESETS_AUDIO_DIR.mkdir(exist_ok=True)

gui_app = FastAPI(title="OmniVoice Studio Desktop Gateway")

gui_app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@gui_app.get("/api/presets")
async def get_presets():
    presets_file = PRESETS_DIR / "presets.json"
    if presets_file.exists():
        try:
            with open(presets_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                return {"presets": data, "total": len(data)}
        except Exception as e:
            return {"presets": [], "error": str(e)}
    return {"presets": [], "total": 0}


@gui_app.get("/presets/audio/{filename}")
async def serve_preset_audio(filename: str):
    file_path = PRESETS_AUDIO_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Audio file not found")
    media = "audio/wav" if filename.endswith(".wav") else "audio/mpeg"
    return FileResponse(path=file_path, media_type=media)


@gui_app.get("/presets/avatars/{filename}")
async def serve_preset_avatar(filename: str):
    file_path = PRESETS_DIR / "avatars" / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Avatar not found")
    return FileResponse(path=file_path, media_type="image/svg+xml")


class SaveFilesRequest(BaseModel):
    folder: str
    mp3_b64: Optional[str] = None
    srt_content: Optional[str] = None
    json_content: Optional[Any] = None
    words: Optional[list] = None
    script_text: Optional[str] = None


class ModalConvertRequest(BaseModel):
    modalUrl: Optional[str] = None
    text: str
    presetId: Optional[str] = None
    voiceId: Optional[str] = None
    instruct: Optional[str] = None
    language: Optional[str] = "en"
    speed: Optional[float] = 1.0
    ref_audio_b64: Optional[str] = None
    ref_text: Optional[str] = None
    script_name: Optional[str] = None


class ScriptItem(BaseModel):
    name: Optional[str] = None
    text: str


class ModalScriptConvertRequest(BaseModel):
    name: Optional[str] = "script"
    text: str
    presetId: Optional[str] = "narrator-deep-en"
    voiceId: Optional[str] = None
    speed: Optional[float] = 1.0
    language: Optional[str] = "en"
    instruct: Optional[str] = None
    ref_audio_b64: Optional[str] = None
    ref_text: Optional[str] = None


class ModalBulkConvertRequest(BaseModel):
    modalUrl: Optional[str] = None
    scripts: list[ScriptItem]
    presetId: Optional[str] = None
    voiceId: Optional[str] = None
    instruct: Optional[str] = None
    language: Optional[str] = "en"
    speed: Optional[float] = 1.0
    ref_audio_b64: Optional[str] = None
    ref_text: Optional[str] = None
    concurrency: Optional[int] = 3


@gui_app.post("/api/modal/convert")
async def modal_convert_bridge(req: ModalConvertRequest):
    """
    Desktop GUI Bridge to Modal Cloud GPU:
    Executes synthesis via Modal's Python SDK with up to 900s timeout,
    bypassing all browser 150s HTTP timeouts, and automatically saving
    speech.mp3, speech.srt, and speech.json directly into local output/<folder>/.
    """
    clean_text = req.text.strip()
    if not clean_text:
        raise HTTPException(status_code=400, detail="Text cannot be empty.")

    voice_id = req.presetId or req.voiceId or "narrator-deep-en"
    speed = float(req.speed or 1.0)
    language = req.language or "en"

    # Strategy 1: Modal Python SDK direct remote call (Highest reliability, 900s timeout)
    try:
        import modal
        print(f"[Desktop Bridge] Calling Modal T4 GPU function 'synthesize_script_file' for voice '{voice_id}'...")
        fn = modal.Function.from_name("omnivoice-studio", "synthesize_script_file")
        result = fn.remote(
            script_text=clean_text,
            voice_id=voice_id,
            speed=speed,
            language=language,
            instruct=req.instruct,
            ref_audio_b64=req.ref_audio_b64,
            ref_text=req.ref_text,
        )

        folder = result.get("folder", f"speech_{int(time.time())}")
        folder_path = OUTPUT_DIR / folder
        folder_path.mkdir(parents=True, exist_ok=True)

        if result.get("mp3_b64"):
            b64 = result["mp3_b64"]
            if "," in b64:
                b64 = b64.split(",", 1)[1]
            (folder_path / "speech.mp3").write_bytes(base64.b64decode(b64))

        if result.get("srt_content"):
            (folder_path / "speech.srt").write_text(result["srt_content"], encoding="utf-8")

        if result.get("json_content"):
            raw = result["json_content"]
            if isinstance(raw, str):
                (folder_path / "speech.json").write_text(raw, encoding="utf-8")
            else:
                (folder_path / "speech.json").write_text(json.dumps(raw, indent=2), encoding="utf-8")

        (folder_path / "script.txt").write_text(clean_text, encoding="utf-8")
        print(f"[Desktop Bridge] Successfully saved all 4 files (mp3, srt, json, script.txt) to: {folder_path}")
        return result
    except Exception as sdk_err:
        print(f"[Desktop Bridge] Modal SDK direct execution note: {sdk_err}. Trying HTTP fallback...")

    # Strategy 2: HTTP Fallback to Modal URL
    if not req.modalUrl:
        raise HTTPException(status_code=500, detail="Modal Python SDK failed and no Modal URL provided.")

    modal_base = req.modalUrl.strip().rstrip("/")
    if not modal_base.endswith(".run") and ".modal" in modal_base:
        modal_base += ".run"

    import urllib.request
    payload_bytes = json.dumps({
        "text": clean_text,
        "presetId": voice_id,
        "speed": speed,
        "language": language,
        "instruct": req.instruct,
        "ref_audio_b64": req.ref_audio_b64,
        "ref_text": req.ref_text,
    }).encode("utf-8")

    # Try generate_async first
    try:
        req_obj = urllib.request.Request(
            f"{modal_base}/api/tts/generate_async",
            data=payload_bytes,
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req_obj, timeout=30) as resp:
            spawn_res = json.loads(resp.read().decode("utf-8"))
            if spawn_res.get("status") == "processing" and spawn_res.get("job_id"):
                job_id = spawn_res["job_id"]
                # Poll until complete
                for _ in range(600):
                    time.sleep(2)
                    status_url = f"{modal_base}/api/tts/status/{job_id}"
                    with urllib.request.urlopen(status_url, timeout=15) as s_resp:
                        s_data = json.loads(s_resp.read().decode("utf-8"))
                        if s_data.get("status") == "completed":
                            result = s_data.get("result", {})
                            folder = result.get("folder", f"speech_{int(time.time())}")
                            folder_path = OUTPUT_DIR / folder
                            folder_path.mkdir(parents=True, exist_ok=True)
                            if result.get("mp3_b64"):
                                b64 = result["mp3_b64"]
                                if "," in b64:
                                    b64 = b64.split(",", 1)[1]
                                (folder_path / "speech.mp3").write_bytes(base64.b64decode(b64))
                            if result.get("srt_content"):
                                (folder_path / "speech.srt").write_text(result["srt_content"], encoding="utf-8")
                            if result.get("json_content"):
                                raw = result["json_content"]
                                if isinstance(raw, str):
                                    (folder_path / "speech.json").write_text(raw, encoding="utf-8")
                                else:
                                    (folder_path / "speech.json").write_text(json.dumps(raw, indent=2), encoding="utf-8")
                            (folder_path / "script.txt").write_text(clean_text, encoding="utf-8")
                            return result
                        elif s_data.get("status") == "failed":
                            raise HTTPException(status_code=500, detail=s_data.get("error", "Modal job failed"))
    except Exception as async_err:
        print(f"[Desktop Bridge] Async HTTP note: {async_err}")

    # Fallback to direct synchronous HTTP
    req_obj = urllib.request.Request(
        f"{modal_base}/api/tts/generate",
        data=payload_bytes,
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req_obj, timeout=600) as resp:
        result = json.loads(resp.read().decode("utf-8"))
        folder = result.get("folder", f"speech_{int(time.time())}")
        folder_path = OUTPUT_DIR / folder
        folder_path.mkdir(parents=True, exist_ok=True)
        if result.get("mp3_b64"):
            b64 = result["mp3_b64"]
            if "," in b64:
                b64 = b64.split(",", 1)[1]
            (folder_path / "speech.mp3").write_bytes(base64.b64decode(b64))
        if result.get("srt_content"):
            (folder_path / "speech.srt").write_text(result["srt_content"], encoding="utf-8")
        if result.get("json_content"):
            raw = result["json_content"]
            if isinstance(raw, str):
                (folder_path / "speech.json").write_text(raw, encoding="utf-8")
            else:
                (folder_path / "speech.json").write_text(json.dumps(raw, indent=2), encoding="utf-8")
        (folder_path / "script.txt").write_text(clean_text, encoding="utf-8")
        return result


def save_modal_result_locally(result: dict, script_text: str, script_name: str) -> dict:
    """Helper to immediately write all 4 files (mp3, srt, json, txt) to local output/<folder>/."""
    folder = result.get("folder") or script_name or f"speech_{int(time.time())}"
    folder_path = OUTPUT_DIR / folder
    folder_path.mkdir(parents=True, exist_ok=True)

    if result.get("mp3_b64"):
        b64 = result["mp3_b64"]
        if "," in b64:
            b64 = b64.split(",", 1)[1]
        (folder_path / "speech.mp3").write_bytes(base64.b64decode(b64))

    if result.get("srt_content"):
        (folder_path / "speech.srt").write_text(result["srt_content"], encoding="utf-8")

    if result.get("json_content"):
        raw = result["json_content"]
        if isinstance(raw, str):
            (folder_path / "speech.json").write_text(raw, encoding="utf-8")
        else:
            (folder_path / "speech.json").write_text(json.dumps(raw, indent=2), encoding="utf-8")

    (folder_path / "script.txt").write_text(script_text, encoding="utf-8")

    result["local_folder"] = str(folder_path)
    result["name"] = script_name
    print(f"[Desktop Bridge] Saved all 4 files for '{script_name}' to: {folder_path}")
    return result


@gui_app.post("/api/modal/convert_script")
async def modal_convert_single_script(req: ModalScriptConvertRequest):
    """
    Dedicated real-time per-script endpoint for bulk processing.
    Executes Modal Cloud GPU synthesis for one script,
    immediately saves all 4 files locally to output/<folder>/,
    and returns full result to the GUI in real-time.
    """
    clean_text = req.text.strip()
    if not clean_text:
        raise HTTPException(status_code=400, detail="Script text cannot be empty.")

    script_name = req.name or "script"
    voice_id = req.presetId or req.voiceId or "narrator-deep-en"
    speed = float(req.speed or 1.0)
    language = req.language or "en"

    import modal
    fn_single = modal.Function.from_name("omnivoice-studio", "synthesize_script_file")

    def run_remote():
        return fn_single.remote(
            script_text=clean_text,
            voice_id=voice_id,
            speed=speed,
            language=language,
            instruct=req.instruct,
            ref_audio_b64=req.ref_audio_b64,
            ref_text=req.ref_text,
            script_name=script_name,
        )

    res = await run_in_threadpool(run_remote)
    saved = save_modal_result_locally(res, clean_text, script_name)
    return saved


@gui_app.post("/api/modal/convert_bulk")
async def modal_convert_bulk(req: ModalBulkConvertRequest):
    """
    Desktop GUI Bulk Bridge to Modal Cloud GPU:
    Processes multiple scripts in bulk.
    Executes first script to warm up and verify files, then dispatches remaining scripts simultaneously.
    Saves speech.mp3, speech.srt, speech.json, and script.txt immediately as each completes.
    """
    if not req.scripts:
        raise HTTPException(status_code=400, detail="No scripts provided for bulk processing.")

    valid_scripts = [s for s in req.scripts if s.text.strip()]
    if not valid_scripts:
        raise HTTPException(status_code=400, detail="All scripts were empty.")

    voice_id = req.presetId or req.voiceId or "narrator-deep-en"
    speed = float(req.speed or 1.0)
    language = req.language or "en"
    concurrency = max(1, req.concurrency or 3)

    import modal
    fn_single = modal.Function.from_name("omnivoice-studio", "synthesize_script_file")

    def process_one(s_item):
        s_name = s_item.name or "script"
        s_text = s_item.text.strip()
        res = fn_single.remote(
            script_text=s_text,
            voice_id=voice_id,
            speed=speed,
            language=language,
            instruct=req.instruct,
            ref_audio_b64=req.ref_audio_b64,
            ref_text=req.ref_text,
            script_name=s_name,
        )
        return save_modal_result_locally(res, s_text, s_name)

    saved_results = []

    # 1. First script: execute first to warm up container and verify files
    first_s = valid_scripts[0]
    print(f"\n[Desktop Bridge] Bulk [1/{len(valid_scripts)}] Processing first script: '{first_s.name}'...")
    res_1 = await run_in_threadpool(process_one, first_s)
    saved_results.append(res_1)

    # 2. Remaining scripts: execute simultaneously
    remaining = valid_scripts[1:]
    if remaining:
        print(f"\n[Desktop Bridge] First script completed! Dispatching remaining {len(remaining)} scripts simultaneously (concurrency={concurrency})...")
        def run_remaining():
            with concurrent.futures.ThreadPoolExecutor(max_workers=concurrency) as executor:
                return list(executor.map(process_one, remaining))

        rem_results = await run_in_threadpool(run_remaining)
        saved_results.extend(rem_results)

    return {
        "success": True,
        "total": len(saved_results),
        "results": saved_results,
    }


@gui_app.post("/api/save_conversion_files")
async def save_conversion_files(req: SaveFilesRequest):
    folder_path = OUTPUT_DIR / req.folder
    folder_path.mkdir(parents=True, exist_ok=True)

    # Save MP3
    if req.mp3_b64:
        try:
            b64 = req.mp3_b64
            if "," in b64:
                b64 = b64.split(",", 1)[1]
            mp3_bytes = base64.b64decode(b64)
            (folder_path / "speech.mp3").write_bytes(mp3_bytes)
        except Exception as e:
            print(f"[Error saving mp3] {e}")

    # Save SRT
    if req.srt_content:
        try:
            (folder_path / "speech.srt").write_text(req.srt_content, encoding="utf-8")
        except Exception as e:
            print(f"[Error saving srt] {e}")

    # Save JSON
    if req.json_content:
        try:
            raw = req.json_content
            if isinstance(raw, str):
                (folder_path / "speech.json").write_text(raw, encoding="utf-8")
            else:
                (folder_path / "speech.json").write_text(json.dumps(raw, indent=2), encoding="utf-8")
        except Exception as e:
            print(f"[Error saving json] {e}")

    # Save script.txt
    if req.script_text:
        try:
            (folder_path / "script.txt").write_text(req.script_text, encoding="utf-8")
        except Exception as e:
            print(f"[Error saving script.txt] {e}")

    return {"success": True, "saved_folder": str(folder_path)}


@gui_app.get("/api/open_folder")
async def open_folder(folder: str = Query(...)):
    folder_path = OUTPUT_DIR / folder
    if not folder_path.exists():
        folder_path.mkdir(parents=True, exist_ok=True)
    try:
        os.startfile(str(folder_path))
        return {"success": True, "path": str(folder_path)}
    except Exception as e:
        return {"success": False, "error": str(e)}


gui_app.mount("/static_gui", StaticFiles(directory=str(MODAL_GUI_DIR)), name="static_gui")


@gui_app.get("/")
async def serve_index():
    index_file = MODAL_GUI_DIR / "index.html"
    return FileResponse(str(index_file))


def start_server():
    uvicorn.run(gui_app, host="127.0.0.1", port=8001, log_level="warning")


def main():
    import threading
    t = threading.Thread(target=start_server, daemon=True)
    t.start()
    time.sleep(0.8)

    url = "http://127.0.0.1:8001"
    print(f"[OmniVoice Studio] Desktop Gateway active at: {url}")

    try:
        import webview
        window = webview.create_window(
            title="OmniVoice Studio - Modal Cloud GPU Edition",
            url=url,
            width=1420,
            height=920,
            min_size=(1050, 700),
            background_color="#0B0E13"
        )
        webview.start(gui="edgechromium")
        os._exit(0)
    except Exception as err:
        print(f"[OmniVoice Studio] Opening in default web browser ({err})...")
        webbrowser.open(url)
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            print("Exiting...")


if __name__ == "__main__":
    main()
