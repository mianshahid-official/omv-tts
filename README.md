# OmniVoice Studio - AI Voice Generator & Neural TTS Suite

A complete AI voice synthesis studio powered by [`k2-fsa/OmniVoice`](https://huggingface.co/k2-fsa/OmniVoice) with zero character cutoffs, high-fidelity 24 kHz audio, word-level subtitle alignment (`.srt`), and precise timestamps (`.json`).

Supports **two execution modes**:
1. **Local Free Offline Studio:** Runs 100% locally on your PC (CPU or NVIDIA CUDA GPU) using local neural weights in `models/omnivoice`.
2. **Modal Cloud T4 GPU Studio:** Ultra-fast remote cloud synthesis with multi-script bulk narration support.

---

## 🚀 Quick Start (Windows)

### Option A: Automated 1-Click Setup (Recommended for New PCs)
Double-click:
```bash
install.bat
```
This automatically:
1. Verifies your Python environment (Python 3.10 – 3.12).
2. Installs all required packages (`requirements.txt` + `requirements-local.txt`).
3. Downloads the `k2-fsa/OmniVoice` neural model weights directly into `models/omnivoice/`.
4. Launches the **Local Free Studio** immediately!

---

### Option B: Launching After Setup

| File | Mode | Description |
|---|---|---|
| **`run.bat`** | **Local Free Studio** | 100% free local CPU/GPU neural synthesis (`http://127.0.0.1:8000`) |
| **`run_modal_gui.bat`** | **Modal Cloud Studio** | Remote Modal Cloud T4 GPU synthesis with bulk mode (`http://127.0.0.1:8001`) |

---

## ⚡ High-Performance Bulk Narration (Modal Cloud GPU)

For synthesizing multiple scripts (e.g. YouTube shorts, audiobooks, long stories):

### 1. In Desktop GUI
* Launch `run_modal_gui.bat` &rarr; click **"Bulk Narration Mode"**.
* Drop or select multiple `.txt` script files.
* Click **"Synthesize All on Modal (T4 GPU)"**.
* **Pipelined Execution:** Script 1 is verified and its 4 files saved immediately; then all remaining scripts process simultaneously!

### 2. From Command Line
```bash
python run_bulk_modal.py --dir "scripts/zombie_survival" --voice "narrator-deep-en" --concurrency 3
```
As each script completes, it immediately saves all 4 files locally:
- `speech.mp3` (Master audio)
- `speech.srt` (Whisper word-level subtitles)
- `speech.json` (Word timestamps & duration)
- `script.txt` (Original script text)

---

## 📁 Repository Structure

```
├── install.bat               # 1-click Windows automated installer & model setup
├── run.bat                   # 1-click launcher for Local Free Studio (Port 8000)
├── run_modal_gui.bat         # 1-click launcher for Modal Cloud GPU Studio (Port 8001)
├── desktop_app.py            # Local desktop GUI launcher (WebView2 + browser fallback)
├── modal_studio_gui.py       # Modal Cloud desktop GUI bridge & bulk runner
├── modal_app.py              # Modal Cloud T4 GPU deployment definition
├── run_bulk_modal.py         # High-performance bulk script synthesizer (CLI)
├── download_models.py        # Local neural model downloader & storage manager
├── omnivoice_engine.py       # Core wrapper for k2-fsa/OmniVoice with progress tracking
├── server.py                 # FastAPI backend for local TTS, cloning & alignment
├── requirements.txt          # Core desktop & Modal dependencies
├── requirements-local.txt    # PyTorch & OmniVoice local offline dependencies
├── presets/
│   ├── presets.json          # Catalog of voices (cloned & designed)
│   ├── audio/                # Reference audio clips for voice auditioning
│   └── avatars/              # SVG voice avatars
├── static/                   # Local Studio frontend web assets
└── modal_gui/                # Modal Cloud Studio frontend web assets
```

---

## 🛠️ Requirements & Environment

- **Python**: 3.10 – 3.12 (64-bit with "Add Python to PATH" checked)
- **PyTorch**: 2.2+ (CPU or CUDA)
- **Neural Model**: `k2-fsa/OmniVoice` (stored in `models/omnivoice/`)
- **Speech Alignment**: `faster-whisper` base model
- **Desktop UI**: Edge WebView2 (with automatic default browser fallback)
