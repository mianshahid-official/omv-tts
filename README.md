# OmniVoice Studio - Local Desktop Speech & Zero-Shot Cloning Suite

A local, unrestricted desktop application (`pywebview`) powered **strictly and exclusively** by [`k2-fsa/OmniVoice`](https://huggingface.co/k2-fsa/OmniVoice). Zero cloud APIs, zero character cutoffs, zero telemetry, and zero dummy/mock voice engines.

Includes real-time neural speech generation, voice design from descriptive prompts, permanent zero-shot voice cloning from clean reference audio, and automatic word-level transcription with `.srt` subtitle generation via `faster-whisper`.

---

## 🚀 Quick Start

### 1. Launch the Desktop Application
Double-click `run.bat` or run from PowerShell / Command Prompt:
```bash
python desktop_app.py
```
This opens the native standalone studio window (Edge Chromium) with dark studio aesthetics, live karaoke synchronization, and full preset management.

### 2. Download & Register Site Presets
To re-fetch or update recorded reference samples from `omni-voice.app` and auto-transcribe them with Whisper:
```bash
python download_site_presets.py
```

### 3. Batch Generate Voice Previews
To re-generate 24 kHz sample previews for all Voice Design presets directly from the local OmniVoice model:
```bash
python generate_preset_samples.py
```

---

## 🎯 Core Features & Preset Library

### 1. 100% Real Neural Inference (`k2-fsa/OmniVoice`)
- **No Mock or Random Engines**: All speech is synthesized directly through the local OmniVoice diffusion transformer at 24,000 Hz.
- **Hardware Acceleration**: Automatically selects CUDA FP16 if an NVIDIA GPU is available, or executes cleanly on CPU with FP32.
- **Optimized CPU Steps**: Configured with `num_step=12` for responsive local generation (~35–50s on CPU) without compromising audio quality.

### 2. Public Voice Clones (Downloaded from `omni-voice.app`)
The 20 public voice profiles from `omni-voice.app` have been downloaded in MP3 format, transcribed word-for-word using `faster-whisper`, and registered as permanent zero-shot cloning presets (`ref_audio` + `ref_text`) for our local OmniVoice model:

| Voice Name | Gender | Reference Audio File | Whisper Reference Transcript (Excerpt) |
|---|---|---|---|
| **Elon Musk** | Male | `presets/audio/site-anyvoice-home-en-01-03397b4c.mp3` | *"So, the key to effective noise reduction is understanding signal processing at a fundamental level..."* |
| **SpongeBob SquarePants** | Female | `presets/audio/site-anyvoice-home-en-02-9845e056.mp3` | *"Oh, barnacles! What a fantastic day to be a fried cook! The crusty crab is super-duper busy..."* |
| **Donald J. Trump** | Male | `presets/audio/site-anyvoice-home-en-03-5196af35.mp3` | *"Folks, nobody knows noise better than me. Believe me. These other companies, they're terrible..."* |
| **Trump** | Male | `presets/audio/site-anyvoice-home-en-04-e58b0d7e.mp3` | *"Folks, we're doing things nobody thought possible. The economy, tremendous numbers..."* |
| **Friendly Women** | Female | `presets/audio/site-anyvoice-home-en-05-b545c585.mp3` | *"Hey there fabulous AI enthusiasts as anonymous sparkle on TTS Arena..."* |
| **Energetic Male** | Male | `presets/audio/site-anyvoice-home-en-06-802e3bc2.mp3` | *"Hey there, after months of intensive development, Fish Audio 1.5 has just launched..."* |
| **Adam** | Male | `presets/audio/site-anyvoice-home-en-07-9259a739.mp3` | *"Bro, let me tell you how to handle your first date. Three things you need..."* |
| **Billy Graham 2** | Male | `presets/audio/site-anyvoice-home-en-08-15899a4e.mp3` | *"My friends, when we open our hearts to God's Word, we find wisdom for every challenge..."* |
| **ALLE** | Female | `presets/audio/site-anyvoice-home-en-09-59e9dc1c.mp3` | *"Okay, you guys literally need to see this new foundation brush. I found it's so incredibly soft..."* |
| **The Elephant** | Male | `presets/audio/site-anyvoice-home-en-10-0cd6cf96.mp3` | *"They say an elephant never forgets, what they don't tell you is you never forget an elephant."* |
| **mrbeast** | Male | `presets/audio/site-anyvoice-home-en-11-cc1d2d26.mp3` | *"Guys, I'm about to do something insane. I'm giving $100,000 to whoever can stay in this circle..."* |
| **weird** | Male | `presets/audio/site-anyvoice-home-en-12-238f3219.mp3` | *"Get ready for the ultimate sound experience. DJ Weird is on the decks dropping the hottest tracks..."* |
| **Trump (Alternate)** | Male | `presets/audio/site-anyvoice-home-en-13-010da99c.mp3` | *"Listen folks, the fake media, they're saying terrible things, but we're winning big..."* |
| **American audio-female** | Female | `presets/audio/site-anyvoice-home-en-14-2a9605ee.mp3` | *"Sometimes I think about how we chase these perfect moments, but it's actually the messy parts..."* |
| **horror** | Male | `presets/audio/site-anyvoice-home-en-15-ef9c79b6.mp3` | *"During the winter of 1985, residents of a small main town reported seeing shadowy figures..."* |
| **E-Girl** | Female | `presets/audio/site-anyvoice-home-en-16-98655a12.mp3` | *"Hey, why are you sitting here all alone in the corner? Come on, let me sit next to you..."* |
| **Voice DL** | Male | `presets/audio/site-anyvoice-home-en-17-19363330.mp3` | *"Think about the last time someone tried to rush you into a decision, pushing for an immediate response..."* |
| **Venti** | Female | `presets/audio/site-anyvoice-home-en-18-e34c4869.mp3` | *"Huh, what a splendid breeze today! Perfect for a new melody I've been composing..."* |
| **American audio-male** | Male | `presets/audio/site-anyvoice-home-en-19-470bba6a.mp3` | *"Everyone thought this guy was crazy when he started solving the puzzle backwards..."* |
| **Alhaitham** | Male | `presets/audio/site-anyvoice-home-en-20-92a26002.mp3` | *"The data clearly indicates a correlation between these phenomena, though further investigation is warranted..."* |

When you select any of these voices, the local OmniVoice zero-shot cloning engine (`omnivoice_engine.synthesize_voice_clone`) executes locally using the reference audio and exact transcript.

### 3. Multi-Language Voice Design Presets (6 Core Languages)
Native language presets synthesized directly from `k2-fsa/OmniVoice`:

| ID | Language | Name | Gender | Accent | Audio File |
|---|---|---|---|---|---|
| `narrator-deep-en` | 🇺🇸 English (`en`) | Narrator Deep | Male | American | `presets/audio/narrator-deep-en.wav` |
| `warm-storyteller-en` | 🇺🇸 English (`en`) | Warm Storyteller | Female | American | `presets/audio/warm-storyteller-en.wav` |
| `british-academic-en` | 🇬🇧 English (`en`) | British Academic | Male | British | `presets/audio/british-academic-en.wav` |
| `narrador-es` | 🇪🇸 Español (`es`) | Narrador Profesional | Male | American | `presets/audio/narrador-es.wav` |
| `femenina-calida-es` | 🇪🇸 Español (`es`) | Voz Femenina Cálida | Female | American | `presets/audio/femenina-calida-es.wav` |
| `hindi-male-narrator-hi` | 🇮🇳 हिंदी (`hi`) | हिंदी पुरुष कथावाचक | Male | Indian | `presets/audio/hindi-male-narrator-hi.wav` |
| `hindi-female-voice-hi` | 🇮🇳 हिंदी (`hi`) | हिंदी महिला स्वर | Female | Indian | `presets/audio/hindi-female-voice-hi.wav` |
| `urdu-male-voice-ur` | 🇵🇰 اردو (`ur`) | اردو مردانہ صدا کار | Male | Indian | `presets/audio/urdu-male-voice-ur.wav` |
| `urdu-female-voice-ur` | 🇵🇰 اردو (`ur`) | اردو نسوانی آواز | Female | Indian | `presets/audio/urdu-female-voice-ur.wav` |
| `narrateur-fr` | 🇫🇷 Français (`fr`) | Narrateur Français | Male | American | `presets/audio/narrateur-fr.wav` |
| `voix-douce-fr` | 🇫🇷 Français (`fr`) | Voix Douce | Female | American | `presets/audio/voix-douce-fr.wav` |
| `deutscher-sprecher-de` | 🇩🇪 Deutsch (`de`) | Deutscher Sprecher | Male | American | `presets/audio/deutscher-sprecher-de.wav` |
| `deutsche-erzaehlerin-de` | 🇩🇪 Deutsch (`de`) | Deutsche Erzählerin | Female | American | `presets/audio/deutsche-erzaehlerin-de.wav` |

### 4. Custom Zero-Shot Voice Cloning
- Upload or record your own clean 3–15 second audio reference (`.wav` or `.mp3`).
- **Auto-Transcription**: If the transcript is left blank, the local Whisper model automatically transcribes the reference clip.
- Save the clone as a permanent preset with a custom name.
- Reuse your cloned preset at any time to synthesize arbitrary new text.

### 5. Dedicated Folder per Conversion (`.mp3`, `.json`, `.srt`)
For every single TTS synthesis, OmniVoice creates a dedicated, organized conversion folder inside `output/`:
- **Folder Naming**: `<first_few_words>_<YYYY-MM-DD_HH-MM-SS>` (e.g. `Two_thousand_years_ago_across_2026-10-08_00-20-42/`).
- **All Three Output Assets Inside**:
  - `speech.mp3`: High-fidelity, broadcast-ready master audio track.
  - `speech.srt`: Accurate SRT subtitle file with formatted timestamp blocks.
  - `speech.json`: Word-level millisecond timestamps (start, end, confidence probability) for every word spoken.
  - `speech.wav`: Uncompressed 24,000 Hz master audio.

### 6. Real-Time CPU Progress Indicators
Since loading neural models on CPU takes time, OmniVoice Studio features a real-time progress dashboard:
- **Model Loading Percentage**: Tracks live PyTorch tensor loading (`X/313 (Y%)`) into CPU RAM with smooth status reporting.
- **Header Status Pill**: Dynamic navbar pill displaying real-time engine states (`🟡 Loading OmniVoice: 42%`, `🟢 OmniVoice Ready`, `⚡ Synthesizing: Step 7/12`).
- **Diffusion Step Tracker**: Displays real-time flow-matching steps (`Step 1/12` ... `12/12`), elapsed time ticker, and audio latency.
- **5-Stage Visual Milestone Pipeline**:
  `🧠 Model Ready` ➔ `📝 Tokenize` ➔ `⚡ 12x Diffusion` ➔ `🎵 Master MP3` ➔ `💬 Whisper Subtitles`

### 7. Extensive 108+ Voice Presets Library
Over 108 curated voices are permanently registered in `presets/presets.json`:
- **Famous & Celebrities**: Elon Musk, Donald Trump, SpongeBob, MrBeast, Gossip Girl, and more.
- **Long Storytellers & History Narrators**: Sleepless Historian, Boring History for Sleep, Sleep History, Hunter x Hunter Narrator, Wigman Deeper Quality, Deep Voice.
- **Kids & Animation**: Anime voices, E-Girl, Pretty Girl, Game Announcers.
- **YouTube Creators & Podcasts**: Energetic Male, Friendly Women, Studio Voices, Trap Holics, Producer Tags.
- **Multi-lingual Voice Design**: Native English, Spanish, Hindi, Urdu, French, and German presets.

---

## ⚡ Modal Cloud T4 GPU Edition

You can offload heavy neural synthesis to **Modal Cloud** (`jackharbour799`) on an NVIDIA T4 GPU for ultra-fast, unrestricted speech generation:

### 1. Active Deployment Endpoint
- **Modal App Name**: `omnivoice-studio`
- **Online Endpoint URL**: [`https://jackharbour799--omnivoice-studio-fastapi-app.modal.run`](https://jackharbour799--omnivoice-studio-fastapi-app.modal.run)
- **Deployment Management**: [Modal Dashboard: `jackharbour799/omnivoice-studio`](https://modal.com/apps/jackharbour799/main/deployed/omnivoice-studio)
- **Hardware Profile**: NVIDIA T4 GPU · 32 Flow-Matching Diffusion Steps · FP16 Precision
- **Model Baking**: Both `k2-fsa/OmniVoice` and `faster-whisper` are pre-cached in the container image layer for instantaneous container startup.

### 2. Launch the Modal Desktop GUI
Double-click `run_modal_gui.bat` or run:
```bash
python modal_studio_gui.py
```
This launches the **OmniVoice Studio - Modal Cloud GPU Edition** desktop interface:
- **Editable Modal URL**: Switch endpoints dynamically in the top navigation bar with a live **Ping / Test** connection badge.
- **Local Auditioning**: Preview all 108 voice samples (`presets/audio/`) with 0ms local latency before finalizing your narrator.
- **T4 GPU Cloud Synthesis**: Dispatches your script directly to the remote Modal T4 GPU endpoint.
- **3 Delivered Files Saved Locally**: Automatically downloads `speech.mp3`, `speech.srt`, and `speech.json` into your local `output/<first_words>_<timestamp>/` directory.
- **Live Synchronized Karaoke**: Scrubber and word-level karaoke player automatically loads the generated audio with millisecond highlight synchronization.
- **"Open in Explorer" Button**: 1-click button to reveal the conversion folder in Windows File Explorer.

### 3. Tested Verification Results (History Narrator)
A 452-character long script was synthesized on the live Modal T4 GPU endpoint using the **Narrator Deep (English)** voice:
- **Synthesis Duration**: 13.68 seconds total on Modal T4 GPU (for 28.02 seconds of spoken audio).
- **Words Aligned**: 68 words with accurate millisecond boundaries.
- **Local Files Generated**:
  - `output/In_the_shadowed_corridors_of_2026-10-08_08-17-13/speech.mp3` (268,272 bytes)
  - `output/In_the_shadowed_corridors_of_2026-10-08_08-17-13/speech.srt` (1,088 bytes)
  - `output/In_the_shadowed_corridors_of_2026-10-08_08-17-13/speech.json` (8,106 bytes)

---

## 📁 Repository Structure

```
├── run_modal_gui.bat         # 1-click Windows launcher for Modal Cloud GUI
├── modal_studio_gui.py       # Desktop GUI bridge & local audition server (Port 8001)
├── modal_app.py              # Modal Cloud T4 GPU deployment definition
├── test_modal_online.py      # Automated verification test against online Modal app
├── modal_gui/                # Modal Studio GUI frontend (HTML, CSS, JS)
│   ├── index.html            # Split studio layout with Modal gateway bar
│   ├── style.css             # Signal lime & dark glassmorphism design system
│   └── app.js                # Voice auditioning, Modal API dispatch & karaoke engine
├── desktop_app.py            # Local CPU/GPU pywebview desktop GUI launcher
├── server.py                 # FastAPI backend (TTS, Voice Design, Cloning, Progress & Whisper)
├── omnivoice_engine.py       # Core wrapper for k2-fsa/OmniVoice with live progress hooks
├── generate_preset_samples.py# Real OmniVoice batch Voice Design generator
├── harvest_and_transcribe_voices.py # 108-voice harvester & Whisper transcriber
├── export_chat_history.py    # Extracts full chat transcript to chat_history.txt
├── run.bat                   # 1-click Windows launcher for local CPU engine
├── chat_history.txt          # Complete conversation history & technical audit log
├── presets/
│   ├── presets.json          # Master presets list (108 Design & Clone models)
│   └── audio/                # 24 kHz WAV and reference MP3 audio files
├── data/
│   └── history.json          # Synthesis history log
├── output/                   # Dedicated conversion folders (<first_words>_<timestamp>/)
│   └── <words>_<timestamp>/  # Contains speech.mp3, speech.json, speech.srt
└── static/                   # Local CPU studio frontend
```

---

## 🛠️ Requirements & Environment

- **Python**: 3.10 – 3.14
- **PyTorch**: 2.0+ with Torchaudio
- **OmniVoice**: `k2-fsa/OmniVoice` (Hugging Face cached snapshot)
- **Faster-Whisper**: `faster-whisper` base model
- **Desktop GUI**: `pywebview` (Edge WebView2)
- **Modal Client**: `modal` 1.5+ (authenticated with `jackharbour799`)
