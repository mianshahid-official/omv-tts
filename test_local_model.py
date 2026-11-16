"""
Test script to verify loading the OmniVoice model from the local models/ directory
and synthesizing speech locally.
"""
import sys
import time
from pathlib import Path

# Add project root to sys.path
BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))

from omnivoice_engine import synthesize_voice_design, OMNIVOICE_MODEL_DIR

def run_test():
    print("=" * 60)
    print("  TESTING LOCAL OMNIVOICE MODEL INFERENCE")
    print("=" * 60)
    print(f"[*] Local models directory: {OMNIVOICE_MODEL_DIR}")
    if not (OMNIVOICE_MODEL_DIR / "model.safetensors").exists():
        print("❌ Error: Local model.safetensors not found in models/omnivoice!")
        sys.exit(1)
    
    print("✓ Local model weights confirmed on disk.")
    
    text = "Hello! OmniVoice is successfully running from the local storage model folder."
    instruct = "male, warm, clear, professional tone"
    output_path = str(BASE_DIR / "output" / "test_local_synth.wav")
    
    print(f"\n[*] Text to synthesize: '{text}'")
    print(f"[*] Voice instruction: '{instruct}'")
    print(f"[*] Output destination: {output_path}")
    print("\n[*] Starting local model loading and synthesis (CPU)...")
    
    start_time = time.time()
    saved_path = synthesize_voice_design(
        text=text,
        instruct=instruct,
        output_path=output_path,
        num_step=8,  # Fast inference for test
    )
    elapsed = time.time() - start_time
    
    out_file = Path(saved_path)
    if out_file.exists() and out_file.stat().st_size > 0:
        print("\n" + "=" * 60)
        print("  🎉 LOCAL MODEL INFERENCE TEST PASSED!")
        print("=" * 60)
        print(f"✓ Output file: {out_file.name}")
        print(f"✓ File size: {out_file.stat().st_size / 1024:.2f} KB")
        print(f"✓ Total synthesis time: {elapsed:.2f}s")
        print(f"✓ File location: {out_file}")
        print("✓ Local OmniVoice engine is fully operational!")
    else:
        print("❌ Error: Output file was not generated or is empty.")
        sys.exit(1)

if __name__ == "__main__":
    run_test()
