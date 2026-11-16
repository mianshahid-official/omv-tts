"""
OmniVoice Studio - Local Model Downloader & Storage Manager
Downloads and verifies the k2-fsa/OmniVoice neural model weights into the local 'models/' directory:
  models/omnivoice/  -> k2-fsa/OmniVoice neural flow matching model
  models/whisper/    -> faster-whisper base speech alignment model
"""

import os
import sys
import json
import urllib.request
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
MODELS_DIR = BASE_DIR / "models"
OMNIVOICE_DIR = MODELS_DIR / "omnivoice"
WHISPER_DIR = MODELS_DIR / "whisper"

HF_REPO_ID = "k2-fsa/OmniVoice"
HF_API_URL = f"https://huggingface.co/api/models/{HF_REPO_ID}"

def verify_online_model_link() -> bool:
    """Verifies that the Hugging Face repository exists and is reachable online."""
    print(f"[*] Step 1: Verifying online model repository: https://huggingface.co/{HF_REPO_ID} ...")
    try:
        req = urllib.request.Request(
            HF_API_URL,
            headers={"User-Agent": "OmniVoice-Downloader/1.0"}
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            if resp.status == 200:
                data = json.loads(resp.read().decode("utf-8"))
                files = data.get("siblings", [])
                print(f"  ✓ Online repository verified: {data.get('id')}")
                print(f"  ✓ Remote repository contains {len(files)} model files & configurations.")
                return True
    except Exception as e:
        print(f"  ❌ Online check warning: {e}")
        print("  Proceeding with download attempt...")
    return False

def download_omnivoice_model():
    """Downloads k2-fsa/OmniVoice weights directly into models/omnivoice/."""
    print(f"\n[*] Step 2: Downloading OmniVoice weights to local directory:")
    print(f"    Path: {OMNIVOICE_DIR}")
    
    OMNIVOICE_DIR.mkdir(parents=True, exist_ok=True)

    try:
        from huggingface_hub import snapshot_download
        print("    Fetching files from HuggingFace Hub (with resume support)...")
        saved_path = snapshot_download(
            repo_id=HF_REPO_ID,
            local_dir=str(OMNIVOICE_DIR),
            local_dir_use_symlinks=False,  # Windows real copy, no broken symlinks
            resume_download=True,
        )
        print(f"  ✓ OmniVoice model weights saved to:\n    {saved_path}")
    except ImportError:
        print("  ❌ huggingface_hub is not installed! Run: pip install huggingface_hub")
        sys.exit(1)
    except Exception as e:
        print(f"  ❌ Failed downloading OmniVoice model: {e}")
        sys.exit(1)

def download_whisper_model():
    """Downloads faster-whisper base model to models/whisper/."""
    print(f"\n[*] Step 3: Downloading Faster-Whisper base model to local directory:")
    print(f"    Path: {WHISPER_DIR}")

    WHISPER_DIR.mkdir(parents=True, exist_ok=True)
    try:
        from faster_whisper import WhisperModel
        WhisperModel("base", device="cpu", compute_type="int8", download_root=str(WHISPER_DIR))
        print("  ✓ Faster-Whisper base model saved successfully!")
    except ImportError:
        print("  ⚠️ faster-whisper is not installed! Run: pip install faster-whisper")
    except Exception as e:
        print(f"  ⚠️ Faster-Whisper download note: {e}")

def verify_local_storage():
    """Verifies that all required model assets exist locally in models/omnivoice/."""
    print(f"\n[*] Step 4: Verifying local model files in '{OMNIVOICE_DIR}'...")
    required_files = [
        "config.json",
        "model.safetensors",
        "tokenizer.json",
        "tokenizer_config.json",
    ]
    all_ok = True
    total_size = 0

    print("-" * 65)
    print(f"  {'File Name':<35} {'Size (MB)':>12}  {'Status':<8}")
    print("-" * 65)

    for rf in required_files:
        p = OMNIVOICE_DIR / rf
        if p.exists():
            size_mb = p.stat().st_size / (1024 * 1024)
            total_size += size_mb
            print(f"  {rf:<35} {size_mb:>10.2f} MB  ✓ OK")
        else:
            print(f"  {rf:<35} {'MISSING':>12}  ❌")
            all_ok = False

    audio_tok = OMNIVOICE_DIR / "audio_tokenizer" / "model.safetensors"
    if audio_tok.exists():
        size_mb = audio_tok.stat().st_size / (1024 * 1024)
        total_size += size_mb
        print(f"  {'audio_tokenizer/model.safetensors':<35} {size_mb:>10.2f} MB  ✓ OK")
    else:
        print(f"  {'audio_tokenizer/model.safetensors':<35} {'MISSING':>12}  ❌")
        all_ok = False

    print("-" * 65)
    print(f"  Total Local Model Storage: {total_size:.2f} MB ({total_size / 1024:.2f} GB)")

    if all_ok:
        print("\n  🎉 All OmniVoice local model files verified successfully in your storage!")
    else:
        print("\n  ⚠️ Some files appear missing or incomplete.")
    return all_ok

def main():
    print("=" * 65)
    print("   🎙️  OMNIVOICE STUDIO - LOCAL MODEL DOWNLOADER")
    print("=" * 65)
    
    verify_online_model_link()
    download_omnivoice_model()
    download_whisper_model()
    success = verify_local_storage()

    print("\n" + "=" * 65)
    if success:
        print("   ✓ SETUP COMPLETE: Local model is ready to use offline!")
        print(f"   Stored at: {OMNIVOICE_DIR}")
    else:
        print("   ⚠️ SETUP INCOMPLETE: Check errors above.")
    print("=" * 65)

if __name__ == "__main__":
    main()
