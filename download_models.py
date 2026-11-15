"""
OmniVoice Studio - Local Model Weights Pre-Downloader
Downloads k2-fsa/OmniVoice and Faster-Whisper base model to local HuggingFace cache.
Only needed if you plan to run local neural synthesis without Modal Cloud GPU.
"""

import sys

def main():
    print("=" * 65)
    print("   📥 OMNIVOICE STUDIO - MODEL ASSET DOWNLOADER")
    print("=" * 65)
    print("This will download neural model weights for offline local synthesis.\n")

    # 1. Download k2-fsa/OmniVoice from HuggingFace Hub
    print(">>> [1/2] Downloading 'k2-fsa/OmniVoice' weights from HuggingFace...")
    try:
        from huggingface_hub import snapshot_download
        cached_path = snapshot_download(
            repo_id="k2-fsa/OmniVoice",
            resume_download=True,
        )
        print(f"✓ k2-fsa/OmniVoice downloaded successfully to cache:\n  {cached_path}")
    except ImportError:
        print("⚠️ huggingface_hub is not installed! Run: pip install huggingface_hub")
    except Exception as e:
        print(f"❌ Error downloading OmniVoice weights: {e}")

    # 2. Download Faster-Whisper base model
    print("\n>>> [2/2] Downloading 'faster-whisper' base model...")
    try:
        from faster_whisper import WhisperModel
        WhisperModel("base", device="cpu", compute_type="int8")
        print("✓ Faster-Whisper base model cached successfully!")
    except ImportError:
        print("⚠️ faster-whisper is not installed! Run: pip install faster-whisper")
    except Exception as e:
        print(f"❌ Error downloading Faster-Whisper model: {e}")

    print("\n" + "=" * 65)
    print("   🎉 MODEL DOWNLOAD CHECK COMPLETED!")
    print("=" * 65)

if __name__ == "__main__":
    main()
