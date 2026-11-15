/**
 * OmniVoice Studio - Local Desktop Speech & Zero-Shot Cloning Suite
 * Matches the split-column studio layout, unified master card, draggable column splitter,
 * real-time progress monitor, and full-width live synchronized subtitles from the Modal GUI.
 */

// ============================================================================
// STATE STORE
// ============================================================================
const state = {
  presets: [],
  selectedPreset: null,
  activeCategory: "all",
  searchQuery: "",
  languageFilter: "all",
  
  // Audio Playback
  currentPlayingVoiceId: null,
  isAuditioning: false,
  audioDuration: 0,
  currentWords: [],
  playbackSpeed: 1.0,
  pitchOffset: 0,
  
  // Web Audio Nodes
  audioCtx: null,
  sourceNode: null,
  bassFilter: null,
  trebleFilter: null,

  // Conversion state
  isConverting: false,
  lastFolder: null,
  progressInterval: null,
  conversionStartTime: 0
};

// DOM References
const dom = {
  engineStatusPill: document.getElementById("engine-status-pill"),
  engineStatusDot: document.getElementById("engine-status-dot"),
  engineStatusText: document.getElementById("engine-status-text"),
  engineHardwareBadge: document.getElementById("engine-hardware-badge"),
  statVoiceCount: document.getElementById("stat-voice-count"),
  
  studioContainer: document.getElementById("studio-container"),
  studioResizer: document.getElementById("studio-resizer"),
  voiceCatalogPanel: document.getElementById("voice-catalog-panel"),
  voiceSearchInput: document.getElementById("voice-search-input"),
  voiceLangFilter: document.getElementById("voice-lang-filter"),
  voicesList: document.getElementById("voices-list"),
  
  selNarratorAvatar: document.getElementById("sel-narrator-avatar"),
  selNarratorType: document.getElementById("sel-narrator-type"),
  selNarratorLang: document.getElementById("sel-narrator-lang"),
  selNarratorGender: document.getElementById("sel-narrator-gender"),
  selNarratorName: document.getElementById("sel-narrator-name"),
  selNarratorDesc: document.getElementById("sel-narrator-desc"),
  btnAuditionSelected: document.getElementById("btn-audition-selected"),
  iconAuditionSelected: document.getElementById("icon-audition-selected"),
  labelAuditionSelected: document.getElementById("label-audition-selected"),
  
  ttsTextInput: document.getElementById("tts-text-input"),
  textCounter: document.getElementById("text-counter"),
  sliderSpeed: document.getElementById("slider-speed"),
  valSpeed: document.getElementById("val-speed"),
  sliderPitch: document.getElementById("slider-pitch"),
  valPitch: document.getElementById("val-pitch"),
  selectLang: document.getElementById("select-lang"),
  selectSteps: document.getElementById("select-steps"),
  valSteps: document.getElementById("val-steps"),
  
  btnConvertLocal: document.getElementById("btn-convert-local"),
  btnConvertText: document.getElementById("btn-convert-text"),
  
  progressBox: document.getElementById("progress-box"),
  progressStageTitle: document.getElementById("progress-stage-title"),
  progressStepPill: document.getElementById("progress-step-pill"),
  progressDetailText: document.getElementById("progress-detail-text"),
  progressPercent: document.getElementById("progress-percent"),
  progressTimer: document.getElementById("progress-timer"),
  progressBarFill: document.getElementById("progress-bar-fill"),
  stepConnect: document.getElementById("step-connect"),
  stepDiffuse: document.getElementById("step-diffuse"),
  stepMp3: document.getElementById("step-mp3"),
  stepSrt: document.getElementById("step-srt"),
  stepJson: document.getElementById("step-json"),
  
  resultCard: document.getElementById("result-card"),
  resultFolderPath: document.getElementById("result-folder-path"),
  linkDownloadMp3: document.getElementById("link-download-mp3"),
  fileSizeMp3: document.getElementById("file-size-mp3"),
  linkDownloadWav: document.getElementById("link-download-wav"),
  fileSizeWav: document.getElementById("file-size-wav"),
  linkDownloadSrt: document.getElementById("link-download-srt"),
  fileSizeSrt: document.getElementById("file-size-srt"),
  linkDownloadJson: document.getElementById("link-download-json"),
  fileSizeJson: document.getElementById("file-size-json"),
  
  workspaceSubtitlesPanel: document.getElementById("workspace-subtitles-panel"),
  playerKaraokeViewport: document.getElementById("player-karaoke-viewport"),
  playerKaraokeText: document.getElementById("player-karaoke-text"),
  subtitlesStatusMeta: document.getElementById("subtitles-status-meta"),
  
  playerThumb: document.getElementById("player-thumb"),
  playerTitle: document.getElementById("player-title"),
  playerSubtitle: document.getElementById("player-subtitle"),
  playerPlayBtn: document.getElementById("player-play-btn"),
  playerPlayIcon: document.getElementById("player-play-icon"),
  playerTimeCurr: document.getElementById("player-time-curr"),
  playerTimeTotal: document.getElementById("player-time-total"),
  playerScrubberFill: document.getElementById("player-scrubber-fill"),
  playerScrubberTrack: document.getElementById("player-scrubber-track"),
  
  historyDrawer: document.getElementById("history-drawer"),
  historyDrawerOverlay: document.getElementById("history-drawer-overlay"),
  historyList: document.getElementById("history-list"),
  
  audioEngine: document.getElementById("audio-engine"),
  toastContainer: document.getElementById("toast-container"),
};

// ============================================================================
// INITIALIZATION
// ============================================================================
document.addEventListener("DOMContentLoaded", async () => {
  // 1. Setup draggable column resize splitter
  setupColumnResizer();

  // 2. Setup text counter listener
  dom.ttsTextInput.addEventListener("input", updateTextCount);
  updateTextCount();

  // 3. Setup audio listeners
  setupAudioListeners();

  // 4. Load presets catalog
  await loadPresetsCatalog();

  // 5. Poll local engine status
  checkEngineStatus();
  setInterval(checkEngineStatus, 4000);
});

// ============================================================================
// DRAGGABLE COLUMN SPLITTER
// ============================================================================
function setupColumnResizer() {
  const container = dom.studioContainer;
  const resizer = dom.studioResizer;
  if (!container || !resizer) return;

  const savedWidth = localStorage.getItem("omnivoice_local_catalog_width");
  if (savedWidth) {
    container.style.setProperty("--catalog-width", `${savedWidth}px`);
  }

  let isDragging = false;

  resizer.addEventListener("mousedown", (e) => {
    isDragging = true;
    resizer.classList.add("is-dragging");
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    e.preventDefault();
  });

  window.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    const containerRect = container.getBoundingClientRect();
    const newWidth = e.clientX - containerRect.left;
    // Clamp width between 300px and 720px
    const clampedWidth = Math.max(300, Math.min(newWidth, 720));
    container.style.setProperty("--catalog-width", `${clampedWidth}px`);
    localStorage.setItem("omnivoice_local_catalog_width", clampedWidth);
  });

  window.addEventListener("mouseup", () => {
    if (isDragging) {
      isDragging = false;
      resizer.classList.remove("is-dragging");
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }
  });
}

// ============================================================================
// ENGINE STATUS MONITOR
// ============================================================================
async function checkEngineStatus() {
  if (state.isConverting) return;
  try {
    const res = await fetch("/api/progress");
    if (!res.ok) return;
    const data = await res.json();
    
    if (data.hardware) {
      dom.engineHardwareBadge.textContent = data.hardware;
    }

    if (data.status === "loading_model") {
      dom.engineStatusDot.className = "status-pulse-dot busy";
      dom.engineStatusText.textContent = `Loading OmniVoice (${data.percent || 35}%)...`;
    } else if (data.status === "converting") {
      dom.engineStatusDot.className = "status-pulse-dot busy";
      dom.engineStatusText.textContent = "OmniVoice Synthesizing...";
    } else {
      dom.engineStatusDot.className = "status-pulse-dot ready";
      dom.engineStatusText.textContent = "OmniVoice Local Engine Ready";
    }
  } catch (err) {
    // Engine offline or busy
  }
}

// ============================================================================
// PRESETS CATALOG & AUDITION
// ============================================================================
async function loadPresetsCatalog() {
  try {
    const res = await fetch("/api/presets");
    const data = await res.json();
    state.presets = data.presets || [];
    dom.statVoiceCount.textContent = state.presets.length;

    // Default select History Narrator or first preset
    const defaultVoice = state.presets.find(p => p.id === "narrator-deep-en" || p.id.includes("story") || p.id.includes("narrator")) || state.presets[0];
    if (defaultVoice) {
      selectVoice(defaultVoice, false);
    }
    renderVoiceList();
  } catch (err) {
    console.error("Failed loading presets:", err);
    showToast("Could not load presets list. Ensure local server is running.", "error");
  }
}

function filterCategory(cat) {
  state.activeCategory = cat;
  document.querySelectorAll(".cat-tab").forEach(tab => {
    tab.classList.toggle("active", tab.dataset.cat === cat);
  });
  renderVoiceList();
}

function renderVoiceList() {
  const query = (dom.voiceSearchInput.value || "").toLowerCase().trim();
  const lang = dom.voiceLangFilter.value;
  
  const filtered = state.presets.filter(p => {
    // Language check
    if (lang !== "all" && p.lang !== lang) return false;
    
    // Category check
    if (state.activeCategory !== "all") {
      const name = (p.name || "").toLowerCase();
      const desc = (p.description || "").toLowerCase();
      const id = (p.id || "").toLowerCase();
      const instruct = (p.instruct || "").toLowerCase();
      
      if (state.activeCategory === "cloned") {
        const isCloned = p.type === "cloned" || id.startsWith("clone-");
        if (!isCloned) return false;
      } else if (state.activeCategory === "history") {
        const isHistory = id.includes("narrator") || id.includes("story") || name.includes("narrator") || name.includes("story") || desc.includes("history") || desc.includes("documentary") || instruct.includes("deep") || name.includes("graham") || name.includes("academic");
        if (!isHistory) return false;
      } else if (state.activeCategory === "famous") {
        const isFamous = name.includes("musk") || name.includes("trump") || name.includes("graham") || name.includes("adam") || p.avatar?.includes("public-figures");
        if (!isFamous) return false;
      } else if (state.activeCategory === "youtube") {
        const isYt = name.includes("energetic") || name.includes("friendly") || name.includes("adam") || desc.includes("youtube") || desc.includes("creator");
        if (!isYt) return false;
      } else if (state.activeCategory === "kids") {
        const isKids = name.includes("spongebob") || name.includes("anime") || name.includes("cartoon") || desc.includes("kids");
        if (!isKids) return false;
      } else if (state.activeCategory === "multilingual") {
        if (p.lang === "en") return false;
      }
    }
    
    // Search query
    if (query) {
      const match = (p.name || "").toLowerCase().includes(query)
        || (p.description || "").toLowerCase().includes(query)
        || (p.lang || "").toLowerCase().includes(query)
        || (p.gender || "").toLowerCase().includes(query)
        || (p.instruct || "").toLowerCase().includes(query);
      if (!match) return false;
    }
    
    return true;
  });

  if (filtered.length === 0) {
    dom.voicesList.innerHTML = `
      <div style="text-align:center; padding: 2.5rem 1rem; color: #64748B;">
        <p style="font-size:0.9rem; font-weight:600;">No voices match your search</p>
        <p style="font-size:0.75rem; margin-top:0.35rem;">Try another search term or reset filters</p>
      </div>`;
    return;
  }

  dom.voicesList.innerHTML = filtered.map(preset => {
    const isSelected = state.selectedPreset && state.selectedPreset.id === preset.id;
    const isPlaying = state.currentPlayingVoiceId === preset.id && !dom.audioEngine.paused;
    const avatarUrl = getVoiceAvatar(preset);
    const typeLabel = preset.type === "cloned" ? "Zero-Shot Clone" : "Voice Design";

    return `
      <div class="voice-card ${isSelected ? 'selected' : ''}" onclick="selectVoiceById('${preset.id}', true)">
        <img class="voice-card-avatar" src="${avatarUrl}" alt="${escapeHtml(preset.name)}" onerror="this.src='/presets/avatars/narrator-deep-en.svg'">
        <div class="voice-card-info">
          <div class="voice-card-name-row">
            <span class="voice-card-name">${escapeHtml(preset.name)}</span>
            <span class="voice-card-type-tag">${typeLabel}</span>
          </div>
          <div class="voice-card-meta">
            <span>${(preset.lang || 'EN').toUpperCase()}</span>
            <span>·</span>
            <span>${preset.gender || 'Narrator'}</span>
          </div>
          <div class="voice-card-desc">${escapeHtml(preset.description || preset.instruct || '')}</div>
        </div>
        <div class="voice-card-actions">
          <button type="button" class="btn-card-audition ${isPlaying ? 'playing' : ''}" onclick="auditionVoiceById('${preset.id}', event)" title="Audition Sample Audio">
            ${isPlaying 
              ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`
              : `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`
            }
          </button>
        </div>
      </div>
    `;
  }).join("");
}

function selectVoiceById(voiceId, autoScroll = false) {
  const preset = state.presets.find(p => p.id === voiceId);
  if (preset) selectVoice(preset, autoScroll);
}

function selectVoice(preset, shouldRender = true) {
  state.selectedPreset = preset;
  
  dom.selNarratorAvatar.src = getVoiceAvatar(preset);
  dom.selNarratorName.textContent = preset.name;
  dom.selNarratorDesc.textContent = preset.description || preset.instruct || "Zero-shot cloning voice preset.";
  dom.selNarratorType.textContent = preset.type === "cloned" ? "Zero-Shot Clone" : "Voice Design";
  dom.selNarratorLang.textContent = (preset.lang || "en").toUpperCase();
  dom.selNarratorGender.textContent = preset.gender || "Neutral";

  // Pre-fill language dropdown if supported
  if (preset.lang && ["en", "es", "hi", "fr", "ur", "de"].includes(preset.lang)) {
    dom.selectLang.value = preset.lang;
  }

  if (shouldRender) {
    renderVoiceList();
  }
}

function getVoiceAvatar(preset) {
  if (preset.avatar && preset.avatar.trim()) {
    return preset.avatar;
  }
  return `/presets/avatars/${preset.id}.svg`;
}

// ============================================================================
// AUDITION & AUDIO ENGINE
// ============================================================================
function auditionVoiceById(voiceId, e) {
  if (e) e.stopPropagation();
  const preset = state.presets.find(p => p.id === voiceId);
  if (!preset) return;

  // Toggle pause if currently playing this voice
  if (state.currentPlayingVoiceId === preset.id && !dom.audioEngine.paused) {
    dom.audioEngine.pause();
    state.currentPlayingVoiceId = null;
    renderVoiceList();
    updatePlayerUI(false);
    return;
  }

  state.currentPlayingVoiceId = preset.id;
  selectVoice(preset, false);
  renderVoiceList();

  const audioUrl = preset.audioUrl || (preset.audio_file ? `/presets/audio/${preset.audio_file}` : null);
  if (!audioUrl) {
    showToast("No sample audio file found for this voice.", "error");
    return;
  }

  const words = preset.words || [];
  const rawSampleText = preset.sampleText || preset.ref_text || preset.description || `${preset.name} reference audio sample for local OmniVoice cloning.`;

  loadAndPlayAudio(
    audioUrl,
    preset.name,
    `${preset.type === 'cloned' ? 'Zero-Shot Reference' : 'Voice Design Preview'} · ${(preset.lang || 'EN').toUpperCase()}`,
    getVoiceAvatar(preset),
    rawSampleText,
    words,
    true,
    preset.duration
  );
}

function auditionSelectedVoice() {
  if (!state.selectedPreset) return;
  auditionVoiceById(state.selectedPreset.id);
}

function buildSampleWordTimestamps(text, totalDuration) {
  if (!text) return [];
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const charWeights = words.map(w => Math.max(1, w.length));
  const totalWeight = charWeights.reduce((a, b) => a + b, 0);

  const dur = Math.max(0.5, totalDuration);
  let accumulatedTime = 0.0;
  const result = [];

  for (let i = 0; i < words.length; i++) {
    const fraction = charWeights[i] / totalWeight;
    const wordDur = fraction * dur;
    const start = accumulatedTime;
    const end = (i === words.length - 1) ? dur : parseFloat((start + wordDur).toFixed(3));
    result.push({
      word: words[i],
      start: parseFloat(start.toFixed(3)),
      end: end
    });
    accumulatedTime = end;
  }
  return result;
}

function initWebAudioNodes() {
  if (!state.audioCtx) {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      state.audioCtx = new AudioCtx();
      state.sourceNode = state.audioCtx.createMediaElementSource(dom.audioEngine);
      
      // Warmth filter (low-shelf)
      state.bassFilter = state.audioCtx.createBiquadFilter();
      state.bassFilter.type = "lowshelf";
      state.bassFilter.frequency.value = 240;

      // Presence filter (high-shelf)
      state.trebleFilter = state.audioCtx.createBiquadFilter();
      state.trebleFilter.type = "highshelf";
      state.trebleFilter.frequency.value = 3200;

      // Connect pipeline
      state.sourceNode.connect(state.bassFilter);
      state.bassFilter.connect(state.trebleFilter);
      state.trebleFilter.connect(state.audioCtx.destination);
    } catch (e) {
      console.warn("Web Audio API initialization notice:", e);
    }
  }
  if (state.audioCtx && state.audioCtx.state === "suspended") {
    state.audioCtx.resume();
  }
}

function applyCurrentAudioSettings() {
  initWebAudioNodes();

  // Speed (0.7x - 1.4x)
  const speed = (parseInt(dom.sliderSpeed.value, 10) || 100) / 100;
  dom.audioEngine.playbackRate = speed;
  state.playbackSpeed = speed;

  // Pitch tuning (-10 to +10)
  const pitch = parseInt(dom.sliderPitch.value, 10) || 0;
  state.pitchOffset = pitch;

  if (state.bassFilter && state.trebleFilter) {
    if (pitch > 0) {
      state.trebleFilter.gain.value = pitch * 1.2;
      state.bassFilter.gain.value = -pitch * 0.8;
    } else if (pitch < 0) {
      state.bassFilter.gain.value = -pitch * 1.5;
      state.trebleFilter.gain.value = pitch * 0.8;
    } else {
      state.bassFilter.gain.value = 0;
      state.trebleFilter.gain.value = 0;
    }
  }
}

function setupAudioListeners() {
  const audio = dom.audioEngine;

  audio.addEventListener("timeupdate", () => {
    const curr = audio.currentTime || 0;
    const dur = audio.duration || 0;
    dom.playerTimeCurr.textContent = formatTime(curr);
    dom.playerTimeTotal.textContent = formatTime(dur);
    
    if (dur > 0) {
      const pct = (curr / dur) * 100;
      dom.playerScrubberFill.style.width = `${pct}%`;
    }

    // Sync Live Subtitles & Karaoke
    syncKaraoke(curr);
  });

  audio.addEventListener("play", () => {
    initWebAudioNodes();
    updatePlayerUI(true);
  });

  audio.addEventListener("pause", () => updatePlayerUI(false));

  audio.addEventListener("ended", () => {
    updatePlayerUI(false);
    state.currentPlayingVoiceId = null;
    
    // Mark ALL words as passed when playback finishes
    if (state.currentWords && state.currentWords.length > 0) {
      for (let i = 0; i < state.currentWords.length; i++) {
        const el = document.getElementById(`kword-${i}`);
        if (el) el.className = "karaoke-word passed";
      }
    }

    if (dom.subtitlesStatusMeta) {
      dom.subtitlesStatusMeta.textContent = "Playback Complete · Real-time Highlighting Ready";
    }
    renderVoiceList();
  });
}

function renderKaraokeWords() {
  if (state.currentWords && state.currentWords.length > 0) {
    dom.playerKaraokeText.innerHTML = state.currentWords.map((w, idx) => {
      return `<span id="kword-${idx}" class="karaoke-word" data-start="${w.start}" data-end="${w.end}">${escapeHtml(w.word)}</span> `;
    }).join("");
  } else if (state.currentRawText) {
    dom.playerKaraokeText.innerHTML = `<span class="karaoke-sentence">${escapeHtml(state.currentRawText)}</span>`;
  } else {
    dom.playerKaraokeText.innerHTML = `<span class="karaoke-idle">Ready to play audio...</span>`;
  }
}

function loadAndPlayAudio(url, title, subtitle, thumb, rawText, words = [], isAudition = false, knownDuration = null) {
  const audio = dom.audioEngine;
  audio.src = url;
  dom.playerTitle.textContent = title;
  dom.playerSubtitle.textContent = subtitle;
  dom.playerThumb.src = thumb;

  state.isAuditioning = isAudition;
  state.currentRawText = rawText || "";

  if (dom.subtitlesStatusMeta) {
    dom.subtitlesStatusMeta.textContent = isAudition
      ? "Auditioning Sample · Synchronized Word Flow"
      : "Playing Local Synthesis · 24 kHz Broadcast Audio";
  }

  // 1. Prepare word timestamps for live subtitles
  if (words && words.length > 0) {
    state.currentWords = words;
    state.isEstimatedWords = false;
  } else if (rawText) {
    const dur = (knownDuration && knownDuration > 0) ? knownDuration : (audio.duration > 0 ? audio.duration : 0);
    if (dur > 0) {
      state.currentWords = buildSampleWordTimestamps(rawText, dur);
      state.isEstimatedWords = false;
    } else {
      state.currentWords = buildSampleWordTimestamps(rawText, 4.0);
      state.isEstimatedWords = true;
    }
  } else {
    state.currentWords = [];
    state.isEstimatedWords = false;
  }

  // 2. Render Karaoke word spans
  renderKaraokeWords();

  // Listen for loadedmetadata to sync duration if it was unknown
  const onLoadedMetadata = () => {
    audio.removeEventListener("loadedmetadata", onLoadedMetadata);
    dom.playerTimeTotal.textContent = formatTime(audio.duration || 0);
    if (state.isEstimatedWords && audio.duration > 0 && state.currentRawText) {
      state.currentWords = buildSampleWordTimestamps(state.currentRawText, audio.duration);
      state.isEstimatedWords = false;
      renderKaraokeWords();
    }
  };
  audio.addEventListener("loadedmetadata", onLoadedMetadata);

  // 3. Apply user speed and pitch settings immediately
  applyCurrentAudioSettings();

  audio.play().catch(err => {
    console.warn("Autoplay notice:", err);
  });
}

function syncKaraoke(currentTime) {
  if (!state.currentWords || state.currentWords.length === 0) return;
  
  let activeIdx = -1;
  for (let i = 0; i < state.currentWords.length; i++) {
    const w = state.currentWords[i];
    if (currentTime >= w.start && currentTime <= w.end) {
      activeIdx = i;
      break;
    }
  }

  // If between words, highlight the latest word that started
  if (activeIdx === -1 && currentTime > 0) {
    for (let i = state.currentWords.length - 1; i >= 0; i--) {
      if (currentTime >= state.currentWords[i].start) {
        activeIdx = i;
        break;
      }
    }
  }

  let activeEl = null;
  for (let i = 0; i < state.currentWords.length; i++) {
    const el = document.getElementById(`kword-${i}`);
    if (!el) continue;

    if (i === activeIdx) {
      el.className = "karaoke-word active highlight";
      activeEl = el;
    } else if (i < activeIdx) {
      el.className = "karaoke-word passed";
    } else {
      el.className = "karaoke-word";
    }
  }

  // Smoothly scroll active word into view within the karaoke viewport
  const viewport = dom.playerKaraokeViewport || dom.playerKaraokeText;
  if (activeEl && viewport) {
    const elTop = activeEl.offsetTop - viewport.offsetTop;
    const elBottom = elTop + activeEl.offsetHeight;
    if (elBottom > viewport.scrollTop + viewport.clientHeight || elTop < viewport.scrollTop) {
      viewport.scrollTo({
        top: Math.max(0, elTop - 12),
        behavior: "smooth"
      });
    }
  }
}

function togglePlayPause() {
  const audio = dom.audioEngine;
  if (!audio.src) return;
  if (audio.paused) {
    audio.play();
  } else {
    audio.pause();
  }
}

function playerRewind(sec) {
  dom.audioEngine.currentTime = Math.max(0, dom.audioEngine.currentTime - sec);
}

function playerForward(sec) {
  dom.audioEngine.currentTime = Math.min(dom.audioEngine.duration || 0, dom.audioEngine.currentTime + sec);
}

function seekAudio(e) {
  const rect = dom.playerScrubberTrack.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const ratio = Math.max(0, Math.min(1, clickX / rect.width));
  if (dom.audioEngine.duration) {
    dom.audioEngine.currentTime = ratio * dom.audioEngine.duration;
  }
}

function updatePlayerUI(isPlaying) {
  if (isPlaying) {
    dom.playerPlayIcon.innerHTML = `<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>`;
    dom.btnAuditionSelected.classList.add("playing");
    dom.labelAuditionSelected.textContent = "Pause Sample";
  } else {
    dom.playerPlayIcon.innerHTML = `<polygon points="5 3 19 12 5 21 5 3"/>`;
    dom.btnAuditionSelected.classList.remove("playing");
    dom.labelAuditionSelected.textContent = "Play Sample";
  }
}

// ============================================================================
// SCRIPT EDITOR & PRESETS
// ============================================================================
function updateTextCount() {
  const val = dom.ttsTextInput.value || "";
  const chars = val.length;
  const words = val.trim() ? val.trim().split(/\s+/).length : 0;
  dom.textCounter.textContent = `${chars.toLocaleString()} characters · ${words.toLocaleString()} words`;
}

function insertSampleText(type) {
  if (type === "history") {
    dom.ttsTextInput.value = "In the shadowed corridors of the ancient library of Alexandria, scrolls containing the accumulated wisdom of civilizations rested in silent majesty. Scholars from across the Mediterranean gathered to debate the mysteries of the stars and the foundations of mathematics, unaware that the sands of time would soon scatter their legacies. Yet beneath the ashes of forgotten empires, the enduring voice of human curiosity could never truly be extinguished.";
  } else if (type === "tech") {
    dom.ttsTextInput.value = "Welcome back to the studio. Today, we are analyzing modern diffusion transformers in voice synthesis. By framing speech generation as flow-matching across acoustic continuous latents, models achieve hyper-natural cadence, dynamic pitch contouring, and crystal-clear pronunciation without traditional vocoder artifacts.";
  } else if (type === "youtube") {
    dom.ttsTextInput.value = "Stop scrolling! What if I told you that everything you believed about deep space exploration is about to change? In the next sixty seconds, you'll discover three astronomical secrets that NASA only recently declassified.";
  }
  updateTextCount();
  dom.ttsTextInput.focus();
}

function updateSpeedLabel(val) {
  const speed = (parseInt(val, 10) / 100).toFixed(2);
  dom.valSpeed.textContent = `${speed}x`;
  applyCurrentAudioSettings();
}

function updatePitchLabel(val) {
  const pitch = parseInt(val, 10);
  dom.valPitch.textContent = `${pitch >= 0 ? '+' : ''}${pitch}Hz`;
  applyCurrentAudioSettings();
}

function updateStepsLabel(val) {
  const steps = parseInt(val, 10);
  if (dom.valSteps) {
    if (steps <= 8) {
      dom.valSteps.textContent = `${steps} (Fast Preview)`;
    } else if (steps <= 12) {
      dom.valSteps.textContent = `${steps} (Balanced Studio)`;
    } else {
      dom.valSteps.textContent = `${steps} (Broadcast Master)`;
    }
  }
}

// ============================================================================
// LOCAL SYNTHESIS (Local OmniVoice Inference)
// ============================================================================
async function startLocalConversion() {
  const text = (dom.ttsTextInput.value || "").trim();
  if (!text) {
    showToast("Please enter or paste narration text first.", "error");
    dom.ttsTextInput.focus();
    return;
  }

  if (!state.selectedPreset) {
    showToast("Please select a narrator voice.", "error");
    return;
  }

  state.isConverting = true;
  state.conversionStartTime = Date.now();

  // Update UI into Converting state
  dom.btnConvertLocal.disabled = true;
  dom.btnConvertText.textContent = "Synthesizing Locally...";
  dom.progressBox.style.display = "block";
  dom.resultCard.style.display = "none";
  resetProgressMilestones();
  updateProgressUI(10, "Initializing Local OmniVoice Diffusion...", "Conditioning speaker prompt and acoustic latents...");

  if (dom.subtitlesStatusMeta) {
    dom.subtitlesStatusMeta.textContent = "Synthesizing speech with k2-fsa/OmniVoice...";
  }

  // Start polling /api/progress for realtime percentage
  if (state.progressInterval) clearInterval(state.progressInterval);
  state.progressInterval = setInterval(pollConversionProgress, 250);

  try {
    const payload = {
      text: text,
      presetId: state.selectedPreset.id,
      instruct: state.selectedPreset.instruct,
      speed: (parseInt(dom.sliderSpeed.value, 10) || 100) / 100,
      language: dom.selectLang.value || state.selectedPreset.lang || "en",
      num_step: parseInt(dom.selectSteps ? dom.selectSteps.value : "12", 10),
      guidance_scale: 3.0
    };

    if (state.selectedPreset.ref_audio_b64) {
      payload.ref_audio_b64 = state.selectedPreset.ref_audio_b64;
      payload.ref_text = state.selectedPreset.ref_text || text;
    } else if (state.selectedPreset.type === "cloned" && state.selectedPreset.ref_text) {
      payload.ref_text = state.selectedPreset.ref_text;
    }

    const res = await fetch("/api/tts/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Server returned HTTP ${res.status}: ${errText}`);
    }

    const data = await res.json();
    completeConversionSuccess(data, text);

  } catch (err) {
    console.error("Local synthesis error:", err);
    clearInterval(state.progressInterval);
    state.isConverting = false;
    dom.btnConvertLocal.disabled = false;
    dom.btnConvertText.textContent = "Synthesize Speech (Local OmniVoice)";
    dom.progressBox.style.display = "none";
    showToast(`Synthesis failed: ${err.message}`, "error");
  }
}

async function pollConversionProgress() {
  if (!state.isConverting) return;
  const elapsed = ((Date.now() - state.conversionStartTime) / 1000).toFixed(1);
  dom.progressTimer.textContent = `⏱️ ${elapsed}s`;

  try {
    const res = await fetch("/api/progress");
    if (!res.ok) return;
    const p = await res.json();

    if (p.percent) {
      updateProgressUI(p.percent, p.stage || "Neural Synthesis...", p.detail || "");
    }
  } catch (e) {
    // Ignore transient poll blips
  }
}

function updateProgressUI(pct, stage, detail) {
  dom.progressPercent.textContent = `${pct}%`;
  dom.progressBarFill.style.width = `${pct}%`;
  dom.progressStageTitle.textContent = stage;
  dom.progressDetailText.textContent = detail;

  // Pipeline milestone markers
  if (pct >= 10) dom.stepConnect.classList.add("completed");
  if (pct >= 30) dom.stepDiffuse.classList.add("completed");
  if (pct >= 80) dom.stepMp3.classList.add("completed");
  if (pct >= 90) dom.stepSrt.classList.add("completed");
  if (pct >= 98) dom.stepJson.classList.add("completed");
}

function resetProgressMilestones() {
  dom.stepConnect.classList.add("completed");
  dom.stepDiffuse.classList.remove("completed");
  dom.stepMp3.classList.remove("completed");
  dom.stepSrt.classList.remove("completed");
  dom.stepJson.classList.remove("completed");
}

function completeConversionSuccess(data, sourceText) {
  clearInterval(state.progressInterval);
  state.isConverting = false;
  state.lastFolder = data.folder;

  // Update progress to 100%
  updateProgressUI(100, "Local Synthesis Complete!", "All 4 files saved locally (.mp3, .wav, .srt, .json).");
  
  // Re-enable convert button
  dom.btnConvertLocal.disabled = false;
  dom.btnConvertText.textContent = "Synthesize Speech (Local OmniVoice)";

  // Setup Result Card
  dom.resultCard.style.display = "block";
  dom.resultFolderPath.textContent = data.folderPath || `output/${data.folder}`;

  // Configure download links
  const mp3Url = data.audioUrl || `/api/audio/${data.folder}/speech.mp3`;
  const wavUrl = data.wavUrl || `/api/audio/${data.folder}/speech.wav`;
  const srtUrl = data.srtUrl || `/api/audio/${data.folder}/speech.srt`;
  const jsonUrl = data.jsonTimestampsUrl || `/api/audio/${data.folder}/speech.json`;

  dom.linkDownloadMp3.href = mp3Url;
  if (dom.linkDownloadWav) dom.linkDownloadWav.href = wavUrl;
  dom.linkDownloadSrt.href = srtUrl;
  dom.linkDownloadJson.href = jsonUrl;

  // Auto-play the synthesized speech with live subtitles!
  loadAndPlayAudio(
    mp3Url,
    `${state.selectedPreset.name} (Local Synthesis)`,
    `Generated in output/${data.folder}`,
    getVoiceAvatar(state.selectedPreset),
    sourceText,
    data.words || [],
    false
  );

  showToast("Speech synthesized successfully! 4 files generated (.mp3, .wav, .srt, .json).", "success");
}

async function openOutputFolder() {
  if (!state.lastFolder) {
    showToast("No active conversion folder available.", "error");
    return;
  }
  try {
    const res = await fetch("/api/open-folder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folder: state.lastFolder })
    });
    const d = await res.json();
    if (d.success) {
      showToast("Opened folder in Windows Explorer.", "success");
    } else {
      showToast(d.message || "Failed opening folder.", "error");
    }
  } catch (err) {
    showToast(`Error opening folder: ${err.message}`, "error");
  }
}

// ============================================================================
// GENERATION HISTORY DRAWER
// ============================================================================
async function toggleHistoryDrawer(forceState) {
  const isOpen = dom.historyDrawer.classList.contains("open");
  const shouldOpen = forceState !== undefined ? forceState : !isOpen;

  if (shouldOpen) {
    dom.historyDrawer.classList.add("open");
    dom.historyDrawerOverlay.classList.add("open");
    await loadHistory();
  } else {
    dom.historyDrawer.classList.remove("open");
    dom.historyDrawerOverlay.classList.remove("open");
  }
}

async function loadHistory() {
  try {
    const res = await fetch("/api/history");
    const data = await res.json();
    const history = data.history || [];

    if (history.length === 0) {
      dom.historyList.innerHTML = `
        <div style="text-align:center; padding: 3rem 1rem; color: #64748B;">
          <p style="font-size:0.9rem; font-weight:600;">No conversions recorded yet</p>
          <p style="font-size:0.75rem; margin-top:0.35rem;">Synthesize your first script to see it here</p>
        </div>`;
      return;
    }

    dom.historyList.innerHTML = history.map(item => {
      const dateStr = item.created ? new Date(item.created).toLocaleString() : "";
      const textPreview = item.text || "";
      const voiceName = item.voice_name || item.preset_id || "OmniVoice";

      return `
        <div class="history-item">
          <div class="history-item-top">
            <span class="history-voice-name">${escapeHtml(voiceName)}</span>
            <span class="history-date">${dateStr}</span>
          </div>
          <div class="history-text-preview">${escapeHtml(textPreview)}</div>
          <div class="history-actions">
            <button type="button" class="btn-history-play" onclick="playHistoryItem('${escapeHtml(item.audio_url || '')}', '${escapeHtml(voiceName)}', '${escapeHtml(textPreview)}')">
              ▶ Play Audio
            </button>
            <button type="button" class="btn-history-delete" onclick="deleteHistoryItem('${item.id}')">
              Delete
            </button>
          </div>
        </div>
      `;
    }).join("");
  } catch (err) {
    console.error("Failed loading history:", err);
  }
}

function playHistoryItem(audioUrl, voiceName, textPreview) {
  if (!audioUrl) return;
  toggleHistoryDrawer(false);
  loadAndPlayAudio(
    audioUrl,
    voiceName,
    "Saved Conversion History",
    "/presets/avatars/narrator-deep-en.svg",
    textPreview,
    [],
    false
  );
}

async function deleteHistoryItem(itemId) {
  try {
    await fetch(`/api/history/${itemId}`, { method: "DELETE" });
    await loadHistory();
    showToast("History entry deleted.");
  } catch (err) {
    showToast("Failed deleting history entry.", "error");
  }
}

// ============================================================================
// TOAST NOTIFICATIONS & UTILITIES
// ============================================================================
function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  const icon = type === "success" ? "✓" : type === "error" ? "✕" : "ℹ";
  toast.innerHTML = `<span class="toast-icon">${icon}</span><span>${escapeHtml(message)}</span>`;
  
  dom.toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(30px)";
    setTimeout(() => toast.remove(), 300);
  }, 3800);
}

function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ============================================================================
// VOICE CLONING MODAL CONTROLLER
// ============================================================================
let cloneAudioFile = null;

function openCloneVoiceModal() {
  const modal = document.getElementById("clone-voice-modal");
  if (modal) {
    modal.style.display = "flex";
    const nameInput = document.getElementById("clone-voice-name");
    if (nameInput) setTimeout(() => nameInput.focus(), 60);
  }
}

function closeCloneVoiceModal() {
  const modal = document.getElementById("clone-voice-modal");
  if (modal) {
    modal.style.display = "none";
  }
  const player = document.getElementById("clone-audio-player");
  if (player) {
    player.pause();
    player.src = "";
  }
}

function handleModalBackdropClick(e) {
  if (e.target.id === "clone-voice-modal") {
    closeCloneVoiceModal();
  }
}

function triggerCloneFileInput(e) {
  if (e.target.closest("#dropzone-file-preview") || e.target.closest("audio") || e.target.closest(".btn-remove-file")) {
    return;
  }
  const input = document.getElementById("clone-audio-file");
  if (input) input.click();
}

function handleCloneDragOver(e) {
  e.preventDefault();
  e.stopPropagation();
  const dropzone = document.getElementById("clone-audio-dropzone");
  if (dropzone) dropzone.classList.add("dragover");
}

function handleCloneDragLeave(e) {
  e.preventDefault();
  e.stopPropagation();
  const dropzone = document.getElementById("clone-audio-dropzone");
  if (dropzone) dropzone.classList.remove("dragover");
}

function handleCloneDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  const dropzone = document.getElementById("clone-audio-dropzone");
  if (dropzone) dropzone.classList.remove("dragover");
  if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
    setCloneSelectedFile(e.dataTransfer.files[0]);
  }
}

function handleCloneFileSelected(e) {
  if (e.target.files && e.target.files.length > 0) {
    setCloneSelectedFile(e.target.files[0]);
  }
}

function setCloneSelectedFile(file) {
  if (!file.type.startsWith("audio/") && !file.name.match(/\.(wav|mp3|m4a|ogg|flac)$/i)) {
    showToast("Please select a valid audio file (.wav, .mp3, .m4a, .flac).", "error");
    return;
  }
  if (file.size > 25 * 1024 * 1024) {
    showToast("File size too large. Maximum size is 25 MB.", "error");
    return;
  }
  cloneAudioFile = file;

  const placeholder = document.getElementById("dropzone-placeholder");
  const preview = document.getElementById("dropzone-file-preview");
  const nameEl = document.getElementById("clone-file-name");
  const sizeEl = document.getElementById("clone-file-size");
  const player = document.getElementById("clone-audio-player");

  if (placeholder) placeholder.style.display = "none";
  if (preview) preview.style.display = "flex";
  if (nameEl) nameEl.textContent = file.name;
  if (sizeEl) sizeEl.textContent = `${(file.size / (1024 * 1024)).toFixed(2)} MB`;

  const objectUrl = URL.createObjectURL(file);
  if (player) {
    player.src = objectUrl;
    player.load();
  }
}

function removeCloneFile(e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
  cloneAudioFile = null;
  const input = document.getElementById("clone-audio-file");
  if (input) input.value = "";

  const placeholder = document.getElementById("dropzone-placeholder");
  const preview = document.getElementById("dropzone-file-preview");
  const player = document.getElementById("clone-audio-player");

  if (placeholder) placeholder.style.display = "block";
  if (preview) preview.style.display = "none";
  if (player) {
    player.pause();
    player.src = "";
  }
}

async function autoTranscribeCloneAudio() {
  if (!cloneAudioFile) {
    showToast("Please upload an audio sample first.", "error");
    return;
  }

  const btn = document.getElementById("btn-auto-transcribe");
  const originalText = btn ? btn.textContent : "";
  if (btn) {
    btn.disabled = true;
    btn.textContent = "⏳ Transcribing...";
  }

  try {
    const formData = new FormData();
    formData.append("audioFile", cloneAudioFile);
    const langSelect = document.getElementById("clone-voice-lang");
    if (langSelect) formData.append("language", langSelect.value);

    const resp = await fetch("/api/presets/transcribe", {
      method: "POST",
      body: formData
    });

    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`);
    }
    const data = await resp.json();
    if (data.success && data.text) {
      const textarea = document.getElementById("clone-ref-text");
      if (textarea) textarea.value = data.text;
      showToast("Audio successfully transcribed with Whisper!", "info");
    } else {
      showToast(data.error || "Could not transcribe audio clip.", "error");
    }
  } catch (err) {
    console.warn("Auto-transcribe fetch notice:", err);
    showToast("Whisper auto-transcription notice: You can type words manually.", "error");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }
}

async function handleCloneVoiceSubmit(e) {
  e.preventDefault();
  if (!cloneAudioFile) {
    showToast("Please upload a reference audio sample.", "error");
    return;
  }

  const nameInput = document.getElementById("clone-voice-name");
  const name = nameInput ? nameInput.value.trim() : "";
  if (!name) {
    showToast("Please enter a name for your cloned voice.", "error");
    return;
  }

  const langSelect = document.getElementById("clone-voice-lang");
  const lang = langSelect ? langSelect.value : "en";
  const genderRadio = document.querySelector('input[name="clone-gender"]:checked');
  const gender = genderRadio ? genderRadio.value : "Male";
  const refTextArea = document.getElementById("clone-ref-text");
  const refText = refTextArea ? refTextArea.value.trim() : "";

  const submitBtn = document.getElementById("btn-submit-clone");
  const submitText = document.getElementById("btn-clone-submit-text");
  const submitSpinner = document.getElementById("btn-clone-submit-spinner");

  if (submitBtn) submitBtn.disabled = true;
  if (submitText) submitText.textContent = "Cloning Voice & Extracting Timestamps...";
  if (submitSpinner) submitSpinner.style.display = "inline-block";

  try {
    const reader = new FileReader();
    const b64Promise = new Promise((resolve) => {
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(cloneAudioFile);
    });
    const audioB64 = await b64Promise;

    const formData = new FormData();
    formData.append("name", name);
    formData.append("language", lang);
    formData.append("gender", gender);
    if (refText) formData.append("ref_text", refText);
    formData.append("audioFile", cloneAudioFile);

    let newPreset = null;
    try {
      const resp = await fetch("/api/presets/clone", {
        method: "POST",
        body: formData
      });
      if (resp.ok) {
        const json = await resp.json();
        if (json.success && json.preset) {
          newPreset = json.preset;
        }
      }
    } catch (netErr) {
      console.warn("Backend /api/presets/clone call notice:", netErr);
    }

    if (!newPreset) {
      const localId = `clone-${Date.now().toString(36)}`;
      const audioUrl = URL.createObjectURL(cloneAudioFile);
      const textSample = refText || `Voice preview sample for ${name}`;
      newPreset = {
        id: localId,
        name: name,
        type: "cloned",
        lang: lang,
        gender: gender,
        ref_text: textSample,
        sampleText: textSample,
        audioUrl: audioUrl,
        ref_audio_b64: audioB64,
        avatar: "/presets/avatars/narrator-deep-en.svg",
        duration: 5.0,
        words: textSample.split(/\s+/).map((w, idx) => ({
          word: w,
          start: parseFloat((idx * 0.35).toFixed(3)),
          end: parseFloat(((idx + 1) * 0.35).toFixed(3))
        })),
        description: `Custom cloned voice: ${name} (${lang.toUpperCase()})`
      };
    } else {
      newPreset.ref_audio_b64 = audioB64;
    }

    // Prepend to presets collection
    state.presets.unshift(newPreset);
    if (dom.statVoiceCount) dom.statVoiceCount.textContent = state.presets.length;

    // Switch view to Cloned / Custom tab
    filterCategory("cloned");

    // Select the new voice
    selectVoice(newPreset, false);

    // Reset & close dialog
    closeCloneVoiceModal();
    const form = document.getElementById("clone-voice-form");
    if (form) form.reset();
    removeCloneFile();

    showToast(`Voice cloned successfully: ${newPreset.name}!`, "success");

    // Immediately play the sample audition with live subtitle karaoke!
    auditionVoiceById(newPreset.id);

  } catch (err) {
    console.error("Voice clone error:", err);
    showToast(`Voice cloning failed: ${err.message}`, "error");
  } finally {
    if (submitBtn) submitBtn.disabled = false;
    if (submitText) submitText.textContent = "🚀 Save & Clone Voice";
    if (submitSpinner) submitSpinner.style.display = "none";
  }
}

// ============================================================================
// VOICE DESIGNER MODAL CONTROLLER (VoiceStudio Feature)
// ============================================================================
function openVoiceDesignModal() {
  const modal = document.getElementById("design-voice-modal");
  if (modal) {
    modal.style.display = "flex";
    const nameInput = document.getElementById("design-voice-name");
    if (nameInput) setTimeout(() => nameInput.focus(), 60);
    updateDesignInstructPreview();
  }
}

function closeVoiceDesignModal() {
  const modal = document.getElementById("design-voice-modal");
  if (modal) {
    modal.style.display = "none";
  }
}

function handleDesignModalBackdropClick(e) {
  if (e.target.id === "design-voice-modal") {
    closeVoiceDesignModal();
  }
}

function toggleTraitChip(chipEl, category) {
  // If it's a single-select trait group like gender, pitch, age
  const parent = chipEl.parentElement;
  if (parent) {
    parent.querySelectorAll(".trait-chip").forEach(c => c.classList.remove("active"));
  }
  chipEl.classList.add("active");
  updateDesignInstructPreview();
}

function updateDesignInstructPreview() {
  const modal = document.getElementById("design-voice-modal");
  if (!modal) return;
  const activeChips = modal.querySelectorAll(".trait-chip.active");
  const traits = [];
  activeChips.forEach(chip => {
    const t = chip.getAttribute("data-trait");
    if (t) traits.push(t);
  });
  
  const previewInput = document.getElementById("design-instruct-preview");
  if (previewInput) {
    previewInput.value = traits.join(", ");
  }
}

async function handleVoiceDesignSubmit(e) {
  e.preventDefault();
  const nameInput = document.getElementById("design-voice-name");
  const name = nameInput ? nameInput.value.trim() : "";
  if (!name) {
    showToast("Please enter a name for the designed voice.", "error");
    return;
  }

  const instructInput = document.getElementById("design-instruct-preview");
  const instruct = instructInput ? instructInput.value.trim() : "male, middle-aged, low pitch, american accent";
  
  const sampleTextInput = document.getElementById("design-sample-text");
  const sampleText = sampleTextInput ? sampleTextInput.value.trim() : "Hello! This is a synthesized speech preview from OmniVoice Studio.";

  const genderChip = document.querySelector("#trait-gender-chips .trait-chip.active");
  const gender = genderChip ? (genderChip.getAttribute("data-trait") === "female" ? "Female" : "Male") : "Male";

  const submitBtn = document.getElementById("btn-submit-design");
  const submitText = document.getElementById("btn-design-submit-text");
  const submitSpinner = document.getElementById("btn-design-submit-spinner");

  if (submitBtn) submitBtn.disabled = true;
  if (submitText) submitText.textContent = "Creating Voice Preset...";
  if (submitSpinner) submitSpinner.style.display = "inline-block";

  try {
    const payload = {
      name: name,
      instruct: instruct,
      sampleText: sampleText,
      gender: gender,
      lang: "en"
    };

    const resp = await fetch("/api/presets/design", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`);
    }

    const data = await resp.json();
    if (!data.success || !data.preset) {
      throw new Error(data.error || "Failed creating preset");
    }

    const newPreset = data.preset;

    // Add to collection
    state.presets.unshift(newPreset);
    if (dom.statVoiceCount) dom.statVoiceCount.textContent = state.presets.length;

    // Select the new voice
    selectVoice(newPreset, false);
    renderVoiceList();

    closeVoiceDesignModal();
    const form = document.getElementById("design-voice-form");
    if (form) form.reset();

    showToast(`Voice created: ${newPreset.name}! Ready for synthesis.`, "success");

  } catch (err) {
    console.error("Voice design creation error:", err);
    showToast(`Voice creation notice: ${err.message}`, "error");
  } finally {
    if (submitBtn) submitBtn.disabled = false;
    if (submitText) submitText.textContent = "✨ Create Designed Voice";
    if (submitSpinner) submitSpinner.style.display = "none";
  }
}

// ============================================================================
// AUDIO DICTATION / TRANSCRIPTION MODAL (VoiceStudio Feature)
// ============================================================================
let dictateAudioFile = null;

function openDictationModal() {
  const modal = document.getElementById("dictation-modal");
  if (modal) {
    modal.style.display = "flex";
  }
}

function closeDictationModal() {
  const modal = document.getElementById("dictation-modal");
  if (modal) {
    modal.style.display = "none";
  }
}

function handleDictationModalBackdropClick(e) {
  if (e.target.id === "dictation-modal") {
    closeDictationModal();
  }
}

function handleDictateFileSelected(e) {
  if (e.target.files && e.target.files.length > 0) {
    setDictateSelectedFile(e.target.files[0]);
  }
}

function setDictateSelectedFile(file) {
  if (!file.type.startsWith("audio/") && !file.name.match(/\.(wav|mp3|m4a|ogg|flac|webm)$/i)) {
    showToast("Please select a valid audio file (.wav, .mp3, .m4a, .flac).", "error");
    return;
  }
  dictateAudioFile = file;

  const placeholder = document.getElementById("dictate-dropzone-placeholder");
  const preview = document.getElementById("dictate-file-preview");
  const nameEl = document.getElementById("dictate-file-name");
  const sizeEl = document.getElementById("dictate-file-size");

  if (placeholder) placeholder.style.display = "none";
  if (preview) preview.style.display = "flex";
  if (nameEl) nameEl.textContent = file.name;
  if (sizeEl) sizeEl.textContent = `${(file.size / (1024 * 1024)).toFixed(2)} MB`;
}

async function runAudioTranscription() {
  if (!dictateAudioFile) {
    showToast("Please choose an audio file to transcribe first.", "error");
    return;
  }

  const btn = document.getElementById("btn-run-transcribe");
  const originalHtml = btn ? btn.innerHTML : "";
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span>⏳ Transcribing with faster-whisper AI...</span>`;
  }

  try {
    const formData = new FormData();
    formData.append("audioFile", dictateAudioFile);
    const langSelect = document.getElementById("dictate-lang-select");
    if (langSelect && langSelect.value !== "all") {
      formData.append("language", langSelect.value);
    }

    const resp = await fetch("/api/transcribe", {
      method: "POST",
      body: formData
    });

    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`);
    }

    const data = await resp.json();
    if (!data.success) {
      throw new Error(data.error || "Transcription failed");
    }

    const resultGroup = document.getElementById("dictate-result-group");
    const resultText = document.getElementById("dictate-result-text");
    const resultMeta = document.getElementById("dictate-result-meta");

    if (resultGroup) resultGroup.style.display = "block";
    if (resultText) resultText.value = data.text;
    if (resultMeta) {
      resultMeta.textContent = `Transcribed ${data.words_count || 0} words in ${data.duration || 0}s (Detected: ${(data.detected_language || 'en').toUpperCase()})`;
    }

    showToast("Audio successfully transcribed!", "success");

  } catch (err) {
    console.error("Transcription error:", err);
    showToast(`Transcription notice: ${err.message}`, "error");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalHtml;
    }
  }
}

function insertTranscriptionIntoEditor() {
  const resultText = document.getElementById("dictate-result-text");
  const text = resultText ? resultText.value.trim() : "";
  if (!text) {
    showToast("No transcribed text to insert.", "error");
    return;
  }

  dom.ttsTextInput.value = text;
  updateTextCount();
  closeDictationModal();
  showToast("Transcribed text loaded into script editor!", "success");
  dom.ttsTextInput.focus();
}

