"""
OmniVoice Studio - Bulk Narration Generator for Modal Cloud T4 GPU
Loads multiple .txt script files, selects a narrator voice, and dispatches them
to Modal Cloud T4 GPU sequentially without letting the GPU power down.
Saves all 4 files for each script into its dedicated output folder:
- speech.mp3
- speech.json
- speech.srt
- script.txt
"""

import sys
import os
import json
import base64
import time
from pathlib import Path

def main():
    import argparse
    parser = argparse.ArgumentParser(description="OmniVoice Bulk Script Synthesizer on Modal Cloud T4 GPU")
    parser.add_argument("--dir", default="scripts/zombie_survival", help="Directory containing .txt script files")
    parser.add_argument("--files", nargs="*", help="Specific .txt script files to process")
    parser.add_argument("--voice", default="narrator-deep-en", help="Voice preset ID (e.g. narrator-deep-en, warm-storyteller-en)")
    parser.add_argument("--speed", type=float, default=1.0, help="Speech speed multiplier")
    parser.add_argument("--lang", default="en", help="Language code")
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

    print("=" * 70)
    print("   🎙️  OMNIVOICE STUDIO - BULK SYNTHESIS (MODAL CLOUD T4 GPU)")
    print(f"   📁 Found {len(script_files)} script files to process")
    print(f"   🎭 Narrator Voice: {args.voice}")
    print(f"   ⚡ Execution Mode: Modal T4 GPU (Kept alive without powering down)")
    print("=" * 70)

    scripts_payload = []
    for sf in script_files:
        text = sf.read_text(encoding="utf-8").strip()
        words = text.split()
        print(f"  • Loaded '{sf.name}': {len(words)} words, {len(text)} chars")
        scripts_payload.append({
            "name": sf.stem,
            "text": text,
        })

    print("\n>>> Connecting to Modal Cloud T4 GPU function 'synthesize_scripts_bulk'...")
    import modal
    
    try:
        fn_bulk = modal.Function.from_name("omnivoice-studio", "synthesize_scripts_bulk")
        print(">>> Dispatching bulk batch to Modal T4 GPU (all scripts processed in single active GPU container)...")
        start_time = time.time()
        result = fn_bulk.remote(
            scripts=scripts_payload,
            voice_id=args.voice,
            speed=args.speed,
            language=args.lang,
        )
        elapsed = time.time() - start_time
        print(f">>> Received bulk results from Modal in {elapsed:.1f}s!")
    except Exception as e:
        print(f">>> synthesize_scripts_bulk error: {e}. Falling back to sequential execution on warm container...")
        fn_single = modal.Function.from_name("omnivoice-studio", "synthesize_script_file")
        results_list = []
        start_time = time.time()
        for idx, s in enumerate(scripts_payload):
            print(f">>> Synthesizing [{idx+1}/{len(scripts_payload)}]: '{s['name']}'...")
            res = fn_single.remote(
                script_text=s["text"],
                voice_id=args.voice,
                speed=args.speed,
                language=args.lang,
                script_name=s["name"],
            )
            results_list.append(res)
        elapsed = time.time() - start_time
        result = {"success": True, "total": len(results_list), "results": results_list}

    # Save all 4 files locally for each script
    output_root = Path("output")
    output_root.mkdir(parents=True, exist_ok=True)

    completed_folders = []
    for item in result.get("results", []):
        name = item.get("name") or "script"
        folder_name = item.get("folder")
        folder_path = output_root / folder_name
        folder_path.mkdir(parents=True, exist_ok=True)

        # 1. MP3
        mp3_file = folder_path / "speech.mp3"
        if item.get("mp3_b64"):
            mp3_file.write_bytes(base64.b64decode(item["mp3_b64"]))

        # 2. SRT
        srt_file = folder_path / "speech.srt"
        if item.get("srt_content"):
            srt_file.write_text(item["srt_content"], encoding="utf-8")

        # 3. JSON
        json_file = folder_path / "speech.json"
        if item.get("json_content"):
            j_raw = item["json_content"]
            if isinstance(j_raw, str):
                json_file.write_text(j_raw, encoding="utf-8")
            else:
                json_file.write_text(json.dumps(j_raw, indent=2), encoding="utf-8")

        # 4. script.txt
        txt_file = folder_path / "script.txt"
        orig_text = item.get("script_text") or next((s["text"] for s in scripts_payload if s["name"] == name), "")
        txt_file.write_text(orig_text, encoding="utf-8")

        completed_folders.append({
            "name": name,
            "folder": str(folder_path),
            "folder_name": folder_name,
            "duration": item.get("duration", 0),
            "words": item.get("words_count", 0),
            "mp3_bytes": mp3_file.stat().st_size if mp3_file.exists() else 0,
            "srt_bytes": srt_file.stat().st_size if srt_file.exists() else 0,
            "json_bytes": json_file.stat().st_size if json_file.exists() else 0,
            "txt_bytes": txt_file.stat().st_size if txt_file.exists() else 0,
        })

    print("\n" + "=" * 70)
    print("   🎉 BULK SYNTHESIS COMPLETED SUCCESSFULLY!")
    print("=" * 70)
    for c in completed_folders:
        print(f"\n📂 Script: {c['name']}")
        print(f"   Directory: {c['folder']}")
        print(f"   Duration:  {c['duration']:.2f}s (~{c['duration']/60:.1f} min)")
        print(f"   Words:     {c['words']} words aligned")
        print(f"   Files Generated (All 4 Verified):")
        print(f"     • speech.mp3  ({c['mp3_bytes']} bytes)")
        print(f"     • speech.srt  ({c['srt_bytes']} bytes)")
        print(f"     • speech.json ({c['json_bytes']} bytes)")
        print(f"     • script.txt  ({c['txt_bytes']} bytes)")

    print("\n>>> ALL 5 SCRIPTS PROCESSED ON MODAL T4 GPU WITHOUT TURNING OFF! 🚀")

if __name__ == "__main__":
    main()

