import json
import os
import re
import time
import uuid
from pathlib import Path
from typing import Optional, Dict, Any, List

from starlette.concurrency import run_in_threadpool

from fastapi import FastAPI, File, Form, HTTPException, UploadFile, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

import omnivoice_engine

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
OUTPUT_DIR = BASE_DIR / "output"
STATIC_DIR = BASE_DIR / "static"
MODAL_GUI_DIR = BASE_DIR / "modal_gui"
PRESETS_DIR = BASE_DIR / "presets"
PRESETS_AUDIO_DIR = PRESETS_DIR / "audio"

DATA_DIR.mkdir(exist_ok=True)
OUTPUT_DIR.mkdir(exist_ok=True)
STATIC_DIR.mkdir(exist_ok=True)
MODAL_GUI_DIR.mkdir(exist_ok=True)
PRESETS_DIR.mkdir(exist_ok=True)
PRESETS_AUDIO_DIR.mkdir(exist_ok=True)

PRESETS_FILE = PRESETS_DIR / "presets.json"
HISTORY_FILE = DATA_DIR / "history.json"

SUPPORTED_LANGUAGES = ["en", "es", "hi", "fr", "ur", "de"]

whisper_model = None

def get_whisper():
    global whisper_model
    if whisper_model is None:
        try:
            from faster_whisper import WhisperModel
            import torch
            device = "cuda" if torch.cuda.is_available() else "cpu"
            compute_type = "float16" if device == "cuda" else "int8"
            whisper_model = WhisperModel("base", device=device, compute_type=compute_type)
        except Exception as e:
            print(f"Whisper initialization note: {e}")
            return None
    return whisper_model


def format_timestamp_srt(seconds: float) -> str:
    millis = int(round(seconds * 1000))
    hours = millis // 3600000
    millis %= 3600000
    minutes = millis // 60000
    millis %= 60000
    secs = millis // 1000
    millis %= 1000
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"


def generate_srt_from_words(words):
    lines = []
    chunk = []
    for w in words:
        chunk.append(w)
        text = w["word"].strip()
        if len(chunk) >= 5 or (text and text[-1] in ".!?,;。！？，"):
            lines.append(chunk)
            chunk = []
    if chunk:
        lines.append(chunk)
    srt_output = []
    for idx, line_words in enumerate(lines, 1):
        start_time = format_timestamp_srt(line_words[0]["start"])
        end_time = format_timestamp_srt(line_words[-1]["end"])
        line_text = "".join(w["word"] for w in line_words).strip()
        srt_output.append(f"{idx}\n{start_time} --> {end_time}\n{line_text}\n")
    return "\n".join(srt_output)


def load_json(path: Path, default_val=None):
    if default_val is None:
        default_val = []
    if not path.exists():
        return default_val
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return default_val


def save_json(path: Path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


app = FastAPI(title="VoiceStudio - Local Neural Speech Studio", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class TTSRequest(BaseModel):
    text: str
    presetId: Optional[str] = None
    voiceId: Optional[str] = None
    instruct: Optional[str] = None
    language: Optional[str] = "en"
    speed: Optional[float] = 1.0
    num_step: Optional[int] = None
    guidance_scale: Optional[float] = 2.0
    ref_audio_b64: Optional[str] = None
    ref_text: Optional[str] = None


class VoiceDesignRequest(BaseModel):
    name: str
    instruct: str
    gender: Optional[str] = "Male"
    language: Optional[str] = "en"
    sampleText: Optional[str] = None


@app.get("/api/presets")
async def get_presets(language: Optional[str] = None, preset_type: Optional[str] = None):
    presets = load_json(PRESETS_FILE, [])
    if language and language != "all":
        presets = [p for p in presets if p.get("lang") == language]
    if preset_type and preset_type != "all":
        presets = [p for p in presets if p.get("type") == preset_type]
    return {"presets": presets, "total": len(presets)}


@app.get("/api/voices")
async def get_voices_compat(language: Optional[str] = None):
    # Compatibility route returning presets as voices catalog
    presets = load_json(PRESETS_FILE, [])
    if language and language != "all":
        presets = [p for p in presets if p.get("lang") == language]
    return {"voices": presets, "total": len(presets)}


@app.post("/api/presets/transcribe")
async def transcribe_audio_clip(
    audioFile: UploadFile = File(...),
    language: Optional[str] = Form(None)
):
    """
    Auto-transcribe an uploaded reference audio snippet using faster-whisper.
    """
    tmp_path = OUTPUT_DIR / f"tmp_transcribe_{uuid.uuid4().hex[:8]}_{audioFile.filename}"
    content = await audioFile.read()
    tmp_path.write_bytes(content)
    try:
        whisper = get_whisper()
        if not whisper:
            return {"success": False, "error": "Whisper model not initialized", "text": ""}
        
        lang_arg = language if language and language != "all" else None
        segments, _ = whisper.transcribe(str(tmp_path), language=lang_arg)
        text = " ".join(s.text.strip() for s in segments).strip()
        return {"success": True, "text": text}
    except Exception as e:
        return {"success": False, "error": str(e), "text": ""}
    finally:
        if tmp_path.exists():
            try:
                tmp_path.unlink()
            except Exception:
                pass


@app.post("/api/presets/clone")
async def create_cloned_preset(
    name: str = Form(...),
    language: str = Form("en"),
    gender: Optional[str] = Form("Male"),
    ref_text: Optional[str] = Form(None),
    audioFile: UploadFile = File(...),
):
    """
    Saves a clean reference audio clip and transcript as a permanent preset.
    Extracts duration, calculates word timestamps, and generates avatar for live karaoke audition.
    """
    if language not in SUPPORTED_LANGUAGES:
        language = "en"

    slug = re.sub(r'[^a-zA-Z0-9_-]', '_', name.lower().strip())
    model_id = f"clone-{slug}-{uuid.uuid4().hex[:6]}"
    
    # Save audio file to presets/audio
    file_ext = Path(audioFile.filename).suffix.lower() or ".wav"
    audio_filename = f"{model_id}{file_ext}"
    saved_audio_path = PRESETS_AUDIO_DIR / audio_filename

    content = await audioFile.read()
    with open(saved_audio_path, "wb") as f:
        f.write(content)

    # Calculate audio duration
    dur = 5.0
    try:
        import soundfile as sf
        info = sf.info(str(saved_audio_path))
        dur = round(info.duration, 2)
    except Exception:
        pass

    # Transcribe and extract word timestamps
    transcript = (ref_text or "").strip()
    words_list = []
    whisper = get_whisper()
    if whisper:
        try:
            segments, info_trans = whisper.transcribe(
                str(saved_audio_path),
                word_timestamps=True,
                language=language if language != "all" else None
            )
            seg_list = list(segments)
            if not transcript:
                transcript = " ".join(s.text.strip() for s in seg_list).strip()
            for s in seg_list:
                if s.words:
                    for w in s.words:
                        words_list.append({
                            "word": w.word.strip(),
                            "start": round(w.start, 3),
                            "end": round(w.end, 3)
                        })
        except Exception as e:
            print(f"Whisper auto-transcribe error on reference clip: {e}")

    # Fallback word timestamps if whisper didn't produce word-level
    if not words_list and transcript and dur > 0:
        raw_words = transcript.split()
        if raw_words:
            step = dur / len(raw_words)
            for idx, rw in enumerate(raw_words):
                words_list.append({
                    "word": rw,
                    "start": round(idx * step, 3),
                    "end": round((idx + 1) * step, 3)
                })

    new_preset = {
        "id": model_id,
        "name": name.strip(),
        "type": "cloned",
        "lang": language,
        "gender": gender or "Male",
        "ref_audio": str(saved_audio_path),
        "ref_text": transcript,
        "sampleText": transcript or f"Voice preview for {name.strip()}",
        "audioUrl": f"/presets/audio/{audio_filename}",
        "avatar": "/presets/avatars/narrator-deep-en.svg",
        "duration": dur,
        "words": words_list,
        "created": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "description": f"Custom zero-shot cloned voice preset from reference audio ({language.upper()})."
    }

    presets = load_json(PRESETS_FILE, [])
    presets.insert(0, new_preset)
    save_json(PRESETS_FILE, presets)

    return {"success": True, "preset": new_preset}



@app.post("/api/presets/design")
async def create_designed_preset(req: VoiceDesignRequest):
    """
    Saves a new Voice Design prompt as a permanent preset.
    """
    lang = req.language if req.language in SUPPORTED_LANGUAGES else "en"
    slug = re.sub(r'[^a-zA-Z0-9_-]', '_', req.name.lower().strip())
    model_id = f"design-{slug}-{uuid.uuid4().hex[:6]}"

    new_preset = {
        "id": model_id,
        "name": req.name.strip(),
        "type": "designed",
        "lang": lang,
        "gender": req.gender or "Male",
        "instruct": req.instruct.strip(),
        "description": f"Voice Design preset: {req.instruct.strip()}",
        "sampleText": req.sampleText or "Hello! This is a synthesized speech preview from OmniVoice.",
        "created": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    }

    presets = load_json(PRESETS_FILE, [])
    presets.insert(0, new_preset)
    save_json(PRESETS_FILE, presets)

    return {"success": True, "preset": new_preset}


@app.delete("/api/presets/{preset_id}")
async def delete_preset(preset_id: str):
    presets = load_json(PRESETS_FILE, [])
    updated = [p for p in presets if p.get("id") != preset_id]
    save_json(PRESETS_FILE, updated)
    return {"success": True}


def make_conversion_folder(text: str, custom_name: Optional[str] = None) -> tuple[Path, str]:
    """
    Creates a new folder for every TTS conversion:
    Named as custom file prefix (or first few words of custom text) + date and time of conversion.
    Example: 'zombie_survival_01_2026-10-08_00-10-15'
    """
    if custom_name:
        stem = Path(custom_name).stem
        slug_prefix = re.sub(r'[^a-zA-Z0-9_\u0400-\u04FF\u0600-\u06FF\u0900-\u097F\u4e00-\u9fff]', '_', stem)[:40].strip('_')
    else:
        words = re.findall(r'[\w]+', text)
        prefix_words = words[:5] if words else ["speech"]
        slug_prefix = "_".join(prefix_words)[:32]
        slug_prefix = re.sub(r'[^a-zA-Z0-9_\u0400-\u04FF\u0600-\u06FF\u0900-\u097F\u4e00-\u9fff]', '_', slug_prefix).strip('_')
    
    if not slug_prefix:
        slug_prefix = "speech"

    timestamp = time.strftime("%Y-%m-%d_%H-%M-%S")
    folder_name = f"{slug_prefix}_{timestamp}"
    folder_path = OUTPUT_DIR / folder_name
    folder_path.mkdir(parents=True, exist_ok=True)
    return folder_path, folder_name


def _generate_speech_sync(req: TTSRequest):
    """
    Synchronous worker executing OmniVoice synthesis and Whisper alignment in a background
    thread pool, keeping the main asyncio event loop completely free and responsive.
    """
    if not req.text or not req.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty.")

    clean_text = req.text.strip()
    preset_id = req.presetId or req.voiceId

    presets = load_json(PRESETS_FILE, [])
    preset = next((p for p in presets if p.get("id") == preset_id), None)

    # Dedicated folder for every conversion: first few words + date & time
    folder_path, folder_name = make_conversion_folder(clean_text)

    wav_filepath = folder_path / "speech.wav"
    mp3_filepath = folder_path / "speech.mp3"
    srt_filepath = folder_path / "speech.srt"
    json_filepath = folder_path / "speech.json"

    lang = req.language or (preset.get("lang") if preset else "en")
    if lang not in SUPPORTED_LANGUAGES:
        lang = "en"

    num_step = req.num_step
    guidance_scale = req.guidance_scale or 2.0

    # Synthesis via k2-fsa/OmniVoice
    try:
        omnivoice_engine.set_progress(
            "converting",
            "Initializing OmniVoice Neural Synthesis...",
            percent=10,
            detail=f"Conditioning speaker prompt and acoustic latents ({lang})..."
        )
        if getattr(req, "ref_audio_b64", None):
            import base64
            ref_input_path = folder_path / "custom_ref_audio.mp3"
            try:
                b64_data = req.ref_audio_b64
                if "," in b64_data:
                    b64_data = b64_data.split(",", 1)[1]
                ref_bytes = base64.b64decode(b64_data)
                ref_input_path.write_bytes(ref_bytes)
                ref_text = req.ref_text or clean_text
                omnivoice_engine.synthesize_voice_clone(
                    text=clean_text,
                    ref_audio_path=ref_input_path,
                    ref_text=ref_text,
                    output_path=wav_filepath,
                    speed=req.speed or 1.0,
                    language=lang,
                    num_step=num_step,
                    guidance_scale=guidance_scale
                )
            except Exception as b64_err:
                raise RuntimeError(f"Failed decoding ref_audio_b64: {b64_err}")
        elif preset and preset.get("type") == "cloned":
            ref_audio = preset.get("ref_audio")
            # Resolve cross-platform path differences
            if ref_audio:
                ref_p = Path(ref_audio)
                if not ref_p.exists():
                    candidate = PRESETS_AUDIO_DIR / ref_p.name
                    if candidate.exists():
                        ref_audio = str(candidate)
            ref_text = req.ref_text or preset.get("ref_text") or clean_text
            omnivoice_engine.synthesize_voice_clone(
                text=clean_text,
                ref_audio_path=ref_audio,
                ref_text=ref_text,
                output_path=wav_filepath,
                speed=req.speed or 1.0,
                language=lang,
                num_step=num_step,
                guidance_scale=guidance_scale
            )
        else:
            instruct = (
                req.instruct
                or (preset.get("instruct") if preset else "male, middle-aged, low pitch, american accent")
            )
            omnivoice_engine.synthesize_voice_design(
                text=clean_text,
                instruct=instruct,
                output_path=wav_filepath,
                speed=req.speed or 1.0,
                language=lang,
                num_step=num_step,
                guidance_scale=guidance_scale
            )
    except Exception as e:
        omnivoice_engine.set_progress("error", f"Synthesis error: {e}", percent=0, detail=str(e))
        print(f"[OmniVoice Engine Error] {e}")
        raise HTTPException(status_code=500, detail=f"OmniVoice synthesis error: {str(e)}")

    # Convert/export audio directly to MP3 in the dedicated folder
    omnivoice_engine.set_progress(
        "converting",
        "Encoding High-Fidelity MP3 Audio...",
        percent=82,
        detail=f"Saving speech.mp3 into folder '{folder_name}'..."
    )
    try:
        import soundfile as sf
        audio_data, sr = sf.read(str(wav_filepath))
        sf.write(str(mp3_filepath), audio_data, sr, format="MP3")
    except Exception as mp3_err:
        print(f"MP3 export note: {mp3_err}")
        # If mp3 export failed, fallback to wav
        mp3_filepath = wav_filepath

    audio_filename = mp3_filepath.name
    audio_url = f"/api/audio/{folder_name}/{audio_filename}"
    wav_url = f"/api/audio/{folder_name}/speech.wav"

    # Transcribe with Whisper for word-level timestamps and SRT
    word_timestamps = []
    srt_url = ""
    json_url = ""
    whisper = get_whisper()
    if whisper and wav_filepath.exists():
        try:
            omnivoice_engine.set_progress(
                "converting",
                "Whisper AI: Aligning Word-Level Millisecond Timestamps...",
                percent=88,
                detail=f"Analyzing acoustic alignment with faster-whisper ({lang})..."
            )
            segments, info = whisper.transcribe(str(wav_filepath), word_timestamps=True, language=lang)
            for segment in segments:
                if segment.words:
                    for word in segment.words:
                        word_timestamps.append({
                            "word": word.word,
                            "start": round(word.start, 3),
                            "end": round(word.end, 3),
                            "probability": round(word.probability, 3)
                        })

            omnivoice_engine.set_progress(
                "converting",
                "Building Subtitles (SRT) and Word Metadata (JSON)...",
                percent=95,
                detail=f"Saving speech.srt and speech.json in '{folder_name}'..."
            )
            srt_content = generate_srt_from_words(word_timestamps)
            srt_filepath.write_text(srt_content, encoding="utf-8")
            json_filepath.write_text(json.dumps({
                "text": clean_text,
                "words": word_timestamps,
                "duration": round(info.duration, 3)
            }, indent=2), encoding="utf-8")

            # Save script.txt
            (folder_path / "script.txt").write_text(clean_text, encoding="utf-8")

            srt_url = f"/api/audio/{folder_name}/{srt_filepath.name}"
            json_url = f"/api/audio/{folder_name}/{json_filepath.name}"
        except Exception as err:
            print(f"Whisper transcription error: {err}")

    omnivoice_engine.set_progress(
        "complete",
        "Conversion Complete! All Files Saved.",
        percent=100,
        detail=f"Generated speech.mp3, speech.wav, speech.json, and speech.srt in dedicated folder: {folder_name}"
    )

    # Record in generation history
    history = load_json(HISTORY_FILE, [])
    record = {
        "id": f"gen-{uuid.uuid4().hex[:10]}",
        "text": clean_text,
        "folder": folder_name,
        "folderPath": str(folder_path),
        "presetId": preset.get("id") if preset else "custom",
        "presetName": preset.get("name") if preset else "Custom OmniVoice Design",
        "audioUrl": audio_url,
        "wavUrl": wav_url,
        "srtUrl": srt_url,
        "jsonTimestampsUrl": json_url,
        "words": word_timestamps,
        "language": lang,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    history.insert(0, record)
    save_json(HISTORY_FILE, history)

    import base64
    mp3_b64 = ""
    if mp3_filepath.exists():
        try:
            mp3_b64 = base64.b64encode(mp3_filepath.read_bytes()).decode("utf-8")
        except Exception:
            mp3_b64 = ""

    wav_b64 = ""
    if wav_filepath.exists():
        try:
            wav_b64 = base64.b64encode(wav_filepath.read_bytes()).decode("utf-8")
        except Exception:
            wav_b64 = ""

    srt_text = srt_filepath.read_text(encoding="utf-8") if srt_filepath.exists() else ""
    json_text = json_filepath.read_text(encoding="utf-8") if json_filepath.exists() else "{}"

    return {
        "success": True,
        "folder": folder_name,
        "audioUrl": audio_url,
        "wavUrl": wav_url,
        "srtUrl": srt_url,
        "jsonTimestampsUrl": json_url,
        "words": word_timestamps,
        "mp3_b64": mp3_b64,
        "wav_b64": wav_b64,
        "srt_content": srt_text,
        "json_content": json_text,
        "record": record
    }


ASYNC_JOBS: Dict[str, Any] = {}


@app.post("/api/tts/generate")
async def generate_speech(req: TTSRequest):
    """
    Non-blocking endpoint: executes heavy OmniVoice synthesis on a background worker thread,
    keeping the main asyncio event loop completely free to serve /api/tts/progress in real time.
    """
    return await run_in_threadpool(_generate_speech_sync, req)


@app.post("/api/tts/generate_async")
@app.post("/api/tts/spawn")
async def generate_speech_async(req: TTSRequest):
    """
    Purely local asynchronous generation endpoint that returns immediately with a job ID.
    Executes in a dedicated background daemon thread.
    Clients poll /api/tts/status/{job_id} every 1-2s.
    """
    clean_text = (req.text or "").strip()
    if not clean_text:
        raise HTTPException(status_code=400, detail="Text cannot be empty.")

    job_id = f"job-{uuid.uuid4().hex[:12]}"
    ASYNC_JOBS[job_id] = {
        "success": True,
        "status": "processing",
        "job_id": job_id,
        "created_at": time.time(),
        "progress": 10,
        "message": "Initializing OmniVoice neural synthesis...",
        "result": None,
        "error": None
    }

    def _worker():
        try:
            res = _generate_speech_sync(req)
            ASYNC_JOBS[job_id]["status"] = "completed"
            ASYNC_JOBS[job_id]["progress"] = 100
            ASYNC_JOBS[job_id]["message"] = "Completed successfully"
            ASYNC_JOBS[job_id]["result"] = res
        except Exception as e:
            ASYNC_JOBS[job_id]["status"] = "failed"
            ASYNC_JOBS[job_id]["error"] = str(e)
            ASYNC_JOBS[job_id]["message"] = f"Failed: {e}"

    import threading
    threading.Thread(target=_worker, daemon=True).start()

    return {
        "success": True,
        "status": "processing",
        "job_id": job_id,
        "type": "local_thread",
        "poll_url": f"/api/tts/status/{job_id}"
    }


@app.get("/api/tts/status/{job_id}")
async def get_tts_status(job_id: str):
    """
    Polls status of an async speech generation task.
    Returns 200 with status: 'processing', 'completed', or 'failed'.
    """
    if job_id.startswith("fc-"):
        try:
            from modal.functions import FunctionCall
            fc = FunctionCall.from_id(job_id)
            try:
                if hasattr(fc.get, "aio"):
                    res = await fc.get.aio(timeout=0)
                else:
                    res = fc.get(timeout=0)
                return {
                    "success": True,
                    "status": "completed",
                    "progress": 100,
                    "result": res
                }
            except TimeoutError:
                return {
                    "success": True,
                    "status": "processing",
                    "progress": 50,
                    "message": "Synthesizing multi-chunk speech on Modal T4 GPU..."
                }
            except Exception as call_err:
                return {
                    "success": False,
                    "status": "failed",
                    "error": str(call_err)
                }
        except Exception as e:
            return {"success": False, "status": "failed", "error": f"Modal status error: {e}"}

    if job_id in ASYNC_JOBS:
        return ASYNC_JOBS[job_id]

    raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found.")


@app.get("/api/tts/progress")
@app.get("/api/progress")
async def get_tts_progress():
    """Returns real-time progress for model loading and speech conversion."""
    return omnivoice_engine.get_progress()


@app.get("/api/health")
async def health_check():
    """Health check for VoiceStudio engine & local hardware status."""
    dev = omnivoice_engine.get_device_config()
    prog = omnivoice_engine.get_progress()
    return {
        "status": "healthy",
        "engine": "k2-fsa/OmniVoice",
        "device": dev["device"],
        "has_gpu": dev["has_gpu"],
        "dtype": str(dev["dtype"]),
        "model_loaded": prog.get("model_loaded", False),
        "presets_count": len(load_json(PRESETS_FILE, []))
    }


@app.get("/api/engines")
async def list_engines():
    """Lists available local speech synthesis engines (mirroring VoiceStudio catalog)."""
    dev = omnivoice_engine.get_device_config()
    return {
        "default": "omnivoice",
        "engines": [
            {
                "id": "omnivoice",
                "name": "OmniVoice (k2-fsa/OmniVoice)",
                "description": "Zero-shot neural voice cloning and design across 600+ languages",
                "device": dev["device"],
                "status": "active",
                "supports_cloning": True,
                "supports_design": True,
                "supports_multilingual": True
            },
            {
                "id": "whisperx",
                "name": "Faster-Whisper AI ASR",
                "description": "Sub-word millisecond forced acoustic alignment & live dictation",
                "device": dev["device"],
                "status": "active",
                "supports_transcription": True
            }
        ]
    }


@app.post("/api/transcribe")
async def transcribe_media_file(
    audioFile: UploadFile = File(...),
    language: Optional[str] = Form(None)
):
    """
    Direct transcription & dictation endpoint (VoiceStudio transcription suite).
    Returns full transcript and word-level millisecond timestamps.
    """
    tmp_path = OUTPUT_DIR / f"dictation_{uuid.uuid4().hex[:8]}_{audioFile.filename}"
    content = await audioFile.read()
    tmp_path.write_bytes(content)
    try:
        whisper = get_whisper()
        if not whisper:
            raise HTTPException(status_code=500, detail="Whisper transcription engine not initialized.")

        lang_arg = language if language and language != "all" else None
        segments, info = whisper.transcribe(str(tmp_path), word_timestamps=True, language=lang_arg)
        
        words_out = []
        full_text_parts = []
        for s in segments:
            full_text_parts.append(s.text.strip())
            if s.words:
                for w in s.words:
                    words_out.append({
                        "word": w.word,
                        "start": round(w.start, 3),
                        "end": round(w.end, 3),
                        "probability": round(w.probability, 3)
                    })
        
        full_text = " ".join(full_text_parts).strip()
        return {
            "success": True,
            "text": full_text,
            "duration": round(info.duration, 2),
            "language": info.language,
            "detected_language": info.language,
            "words_count": len(words_out) or len(full_text.split()),
            "words": words_out
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transcription error: {str(e)}")
    finally:
        if tmp_path.exists():
            try:
                tmp_path.unlink()
            except Exception:
                pass


class OpenFolderReq(BaseModel):
    folder: str


@app.post("/api/open-folder")
@app.post("/api/open_folder")
async def open_folder_post(req: OpenFolderReq):
    folder_path = OUTPUT_DIR / req.folder
    if not folder_path.exists():
        folder_path.mkdir(parents=True, exist_ok=True)
    try:
        os.startfile(str(folder_path))
        return {"success": True, "path": str(folder_path)}
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.get("/api/open-folder")
@app.get("/api/open_folder")
async def open_folder_get(folder: str = Query(...)):
    folder_path = OUTPUT_DIR / folder
    if not folder_path.exists():
        folder_path.mkdir(parents=True, exist_ok=True)
    try:
        os.startfile(str(folder_path))
        return {"success": True, "path": str(folder_path)}
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.on_event("startup")
async def on_startup():
    """Warms up the OmniVoice model in a background thread at startup with live progress."""
    import threading
    threading.Thread(target=omnivoice_engine.preload_model, daemon=True).start()


@app.get("/api/audio/{subpath:path}")
async def serve_audio(subpath: str):
    file_path = OUTPUT_DIR / subpath
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    if subpath.endswith(".srt"):
        return FileResponse(path=file_path, media_type="text/plain; charset=utf-8")
    elif subpath.endswith(".json"):
        return FileResponse(path=file_path, media_type="application/json")
    elif subpath.endswith(".wav"):
        return FileResponse(path=file_path, media_type="audio/wav")
    return FileResponse(path=file_path, media_type="audio/mpeg")


@app.get("/presets/audio/{filename}")
async def serve_preset_audio(filename: str):
    file_path = PRESETS_AUDIO_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Preset audio not found")
    media = "audio/wav" if filename.endswith(".wav") else "audio/mpeg"
    return FileResponse(path=file_path, media_type=media)


@app.get("/presets/avatars/{filename}")
async def serve_preset_avatar(filename: str):
    file_path = PRESETS_DIR / "avatars" / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Preset avatar not found")
    return FileResponse(path=file_path, media_type="image/svg+xml")


@app.get("/api/history")
async def get_history():
    return {"history": load_json(HISTORY_FILE, [])}


@app.delete("/api/history/{item_id}")
async def delete_history(item_id: str):
    history = load_json(HISTORY_FILE, [])
    updated = [h for h in history if h.get("id") != item_id]
    save_json(HISTORY_FILE, updated)
class ModalConvertRequest(BaseModel):
    modalUrl: str
    text: str
    presetId: Optional[str] = None
    voiceId: Optional[str] = None
    instruct: Optional[str] = None
    language: Optional[str] = "en"
    speed: Optional[float] = 1.0
    ref_audio_b64: Optional[str] = None
    ref_text: Optional[str] = None


@app.post("/api/modal/convert")
async def proxy_modal_convert(req: ModalConvertRequest):
    """
    Robust local bridge that proxies conversion requests to the user's Modal Cloud deployment,
    bypassing browser CORS/socket timeouts, and persists the 3 delivered files locally into output/{folder}.
    """
    import base64
    clean_text = req.text.strip()
    if not clean_text:
        raise HTTPException(status_code=400, detail="Text cannot be empty.")

    voice_id = req.presetId or req.voiceId or "narrator-deep-en"
    speed = float(req.speed or 1.0)
    language = req.language or "en"

    # Strategy 1: Direct Modal Python SDK remote call (Highest reliability, 900s timeout)
    try:
        import modal
        print(f"[Bridge] Calling Modal T4 GPU function 'synthesize_script_file' for voice '{voice_id}'...")
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

        print(f"[Bridge] Successfully saved all 3 files to: {folder_path}")
        return result
    except Exception as sdk_err:
        print(f"[Bridge] Modal SDK direct execution note: {sdk_err}. Trying HTTP fallback...")

    # Strategy 2: HTTP Fallback with Async Polling
    if not req.modalUrl:
        raise HTTPException(status_code=500, detail="Modal Python SDK failed and no Modal URL provided.")

    modal_base = req.modalUrl.strip().rstrip("/")
    if not modal_base.endswith(".run") and ".modal" in modal_base:
        modal_base += ".run"

    import urllib.request
    import urllib.error
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
        print(f"[Bridge] Async HTTP note: {async_err}")

    # Fallback to direct synchronous HTTP
    req_obj = urllib.request.Request(
        f"{modal_base}/api/tts/generate",
        data=payload_bytes,
        headers={"Content-Type": "application/json"}
    )
    try:
        with urllib.request.urlopen(req_obj, timeout=600) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            folder = data.get("folder", f"speech_{int(time.time())}")
            folder_path = OUTPUT_DIR / folder
            folder_path.mkdir(parents=True, exist_ok=True)
            if data.get("mp3_b64"):
                b64 = data["mp3_b64"]
                if "," in b64:
                    b64 = b64.split(",", 1)[1]
                (folder_path / "speech.mp3").write_bytes(base64.b64decode(b64))
            if data.get("srt_content"):
                (folder_path / "speech.srt").write_text(data["srt_content"], encoding="utf-8")
            if data.get("json_content"):
                raw = data["json_content"]
                if isinstance(raw, str):
                    (folder_path / "speech.json").write_text(raw, encoding="utf-8")
                else:
                    (folder_path / "speech.json").write_text(json.dumps(raw, indent=2), encoding="utf-8")
            (folder_path / "script.txt").write_text(clean_text, encoding="utf-8")
            return data
    except urllib.error.HTTPError as he:
        err_msg = he.read().decode("utf-8", errors="ignore")
        raise HTTPException(status_code=he.code, detail=f"Modal GPU returned {he.code}: {err_msg}")
    except Exception as ex:
        raise HTTPException(status_code=500, detail=f"Bridge proxy to Modal failed: {str(ex)}")


class SaveFilesRequest(BaseModel):
    folder: str
    mp3_b64: Optional[str] = None
    srt_content: Optional[str] = None
    json_content: Optional[Any] = None
    words: Optional[List[Dict[str, Any]]] = None
    script_text: Optional[str] = None


@app.post("/api/save_conversion_files")
async def save_conversion_files_bridge(req: SaveFilesRequest):
    """
    Saves converted output files from Modal into local output/{folder} so user can access them locally.
    """
    import base64
    save_dir = OUTPUT_DIR / req.folder
    save_dir.mkdir(parents=True, exist_ok=True)

    if req.mp3_b64:
        b64 = req.mp3_b64
        if "," in b64:
            b64 = b64.split(",", 1)[1]
        (save_dir / "speech.mp3").write_bytes(base64.b64decode(b64))

    if req.srt_content:
        (save_dir / "speech.srt").write_text(req.srt_content, encoding="utf-8")

    if req.json_content:
        j_text = req.json_content if isinstance(req.json_content, str) else json.dumps(req.json_content, indent=2)
        (save_dir / "speech.json").write_text(j_text, encoding="utf-8")

    if req.script_text:
        (save_dir / "script.txt").write_text(req.script_text, encoding="utf-8")

    return {"success": True, "path": str(save_dir)}


app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
app.mount("/static_gui", StaticFiles(directory=str(MODAL_GUI_DIR)), name="static_gui")


@app.get("/modal")
@app.get("/modal_gui")
async def serve_modal_gui():
    modal_index = MODAL_GUI_DIR / "index.html"
    if modal_index.exists():
        return FileResponse(str(modal_index))
    return JSONResponse({"error": "modal_gui index not found"})


@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    if full_path in ["modal", "modal_gui", "modal/"]:
        modal_index = MODAL_GUI_DIR / "index.html"
        if modal_index.exists():
            return FileResponse(str(modal_index))
    index_file = STATIC_DIR / "index.html"
    if index_file.exists():
        return FileResponse(str(index_file))
    return JSONResponse({"status": "VoiceStudio Backend Online"})
