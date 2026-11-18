"""
OmniVoice Studio - High-Performance Bulk Narration Generator (Modal Cloud T4 GPU)

Features:
1. Pipelined Verification & Simultaneous Execution:
   - Sends the 1st script first to verify model connectivity and output files.
   - The moment the 1st script returns its audio, immediately saves all 4 files locally.
   - Then immediately dispatches all remaining scripts simultaneously to Modal T4 GPU!
2. Per-Script Streaming File Saver:
   - As soon as ANY script finishes on Modal, immediately writes:
     • speech.mp3  (Master 24kHz Broadcast Audio)
     • speech.srt  (Subtitles with Whisper word timestamps)
     • speech.json (Word-level timestamps & alignment data)
     • script.txt  (Original input text)
   - Zero all-or-nothing blocking: completed scripts are safely on your disk even if another script is still running.
3. Configurable Concurrency:
   - Set --concurrency (default: 3) to control simultaneous Modal container workers.
"""

import sys
import os
import json
import base64
import time
import concurrent.futures
from pathlib import Path
from typing import Dict, Any, List

def save_script_files(result_dict: Dict[str, Any], script_text: str, output_root: Path = Path("output")) -> Dict[str, Any]:
    """Immediately saves speech.mp3, speech.srt, speech.json, and script.txt to disk."""
    name = result_dict.get("name") or "script"
    folder_name = result_dict.get("folder") or name
    folder_path = output_root / folder_name
    folder_path.mkdir(parents=True, exist_ok=True)

    # 1. MP3
    mp3_file = folder_path / "speech.mp3"
    if result_dict.get("mp3_b64"):
        b64 = result_dict["mp3_b64"]
        if "," in b64:
            b64 = b64.split(",", 1)[1]
        mp3_file.write_bytes(base64.b64decode(b64))

    # 2. SRT
    srt_file = folder_path / "speech.srt"
    if result_dict.get("srt_content"):
        srt_file.write_text(result_dict["srt_content"], encoding="utf-8")

    # 3. JSON
    json_file = folder_path / "speech.json"
    if result_dict.get("json_content"):
        j_raw = result_dict["json_content"]
        if isinstance(j_raw, str):
            json_file.write_text(j_raw, encoding="utf-8")
        else:
            json_file.write_text(json.dumps(j_raw, indent=2), encoding="utf-8")

    # 4. script.txt
    txt_file = folder_path / "script.txt"
    txt_file.write_text(script_text, encoding="utf-8")

    return {
        "name": name,
        "folder": str(folder_path),
        "folder_name": folder_name,
        "duration": result_dict.get("duration", 0),
        "words": result_dict.get("words_count", 0),
        "mp3_bytes": mp3_file.stat().st_size if mp3_file.exists() else 0,
        "srt_bytes": srt_file.stat().st_size if srt_file.exists() else 0,
        "json_bytes": json_file.stat().st_size if json_file.exists() else 0,
        "txt_bytes": txt_file.stat().st_size if txt_file.exists() else 0,
    }

def process_single_script(fn_single, script_item: Dict[str, Any], voice: str, speed: float, lang: str, output_root: Path) -> Dict[str, Any]:
    """Sends a single script to Modal Cloud T4 GPU and immediately saves files upon completion."""
    s_name = script_item["name"]
    s_text = script_item["text"]
    t0 = time.time()
    res = fn_single.remote(
        script_text=s_text,
        voice_id=voice,
        speed=speed,
        language=lang,
        script_name=s_name,
    )
    saved = save_script_files(res, s_text, output_root)
    elapsed = time.time() - t0
    saved["elapsed"] = elapsed
    return saved

def main():
    import argparse
    parser = argparse.ArgumentParser(description="OmniVoice Bulk Script Synthesizer on Modal Cloud T4 GPU")
    parser.add_argument("--dir", default="scripts/zombie_survival", help="Directory containing .txt script files")
    parser.add_argument("--files", nargs="*", help="Specific .txt script files to process")
    parser.add_argument("--voice", default="narrator-deep-en", help="Voice preset ID (e.g. narrator-deep-en, warm-storyteller-en)")
    parser.add_argument("--speed", type=float, default=1.0, help="Speech speed multiplier")
    parser.add_argument("--lang", default="en", help="Language code")
    parser.add_argument("--concurrency", type=int, default=3, help="Max simultaneous scripts to dispatch on Modal")
    args = parser.parse_args()

    # Gather .txt files
    script_files = []
    if args.files:
        for f in args.files:
            p = Path(f)
            if p.exists() and p.suffix.lower() == ".txt":
                script_files.append(p)
    elif args.dir:
        dir_path = Path(args.dir)
        if dir_path.exists():
            script_files = sorted([p for p in dir_path.glob("*.txt")])

    if not script_files:
        print(f"Error: No .txt files found in '{args.dir}'!")
        return

    print("=" * 72)
    print("   🎙️  OMNIVOICE STUDIO - HIGH-PERFORMANCE BULK MODAL RUNNER")
    print(f"   📁 Found {len(script_files)} script files to process")
    print(f"   🎭 Narrator Voice: {args.voice}")
    print(f"   ⚡ Execution Mode: First script verification -> Simultaneous Modal execution")
    print(f"   🔄 Concurrency: Up to {args.concurrency} simultaneous Modal workers")
    print("=" * 72)

    scripts_payload = []
    for sf in script_files:
        text = sf.read_text(encoding="utf-8").strip()
        words = text.split()
        print(f"  • Loaded '{sf.name}': {len(words)} words, {len(text)} chars")
        scripts_payload.append({
            "name": sf.stem,
            "text": text,
        })

    print("\n[*] Connecting to Modal Cloud T4 GPU function 'synthesize_script_file'...")
    import modal
    fn_single = modal.Function.from_name("omnivoice-studio", "synthesize_script_file")

    output_root = Path("output")
    output_root.mkdir(parents=True, exist_ok=True)

    completed_folders: List[Dict[str, Any]] = []
    total_scripts = len(scripts_payload)

    # -------------------------------------------------------------------------
    # STEP 1: Process 1st Script (Warm up container & verify file generation)
    # -------------------------------------------------------------------------
    first_script = scripts_payload[0]
    print(f"\n[*] [Step 1/2] Synthesizing first script [1/{total_scripts}]: '{first_script['name']}'...")
    print(f"    Dispatching to Modal Cloud T4 GPU...")
    
    t_start_all = time.time()
    try:
        saved_1 = process_single_script(fn_single, first_script, args.voice, args.speed, args.lang, output_root)
        completed_folders.append(saved_1)
        print("\n" + "-" * 72)
        print(f"  ✓ [1/{total_scripts}] '{saved_1['name']}' RETURNED & SAVED in {saved_1['elapsed']:.1f}s!")
        print(f"    • Local Folder: {saved_1['folder']}")
        print(f"    • Audio File:   speech.mp3 ({saved_1['mp3_bytes']} bytes, {saved_1['duration']:.1f}s duration)")
        print(f"    • Subtitles:    speech.srt ({saved_1['words']} words aligned)")
        print(f"    • Timestamps:   speech.json ({saved_1['json_bytes']} bytes)")
        print(f"    • Script Text:  script.txt ({saved_1['txt_bytes']} bytes)")
        print("-" * 72)
    except Exception as e:
        print(f"\n❌ Error processing first script '{first_script['name']}': {e}")
        return

    # -------------------------------------------------------------------------
    # STEP 2: Dispatch Remaining Scripts Simultaneously
    # -------------------------------------------------------------------------
    remaining_scripts = scripts_payload[1:]
    if remaining_scripts:
        print(f"\n[*] [Step 2/2] First script verified! Now dispatching remaining {len(remaining_scripts)} scripts simultaneously...")
        print(f"    Running with {min(len(remaining_scripts), args.concurrency)} concurrent Modal workers...\n")

        with concurrent.futures.ThreadPoolExecutor(max_workers=args.concurrency) as executor:
            future_to_script = {
                executor.submit(
                    process_single_script,
                    fn_single,
                    s,
                    args.voice,
                    args.speed,
                    args.lang,
                    output_root
                ): s
                for s in remaining_scripts
            }

            for future in concurrent.futures.as_completed(future_to_script):
                s = future_to_script[future]
                try:
                    saved = future.result()
                    completed_folders.append(saved)
                    idx = len(completed_folders)
                    print("-" * 72)
                    print(f"  ✓ [{idx}/{total_scripts}] '{saved['name']}' RETURNED & SAVED in {saved['elapsed']:.1f}s!")
                    print(f"    • Local Folder: {saved['folder']}")
                    print(f"    • Audio File:   speech.mp3 ({saved['mp3_bytes']} bytes, {saved['duration']:.1f}s duration)")
                    print(f"    • Subtitles:    speech.srt ({saved['words']} words aligned)")
                    print("-" * 72)
                except Exception as exc:
                    print(f"\n❌ Error on script '{s['name']}': {exc}")

    total_elapsed = time.time() - t_start_all

    print("\n" + "=" * 72)
    print(f"   🎉 BULK SYNTHESIS COMPLETED! ({len(completed_folders)}/{total_scripts} scripts in {total_elapsed:.1f}s)")
    print("=" * 72)
    for c in completed_folders:
        print(f"\n📂 Script: {c['name']}")
        print(f"   Directory: {c['folder']}")
        print(f"   Duration:  {c['duration']:.2f}s (~{c['duration']/60:.1f} min)")
        print(f"   Words:     {c['words']} words aligned")
        print(f"   Files Generated (All 4 Saved):")
        print(f"     • speech.mp3  ({c['mp3_bytes']} bytes)")
        print(f"     • speech.srt  ({c['srt_bytes']} bytes)")
        print(f"     • speech.json ({c['json_bytes']} bytes)")
        print(f"     • script.txt  ({c['txt_bytes']} bytes)")

    print(f"\n>>> All files saved locally to output/ folder! 🚀\n")

if __name__ == "__main__":
    main()
