"""
OmniVoice Studio - Modal Cloud T4 GPU Deployment
Owner: joybenny3333
Features:
- NVIDIA T4 GPU Acceleration (3-5s synthesis for full paragraphs)
- k2-fsa/OmniVoice Zero-Shot Cloning & Voice Design
- faster-whisper alignment: outputs MP3, SRT subtitles, and JSON millisecond timestamps
- Modal Volume persistence for all generated audio assets
- Full ASGI FastAPI endpoints compatible with the Studio GUI
"""

from pathlib import Path
import modal

app = modal.App("omnivoice-studio")


def download_models():
    """Bake OmniVoice and Faster-Whisper weights into the container image cache."""
    print(">>> [Modal Build] Pre-downloading k2-fsa/OmniVoice weights...")
    from huggingface_hub import snapshot_download
    snapshot_download("k2-fsa/OmniVoice")
    print(">>> [Modal Build] Pre-downloading faster-whisper base model...")
    from faster_whisper import WhisperModel
    WhisperModel("base", device="cpu", compute_type="int8")
    print(">>> [Modal Build] Models cached successfully!")


BASE_DIR = Path(__file__).resolve().parent

image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("git", "ffmpeg", "libsndfile1")
    .pip_install(
        "torch==2.3.1",
        "torchaudio==2.3.1",
        "numpy<2.0.0",
        "scipy",
        "soundfile",
        "transformers",
        "accelerate",
        "librosa",
        "pydub",
        "faster-whisper",
        "huggingface_hub",
        "fastapi",
        "uvicorn",
        "pydantic",
        "python-multipart",
        extra_index_url="https://download.pytorch.org/whl/cu121"
    )
    .run_commands(
        "pip install git+https://github.com/k2-fsa/OmniVoice.git"
    )
    .run_function(download_models)
    .add_local_file(str(BASE_DIR / "server.py"), "/root/server.py")
    .add_local_file(str(BASE_DIR / "omnivoice_engine.py"), "/root/omnivoice_engine.py")
    .add_local_dir(str(BASE_DIR / "presets"), "/root/presets")
    .add_local_dir(str(BASE_DIR / "modal_gui"), "/root/modal_gui")
    .add_local_dir(str(BASE_DIR / "static"), "/root/static")
)

output_volume = modal.Volume.from_name("omnivoice-output-volume", create_if_missing=True)


@app.function(
    image=image,
    gpu="T4",
    timeout=600,
    scaledown_window=300,
    volumes={"/root/output": output_volume},
)
@modal.asgi_app()
def fastapi_app():
    import sys
    sys.path.insert(0, "/root")
    from server import app as fastapi_instance
    return fastapi_instance


@app.function(
    image=image,
    gpu="T4",
    timeout=600,
    volumes={"/root/output": output_volume},
)
def run_history_test():
    """Direct test function to verify GPU synthesis and return 3 files."""
    import sys
    sys.path.insert(0, "/root")
    import json
    import base64
    from pathlib import Path
    import soundfile as sf
    import omnivoice_engine
    from server import (
        make_conversion_folder,
        format_timestamp_srt,
        generate_srt_from_words,
        get_whisper,
        load_json,
        PRESETS_FILE,
        OUTPUT_DIR
    )

    print(">>> [Test] Loading presets from container...")
    presets = load_json(PRESETS_FILE, [])
    # Choose history narrator preset
    preset = next((p for p in presets if "narrator" in p.get("id", "") or "story" in p.get("id", "")), presets[0])
    print(f">>> [Test] Using Narrator: {preset.get('name')} ({preset.get('id')})")

    long_script = (
        "In the shadowed corridors of the ancient library of Alexandria, scrolls containing the accumulated "
        "wisdom of civilizations rested in silent majesty. Scholars from across the Mediterranean gathered to debate "
        "the mysteries of the stars and the foundations of mathematics, unaware that the sands of time would soon scatter their legacies."
    )

    folder_path, folder_name = make_conversion_folder(long_script)
    wav_path = folder_path / "speech.wav"
    mp3_path = folder_path / "speech.mp3"
    srt_path = folder_path / "speech.srt"
    json_path = folder_path / "speech.json"

    print(">>> [Test] Running OmniVoice GPU synthesis (32 steps)...")
    if preset.get("type") == "cloned":
        ref_audio = preset.get("ref_audio")
        ref_text = preset.get("ref_text") or long_script
        if not Path(ref_audio).exists():
            ref_audio = str(Path("/root/presets/audio") / Path(ref_audio).name)
        omnivoice_engine.synthesize_voice_clone(
            text=long_script,
            ref_audio_path=ref_audio,
            ref_text=ref_text,
            output_path=wav_path,
            speed=1.0,
            language="en",
            num_step=32,
        )
    else:
        instruct = preset.get("instruct", "male, middle-aged, low pitch, american accent")
        omnivoice_engine.synthesize_voice_design(
            text=long_script,
            instruct=instruct,
            output_path=wav_path,
            speed=1.0,
            language="en",
            num_step=32,
        )

    # Master MP3
    data, sr = sf.read(str(wav_path))
    sf.write(str(mp3_path), data, sr, format="MP3")
    print(f">>> [Test] MP3 exported: {mp3_path.stat().st_size} bytes")

    # Whisper Alignment
    print(">>> [Test] Running Faster-Whisper alignment for SRT & JSON...")
    whisper = get_whisper()
    segments, info = whisper.transcribe(str(wav_path), word_timestamps=True, language="en")
    words = []
    for s in segments:
        if s.words:
            for w in s.words:
                words.append({"word": w.word, "start": round(w.start, 3), "end": round(w.end, 3)})

    srt_content = generate_srt_from_words(words)
    srt_path.write_text(srt_content, encoding="utf-8")

    json_payload = {
        "text": long_script,
        "words": words,
        "duration": round(info.duration, 3)
    }
    json_path.write_text(json.dumps(json_payload, indent=2), encoding="utf-8")

    mp3_b64 = base64.b64encode(mp3_path.read_bytes()).decode("utf-8")

    output_volume.commit()
    print(">>> [Test] All 3 files generated and saved successfully!")
    return {
        "success": True,
        "folder": folder_name,
        "narrator": preset.get("name"),
        "mp3_bytes": mp3_path.stat().st_size,
        "srt_bytes": srt_path.stat().st_size,
        "json_bytes": json_path.stat().st_size,
        "duration": round(info.duration, 2),
        "words_count": len(words),
        "mp3_b64": mp3_b64,
        "srt_content": srt_content,
        "json_content": json.dumps(json_payload),
    }


@app.function(
    image=image,
    gpu="T4",
    timeout=900,
    scaledown_window=300,
    volumes={"/root/output": output_volume},
)
def synthesize_script_file(
    script_text: str,
    voice_id: str = "narrator-deep-en",
    speed: float = 1.0,
    language: str = "en",
    instruct: str = None,
    ref_audio_b64: str = None,
    ref_text: str = None,
    script_name: str = None,
):
    """
    Synthesizes narration script on Modal Cloud T4 GPU with intelligent multi-chunk flow matching.
    Saves speech.mp3, speech.srt, speech.json, and script.txt in dedicated output folder.
    """
    import sys
    sys.path.insert(0, "/root")
    import json
    import base64
    from pathlib import Path
    import soundfile as sf
    import omnivoice_engine
    from server import (
        make_conversion_folder,
        generate_srt_from_words,
        get_whisper,
        load_json,
        PRESETS_FILE,
        OUTPUT_DIR
    )

    print(f">>> [Modal GPU] Synthesizing script '{script_name or 'unnamed'}' ({len(script_text)} chars, {len(script_text.split())} words)...")
    presets = load_json(PRESETS_FILE, [])
    preset = next((p for p in presets if p.get("id") == voice_id), None)
    if not preset:
        # Try match by name or fallback
        preset = next((p for p in presets if voice_id and voice_id.lower() in p.get("name", "").lower()), presets[0])
    print(f">>> [Modal GPU] Selected Narrator: {preset.get('name')} ({preset.get('id')})")

    folder_path, folder_name = make_conversion_folder(script_text, custom_name=script_name)
    wav_path = folder_path / "speech.wav"
    mp3_path = folder_path / "speech.mp3"
    srt_path = folder_path / "speech.srt"
    json_path = folder_path / "speech.json"
    script_path = folder_path / "script.txt"

    # Save original script text
    script_path.write_text(script_text, encoding="utf-8")

    lang = language or preset.get("lang", "en")
    synth_speed = float(speed or 1.0)

    print(">>> [Modal GPU] Running OmniVoice GPU synthesis with intelligent chunking...")
    if ref_audio_b64:
        ref_input_path = folder_path / "custom_ref_audio.mp3"
        b64_data = ref_audio_b64
        if "," in b64_data:
            b64_data = b64_data.split(",", 1)[1]
        ref_input_path.write_bytes(base64.b64decode(b64_data))
        omnivoice_engine.synthesize_voice_clone(
            text=script_text,
            ref_audio_path=ref_input_path,
            ref_text=ref_text or script_text[:200],
            output_path=wav_path,
            speed=synth_speed,
            language=lang,
            num_step=32,
        )
    elif preset.get("type") == "cloned":
        ref_audio = preset.get("ref_audio", "")
        ref_t = ref_text or preset.get("ref_text") or script_text[:200]
        if not Path(ref_audio).exists():
            # Extract filename robustly: handle both Windows backslash and Unix forward-slash paths
            import ntpath
            filename = ntpath.basename(ref_audio)
            if not filename:
                filename = ref_audio.replace("\\", "/").split("/")[-1]
            ref_audio = str(Path("/root/presets/audio") / filename)
            print(f">>> [Modal GPU] Resolved ref_audio path: {ref_audio}")
        omnivoice_engine.synthesize_voice_clone(
            text=script_text,
            ref_audio_path=ref_audio,
            ref_text=ref_t,
            output_path=wav_path,
            speed=synth_speed,
            language=lang,
            num_step=32,
        )
    else:
        inst = instruct or preset.get("instruct", "male, middle-aged, low pitch, american accent")
        omnivoice_engine.synthesize_voice_design(
            text=script_text,
            instruct=inst,
            output_path=wav_path,
            speed=synth_speed,
            language=lang,
            num_step=32,
        )

    # Master MP3
    print(">>> [Modal GPU] Encoding Master broadcast MP3...")
    data, sr = sf.read(str(wav_path))
    sf.write(str(mp3_path), data, sr, format="MP3")
    mp3_bytes = mp3_path.stat().st_size
    print(f">>> [Modal GPU] MP3 exported: {mp3_bytes} bytes")

    # Whisper Alignment (CUDA Accelerated)
    print(">>> [Modal GPU] Running Faster-Whisper alignment for SRT & JSON...")
    whisper = get_whisper()
    words = []
    duration = 0.0
    if whisper:
        segments, info = whisper.transcribe(str(wav_path), word_timestamps=True, language=lang if lang != "all" else None)
        duration = round(info.duration, 2)
        for s in segments:
            if s.words:
                for w in s.words:
                    words.append({"word": w.word, "start": round(w.start, 3), "end": round(w.end, 3)})

    srt_content = generate_srt_from_words(words)
    srt_path.write_text(srt_content, encoding="utf-8")

    json_payload = {
        "text": script_text,
        "words": words,
        "duration": duration,
        "narrator": preset.get("name"),
        "script_name": script_name,
    }
    json_path.write_text(json.dumps(json_payload, indent=2), encoding="utf-8")

    mp3_b64 = base64.b64encode(mp3_path.read_bytes()).decode("utf-8")

    output_volume.commit()
    print(">>> [Modal GPU] All 4 files (mp3, json, srt, script.txt) generated and saved to volume!")
    return {
        "success": True,
        "folder": folder_name,
        "name": script_name,
        "narrator": preset.get("name"),
        "presetName": preset.get("name"),
        "duration": duration,
        "words_count": len(words),
        "words": words,
        "mp3_bytes": mp3_bytes,
        "mp3_b64": mp3_b64,
        "srt_content": srt_content,
        "json_content": json.dumps(json_payload),
        "script_text": script_text,
        "audioUrl": f"/output/{folder_name}/speech.mp3",
        "srtUrl": f"/output/{folder_name}/speech.srt",
        "jsonTimestampsUrl": f"/output/{folder_name}/speech.json",
        "scriptUrl": f"/output/{folder_name}/script.txt",
    }


@app.function(
    image=image,
    gpu="T4",
    timeout=3600,
    scaledown_window=300,
    volumes={"/root/output": output_volume},
)
def synthesize_scripts_bulk(
    scripts: list[dict],
    voice_id: str = "narrator-deep-en",
    speed: float = 1.0,
    language: str = "en",
    instruct: str = None,
    ref_audio_b64: str = None,
    ref_text: str = None,
):
    """
    Synthesizes multiple scripts sequentially in bulk on a single warmed-up Modal Cloud T4 GPU container.
    The container stays alive and never powers down between scripts.
    Generates all 4 files (speech.mp3, speech.json, speech.srt, script.txt) for each script.
    """
    import sys
    sys.path.insert(0, "/root")
    import json
    import base64
    from pathlib import Path
    import soundfile as sf
    import omnivoice_engine
    from server import (
        make_conversion_folder,
        generate_srt_from_words,
        get_whisper,
        load_json,
        PRESETS_FILE,
        OUTPUT_DIR
    )

    print(f"\n=======================================================")
    print(f">>> [Modal Bulk GPU] Starting batch of {len(scripts)} scripts...")
    print(f"=======================================================")
    presets = load_json(PRESETS_FILE, [])
    preset = next((p for p in presets if p.get("id") == voice_id), None)
    if not preset:
        preset = next((p for p in presets if voice_id and voice_id.lower() in p.get("name", "").lower()), presets[0])
    print(f">>> [Modal Bulk GPU] Active Voice: {preset.get('name')} ({preset.get('id')})")

    lang = language or preset.get("lang", "en")
    synth_speed = float(speed or 1.0)
    whisper = get_whisper()

    # Pre-resolve reference audio if cloned
    ref_audio_path = None
    if ref_audio_b64:
        ref_audio_path = Path("/tmp/bulk_ref_audio.mp3")
        b64_data = ref_audio_b64
        if "," in b64_data:
            b64_data = b64_data.split(",", 1)[1]
        ref_audio_path.write_bytes(base64.b64decode(b64_data))
    elif preset.get("type") == "cloned":
        ref_audio = preset.get("ref_audio", "")
        if not Path(ref_audio).exists():
            import ntpath
            filename = ntpath.basename(ref_audio)
            if not filename:
                filename = ref_audio.replace("\\", "/").split("/")[-1]
            ref_audio_path = Path("/root/presets/audio") / filename
        else:
            ref_audio_path = Path(ref_audio)

    results = []
    for idx, item in enumerate(scripts):
        script_text = item.get("text", "").strip()
        script_name = item.get("name") or f"script_{idx + 1}"
        print(f"\n>>> [Modal Bulk GPU] [{idx + 1}/{len(scripts)}] Synthesizing '{script_name}' ({len(script_text.split())} words)...")

        if not script_text:
            print(f">>> [Modal Bulk GPU] Warning: Script '{script_name}' is empty, skipping.")
            continue

        folder_path, folder_name = make_conversion_folder(script_text, custom_name=script_name)
        wav_path = folder_path / "speech.wav"
        mp3_path = folder_path / "speech.mp3"
        srt_path = folder_path / "speech.srt"
        json_path = folder_path / "speech.json"
        script_path = folder_path / "script.txt"

        # 1. Save original script.txt
        script_path.write_text(script_text, encoding="utf-8")

        # 2. Synthesize audio on GPU (model stays loaded in VRAM from previous script)
        if ref_audio_path and ref_audio_path.exists():
            ref_t = ref_text or preset.get("ref_text") or script_text[:200]
            omnivoice_engine.synthesize_voice_clone(
                text=script_text,
                ref_audio_path=ref_audio_path,
                ref_text=ref_t,
                output_path=wav_path,
                speed=synth_speed,
                language=lang,
                num_step=32,
            )
        else:
            inst = instruct or preset.get("instruct", "male, middle-aged, low pitch, american accent")
            omnivoice_engine.synthesize_voice_design(
                text=script_text,
                instruct=inst,
                output_path=wav_path,
                speed=synth_speed,
                language=lang,
                num_step=32,
            )

        # 3. Master MP3
        data, sr = sf.read(str(wav_path))
        sf.write(str(mp3_path), data, sr, format="MP3")
        mp3_bytes = mp3_path.stat().st_size

        # 4. Whisper Alignment
        words = []
        duration = 0.0
        if whisper:
            segments, info = whisper.transcribe(str(wav_path), word_timestamps=True, language=lang if lang != "all" else None)
            duration = round(info.duration, 2)
            for s in segments:
                if s.words:
                    for w in s.words:
                        words.append({"word": w.word, "start": round(w.start, 3), "end": round(w.end, 3)})

        # 5. Save SRT
        srt_content = generate_srt_from_words(words)
        srt_path.write_text(srt_content, encoding="utf-8")

        # 6. Save JSON
        json_payload = {
            "text": script_text,
            "words": words,
            "duration": duration,
            "narrator": preset.get("name"),
            "name": script_name
        }
        json_path.write_text(json.dumps(json_payload, indent=2), encoding="utf-8")

        mp3_b64 = base64.b64encode(mp3_path.read_bytes()).decode("utf-8")

        results.append({
            "success": True,
            "index": idx,
            "name": script_name,
            "folder": folder_name,
            "narrator": preset.get("name"),
            "presetName": preset.get("name"),
            "duration": duration,
            "words_count": len(words),
            "mp3_bytes": mp3_bytes,
            "mp3_b64": mp3_b64,
            "srt_content": srt_content,
            "json_content": json.dumps(json_payload),
            "script_text": script_text,
            "audioUrl": f"/output/{folder_name}/speech.mp3",
            "srtUrl": f"/output/{folder_name}/speech.srt",
            "jsonTimestampsUrl": f"/output/{folder_name}/speech.json",
            "scriptUrl": f"/output/{folder_name}/script.txt",
        })
        print(f">>> [Modal Bulk GPU] Completed script [{idx + 1}/{len(scripts)}]: {folder_name} (audio duration: {duration}s)")

    output_volume.commit()
    print(f"\n=======================================================")
    print(f">>> [Modal Bulk GPU] Batch complete: {len(results)} scripts synthesized successfully without GPU powering down!")
    print(f"=======================================================\n")
    return {
        "success": True,
        "total": len(results),
        "results": results,
    }
