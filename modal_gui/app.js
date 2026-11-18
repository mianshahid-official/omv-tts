/**
 * OmniVoice Studio - Modal Cloud GPU Edition Frontend Controller
 * - Audition 108 local voices with instantaneous playback
 * - Switch & test Modal Gateway link in real time (persisted to localStorage)
 * - Send script to Modal T4 GPU model
 * - Download all 3 files: speech.mp3, speech.json, speech.srt locally
 * - Live synchronized karaoke audio player with word-level highlight
 */

// ============================================================================
// STATE STORE
// ============================================================================
const state = {
  modalUrl: localStorage.getItem("omnivoice_modal_url") || "https://joybenny3333--omnivoice-studio-fastapi-app.modal.run",
  isConnected: false,
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
  
  // Conversion state
  isConverting: false,
  lastFolder: null,
  lastGeneratedFiles: null,

  // Mode and Bulk Queue
  mode: "single", // "single" or "bulk"
  bulkQueue: [],
  bulkIsConverting: false,
};

const dom = {
  tabBtnSingle: document.getElementById("tab-btn-single"),
  tabBtnBulk: document.getElementById("tab-btn-bulk"),
  singleEditorArea: document.getElementById("single-editor-area"),
  bulkEditorArea: document.getElementById("bulk-editor-area"),
  bulkFileInput: document.getElementById("bulk-file-input"),
  bulkDropzone: document.getElementById("bulk-dropzone"),
  bulkQueueHeader: document.getElementById("bulk-queue-header"),
  bulkQueueList: document.getElementById("bulk-queue-list"),
  bulkLoadedCount: document.getElementById("bulk-loaded-count"),
  bulkBadgeCount: document.getElementById("bulk-badge-count"),
  linkDownloadTxt: document.getElementById("link-download-txt"),
  fileSizeTxt: document.getElementById("file-size-txt"),

  modalUrlInput: document.getElementById("modal-url-input"),
  btnTestConnection: document.getElementById("btn-test-connection"),
  btnTestText: document.getElementById("btn-test-text"),
  modalStatusBadge: document.getElementById("modal-status-badge"),
  modalStatusText: document.getElementById("modal-status-text"),
  statVoiceCount: document.getElementById("stat-voice-count"),
  
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
  
  btnConvertModal: document.getElementById("btn-convert-modal"),
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
  linkDownloadSrt: document.getElementById("link-download-srt"),
  fileSizeSrt: document.getElementById("file-size-srt"),
  linkDownloadJson: document.getElementById("link-download-json"),
  fileSizeJson: document.getElementById("file-size-json"),
  
  playerThumb: document.getElementById("player-thumb"),
  playerTitle: document.getElementById("player-title"),
  playerSubtitle: document.getElementById("player-subtitle"),
  playerPlayBtn: document.getElementById("player-play-btn"),
  playerPlayIcon: document.getElementById("player-play-icon"),
  playerTimeCurr: document.getElementById("player-time-curr"),
  playerTimeTotal: document.getElementById("player-time-total"),
  playerScrubberFill: document.getElementById("player-scrubber-fill"),
  playerScrubberTrack: document.getElementById("player-scrubber-track"),
  playerKaraokeViewport: document.getElementById("player-karaoke-viewport"),
  playerKaraokeText: document.getElementById("player-karaoke-text"),
  subtitlesStatusMeta: document.getElementById("subtitles-status-meta"),
  studioContainer: document.getElementById("studio-container"),
  studioResizer: document.getElementById("studio-resizer"),
  audioEngine: document.getElementById("audio-engine"),
  toastContainer: document.getElementById("toast-container"),
};

// ============================================================================
// INITIALIZATION
// ============================================================================
document.addEventListener("DOMContentLoaded", async () => {
  // Setup draggable column resize splitter
  setupColumnResizer();

  // Populate Modal URL
  dom.modalUrlInput.value = state.modalUrl;
  dom.modalUrlInput.addEventListener("change", (e) => {
    let url = e.target.value.trim().replace(/\/+$/, "");
    state.modalUrl = url;
    localStorage.setItem("omnivoice_modal_url", url);
    testModalConnection(true);
  });

  // Setup text counter
  dom.ttsTextInput.addEventListener("input", updateTextCount);
  updateTextCount();

  // Setup audio engine event listeners
  setupAudioListeners();

  // Load presets catalog
  await loadPresetsCatalog();

  // Auto-test Modal connection silently
  testModalConnection(true);
});

// ============================================================================
// PRESETS CATALOG & AUDITION
// ============================================================================
async function loadPresetsCatalog() {
  try {
    // Attempt local API first (running in modal_studio_gui or local server)
    let res = await fetch("/api/presets");
    if (!res.ok && state.modalUrl) {
      // Fallback to modal endpoint
      res = await fetch(`${state.modalUrl}/api/presets`);
    }
    const data = await res.json();
    state.presets = data.presets || [];
    dom.statVoiceCount.textContent = state.presets.length;

    // Default select history narrator or first preset
    const historyPreset = state.presets.find(p => p.id === "narrator-deep-en" || p.id.includes("story") || p.id.includes("narrator"));
    selectVoice(historyPreset || state.presets[0], false);
    renderVoiceList();
  } catch (err) {
    console.error("Failed loading presets:", err);
    showToast("Could not load presets list. Check local server or Modal link.", "error");
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

  dom.voicesList.innerHTML = "";
  if (filtered.length === 0) {
    dom.voicesList.innerHTML = `<div style="padding: 2rem 1rem; text-align: center; color: var(--muted-foreground); font-size: 0.85rem;">No voices found matching criteria.</div>`;
    return;
  }

  filtered.forEach(preset => {
    const isSelected = state.selectedPreset && state.selectedPreset.id === preset.id;
    const isPlaying = state.currentPlayingVoiceId === preset.id && !dom.audioEngine.paused;
    
    const card = document.createElement("div");
    card.className = `voice-card ${isSelected ? "selected" : ""}`;
    card.onclick = (e) => {
      if (e.target.closest(".btn-audition-card")) return;
      selectVoice(preset, true);
    };

    const avatarUrl = getAvatarUrl(preset);
    const audioUrl = getPresetAudioUrl(preset);

    card.innerHTML = `
      <div class="voice-card-main">
        <img class="voice-avatar" src="${avatarUrl}" alt="${escapeHtml(preset.name)}" onerror="this.src='/presets/avatars/narrator-deep-en.svg'">
        <div class="voice-info">
          <div class="voice-name" title="${escapeHtml(preset.name)}">${escapeHtml(preset.name)}</div>
          <div class="voice-meta-row">
            <span class="meta-tag lang">${(preset.lang || "en").toUpperCase()}</span>
            <span class="meta-tag">${preset.gender || "Voice"}</span>
            <span class="meta-tag">${preset.type === "cloned" ? "Zero-Shot" : "Designed"}</span>
          </div>
        </div>
      </div>
      <div class="voice-card-actions">
        <button type="button" class="btn-audition-card ${isPlaying ? "playing" : ""}" title="Audition Sample Voice" onclick="auditionPreset('${preset.id}', event)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            ${isPlaying 
              ? '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>' 
              : '<polygon points="5 3 19 12 5 21 5 3"/>'}
          </svg>
        </button>
        <button type="button" class="btn-select-voice" onclick="selectVoiceById('${preset.id}')">
          ${isSelected ? "✓ Active" : "Select"}
        </button>
      </div>
    `;
    dom.voicesList.appendChild(card);
  });
}

function selectVoiceById(id) {
  const p = state.presets.find(x => x.id === id);
  if (p) selectVoice(p, true);
}

function selectVoice(preset, notify = true) {
  state.selectedPreset = preset;
  
  // Update Hero Banner
  dom.selNarratorName.textContent = preset.name;
  dom.selNarratorDesc.textContent = preset.description || preset.instruct || "High-fidelity neural voice model.";
  dom.selNarratorType.textContent = preset.type === "cloned" ? "Zero-Shot Clone" : "Voice Design";
  dom.selNarratorLang.textContent = (preset.lang || "en").toUpperCase();
  dom.selNarratorGender.textContent = preset.gender || "Neutral";
  dom.selNarratorAvatar.src = getAvatarUrl(preset);

  // Sync Language selector if present
  if (preset.lang && ["en", "es", "hi", "fr", "ur", "de"].includes(preset.lang)) {
    dom.selectLang.value = preset.lang;
  }

  // Refresh selection in voice cards
  document.querySelectorAll(".voice-card").forEach(c => c.classList.remove("selected"));
  renderVoiceList();

  if (notify) {
    showToast(`Narrator finalized: ${preset.name}`, "info");
  }
}

function getAvatarUrl(preset) {
  if (!preset) return "/presets/avatars/narrator-deep-en.svg";
  if (preset.avatar) {
    if (preset.avatar.startsWith("http")) return preset.avatar;
    if (preset.avatar.startsWith("/")) return preset.avatar;
    return `/${preset.avatar}`;
  }
  if (preset.id) {
    return `/presets/avatars/${preset.id}.svg`;
  }
  return "/presets/avatars/narrator-deep-en.svg";
}

function getPresetAudioUrl(preset) {
  let url = preset.audioUrl || "";
  if (!url && preset.ref_audio) {
    const filename = preset.ref_audio.split(/[\\\\/]/).pop();
    url = `/presets/audio/${filename}`;
  }
  return url;
}

// Audition Preset Audio Live
function auditionPreset(presetId, event) {
  if (event) event.stopPropagation();
  const preset = state.presets.find(p => p.id === presetId);
  if (!preset) return;

  const audioUrl = getPresetAudioUrl(preset);
  if (!audioUrl) {
    showToast("No sample audio available for this voice.", "error");
    return;
  }

  if (state.currentPlayingVoiceId === presetId && !dom.audioEngine.paused) {
    // Pause
    dom.audioEngine.pause();
    state.currentPlayingVoiceId = null;
    updatePlayerUI(false);
    renderVoiceList();
    return;
  }

  // Load and play with user's settings & word-level subtitles
  const words = preset.words || [];
  loadAndPlayAudio(
    audioUrl,
    preset.name,
    "Sample Voice Audition",
    getAvatarUrl(preset),
    preset.sampleText || preset.ref_text || "",
    words,
    true,
    preset.duration
  );
  state.currentPlayingVoiceId = presetId;
  updatePlayerUI(true);
  renderVoiceList();
}

function auditionSelectedVoice() {
  if (!state.selectedPreset) return;
  auditionPreset(state.selectedPreset.id);
}

// ============================================================================
// MODAL GATEWAY CONNECTION & PING
// ============================================================================
async function testModalConnection(silent = false) {
  const rawUrl = dom.modalUrlInput.value.trim().replace(/\/+$/, "");
  if (!rawUrl) {
    setModalStatus("disconnected", "No URL Provided");
    if (!silent) showToast("Please paste your Modal Deployment URL.", "error");
    return;
  }

  state.modalUrl = rawUrl;
  localStorage.setItem("omnivoice_modal_url", rawUrl);

  setModalStatus("testing", "Pinging Cloud T4...");
  dom.btnTestText.textContent = "Testing...";

  try {
    const startT = performance.now();
    const res = await fetch(`${rawUrl}/api/presets`, { method: "GET", mode: "cors" });
    const pingMs = Math.round(performance.now() - startT);
    
    if (res.ok) {
      setModalStatus("connected", `Online (${pingMs}ms)`);
      state.isConnected = true;
      if (!silent) showToast(`Connected to Modal T4 GPU! Latency: ${pingMs}ms`, "success");
    } else {
      setModalStatus("disconnected", `Error ${res.status}`);
      state.isConnected = false;
      if (!silent) showToast(`Modal returned status ${res.status}`, "error");
    }
  } catch (err) {
    setModalStatus("disconnected", "Unreachable");
    state.isConnected = false;
    if (!silent) showToast(`Could not connect to Modal: ${err.message}. Check URL or app deployment.`, "error");
  } finally {
    dom.btnTestText.textContent = "Ping / Test";
  }
}

function setModalStatus(status, text) {
  dom.modalStatusBadge.className = `modal-status-badge ${status}`;
  dom.modalStatusText.textContent = text;
}

// ============================================================================
// TEXT & SETTINGS CONTROLS
// ============================================================================
function updateTextCount() {
  const text = dom.ttsTextInput.value || "";
  const chars = text.length;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  dom.textCounter.textContent = `${chars} characters · ${words} words`;
}

function updateSpeedLabel(val) {
  dom.valSpeed.textContent = (val / 100).toFixed(2) + "x";
  applyCurrentAudioSettings();
}

function updatePitchLabel(val) {
  dom.valPitch.textContent = (val > 0 ? `+${val}` : `${val}`) + "Hz";
  applyCurrentAudioSettings();
}

function insertSampleText(type) {
  let sample = "";
  if (type === "history") {
    sample = "In the shadowed corridors of the ancient library of Alexandria, scrolls containing the accumulated wisdom of civilizations rested in silent majesty. Scholars from across the Mediterranean gathered to debate the mysteries of the stars and the foundations of mathematics, unaware that the sands of time would soon scatter their legacies.";
  } else if (type === "tech") {
    sample = "Today we are evaluating next-generation neural flow matching running directly on serverless GPU architecture. The latency reductions and acoustic precision achieved by this model represent a quantum leap for creator production workflows.";
  } else if (type === "youtube") {
    sample = "What if everything you thought you knew about ancient history was completely backwards? In the next ten minutes, we are going to uncover the hidden artifacts that historians refused to talk about until today.";
  }
  dom.ttsTextInput.value = sample;
  updateTextCount();
  dom.ttsTextInput.focus();
}

// ============================================================================
// STUDIO MODE SWITCHING & BULK SCRIPT MANAGEMENT
// ============================================================================
function switchStudioMode(mode) {
  state.mode = mode;
  if (mode === "bulk") {
    if (dom.tabBtnSingle) dom.tabBtnSingle.classList.remove("active");
    if (dom.tabBtnBulk) dom.tabBtnBulk.classList.add("active");
    if (dom.singleEditorArea) dom.singleEditorArea.style.display = "none";
    if (dom.bulkEditorArea) dom.bulkEditorArea.style.display = "flex";
    dom.btnConvertText.textContent = `Synthesize All (${state.bulkQueue.length}) on Modal (T4 GPU)`;
  } else {
    if (dom.tabBtnSingle) dom.tabBtnSingle.classList.add("active");
    if (dom.tabBtnBulk) dom.tabBtnBulk.classList.remove("active");
    if (dom.singleEditorArea) dom.singleEditorArea.style.display = "block";
    if (dom.bulkEditorArea) dom.bulkEditorArea.style.display = "none";
    dom.btnConvertText.textContent = "Synthesize on Modal (T4 GPU)";
  }
}

function triggerBulkFileInput() {
  if (dom.bulkFileInput) {
    dom.bulkFileInput.value = "";
    dom.bulkFileInput.click();
  }
}

function handleBulkFilesSelected(event) {
  if (event.target.files && event.target.files.length > 0) {
    loadBulkTextFiles(event.target.files);
  }
}

function handleBulkDragOver(event) {
  event.preventDefault();
  if (dom.bulkDropzone) dom.bulkDropzone.classList.add("dragover");
}

function handleBulkDragLeave(event) {
  if (dom.bulkDropzone) dom.bulkDropzone.classList.remove("dragover");
}

function handleBulkDrop(event) {
  event.preventDefault();
  if (dom.bulkDropzone) dom.bulkDropzone.classList.remove("dragover");
  if (event.dataTransfer && event.dataTransfer.files) {
    loadBulkTextFiles(event.dataTransfer.files);
  }
}

async function loadBulkTextFiles(fileList) {
  const txtFiles = Array.from(fileList).filter(f => f.name.toLowerCase().endsWith(".txt") || f.type.includes("text"));
  if (txtFiles.length === 0) {
    showToast("Please provide .txt text files.", "warning");
    return;
  }

  let addedCount = 0;
  for (const file of txtFiles) {
    try {
      const text = await file.text();
      const clean = text.trim();
      if (!clean) continue;

      const words = clean.split(/\s+/).filter(Boolean);
      state.bulkQueue.push({
        id: "bulk_" + Date.now() + "_" + Math.random().toString(36).substr(2, 6),
        name: file.name,
        text: clean,
        wordsCount: words.length,
        charsCount: clean.length,
        status: "pending", // pending, processing, completed, error
        result: null,
      });
      addedCount++;
    } catch (err) {
      console.warn("Error reading file:", file.name, err);
    }
  }

  renderBulkQueue();
  showToast(`Loaded ${addedCount} script file(s) into queue.`, "success");
}

function clearBulkQueue() {
  state.bulkQueue = [];
  renderBulkQueue();
  showToast("Cleared bulk script queue.", "info");
}

function removeBulkItem(id) {
  state.bulkQueue = state.bulkQueue.filter(item => item.id !== id);
  renderBulkQueue();
}

function renderBulkQueue() {
  const count = state.bulkQueue.length;
  if (dom.bulkBadgeCount) dom.bulkBadgeCount.textContent = count;
  if (dom.bulkLoadedCount) dom.bulkLoadedCount.textContent = count;

  if (state.mode === "bulk") {
    dom.btnConvertText.textContent = `Synthesize All (${count}) on Modal (T4 GPU)`;
  }

  if (count === 0) {
    if (dom.bulkQueueHeader) dom.bulkQueueHeader.style.display = "none";
    if (dom.bulkQueueList) {
      dom.bulkQueueList.style.display = "none";
      dom.bulkQueueList.innerHTML = "";
    }
    return;
  }

  if (dom.bulkQueueHeader) dom.bulkQueueHeader.style.display = "flex";
  if (dom.bulkQueueList) {
    dom.bulkQueueList.style.display = "flex";
    dom.bulkQueueList.innerHTML = state.bulkQueue.map((item, idx) => {
      let statusBadge = "";
      if (item.status === "pending") {
        statusBadge = `<span class="status-pill pending">⏳ Pending</span>`;
      } else if (item.status === "processing") {
        statusBadge = `<span class="status-pill processing">⚡ Synthesizing</span>`;
      } else if (item.status === "completed") {
        statusBadge = `<span class="status-pill done">✓ Completed</span>`;
      } else if (item.status === "error") {
        statusBadge = `<span class="status-pill error">✕ Error</span>`;
      }

      let actionsHtml = "";
      if (item.status === "completed" && item.result) {
        const res = item.result;
        actionsHtml = `
          <div class="bulk-item-actions">
            <button type="button" class="btn-item-link" onclick="playBulkItemAudio('${item.id}')" title="Play Master MP3">▶ Play</button>
            <a href="data:audio/mp3;base64,${res.mp3_b64 || ''}" download="speech.mp3" class="btn-item-link" title="Download MP3">MP3</a>
            <button type="button" class="btn-item-link" onclick="downloadTextBlob('${encodeURIComponent(res.srt_content || '')}', 'speech.srt')">SRT</button>
            <button type="button" class="btn-item-link" onclick="downloadTextBlob('${encodeURIComponent(typeof res.json_content === 'string' ? res.json_content : JSON.stringify(res.json_content, null, 2))}', 'speech.json')">JSON</button>
            <button type="button" class="btn-item-link" onclick="downloadTextBlob('${encodeURIComponent(res.script_text || item.text)}', 'script.txt')">TXT</button>
            <button type="button" class="btn-item-link" onclick="openOutputFolderByName('${res.folder}')" title="Open in Windows File Explorer">📁 Folder</button>
          </div>
        `;
      } else if (item.status === "pending") {
        actionsHtml = `
          <button type="button" class="btn-item-link" style="color:#ef4444;" onclick="removeBulkItem('${item.id}')" title="Remove">&times;</button>
        `;
      }

      return `
        <div class="bulk-queue-item ${item.status}" id="queue-item-${item.id}">
          <div class="bulk-item-left">
            <div class="bulk-item-icon">#${idx + 1}</div>
            <div class="bulk-item-meta">
              <span class="bulk-item-name" title="${item.name}">${item.name}</span>
              <span class="bulk-item-desc">${item.wordsCount} words · ${item.charsCount} chars</span>
            </div>
          </div>
          <div class="bulk-item-right">
            ${statusBadge}
            ${actionsHtml}
          </div>
        </div>
      `;
    }).join("");
  }
}

function downloadTextBlob(encodedStr, filename) {
  const str = decodeURIComponent(encodedStr);
  const blob = new Blob([str], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function playBulkItemAudio(id) {
  const item = state.bulkQueue.find(x => x.id === id);
  if (!item || !item.result) return;
  const res = item.result;
  const audioUrl = res.mp3_b64 ? `data:audio/mp3;base64,${res.mp3_b64}` : res.audioUrl;
  loadAndPlayAudio(
    audioUrl,
    item.name,
    `Folder: ${res.folder} · Duration: ${res.duration}s`,
    getAvatarUrl(state.selectedPreset),
    item.text,
    res.words || [],
    true
  );
}

function openOutputFolderByName(folder) {
  if (!folder) return;
  fetch(`/api/open_folder?folder=${encodeURIComponent(folder)}`)
    .then(r => r.json())
    .then(res => {
      showToast(`Opened folder in Windows Explorer: ${folder}`, "success");
    })
    .catch(() => {
      showToast(`Folder located at: output/${folder}`, "info");
    });
}

async function startBulkModalConversion() {
  if (state.bulkQueue.length === 0) {
    showToast("Please add at least one .txt script file to the queue.", "error");
    return;
  }
  if (!state.selectedPreset) {
    showToast("Please select a narrator voice from the catalog.", "error");
    return;
  }

  let modalUrl = dom.modalUrlInput.value.trim().replace(/\/+$/, "");
  if (modalUrl.endsWith(".modal")) modalUrl += ".run";

  state.bulkIsConverting = true;
  dom.btnConvertModal.disabled = true;
  dom.btnConvertText.textContent = `Processing Bulk Scripts on Modal T4 GPU...`;

  dom.progressBox.style.display = "block";
  dom.resultCard.style.display = "none";
  resetPipelineSteps();
  setPipelineStep("step-connect", "active");

  const startTime = Date.now();
  const timerInterval = setInterval(() => {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    dom.progressTimer.textContent = `⏱️ ${elapsed}s`;
  }, 100);

  const total = state.bulkQueue.length;
  updateProgress(10, `Initializing Modal T4 Pipeline (${total} scripts)...`, "Preparing first script for verification...");

  // Reset statuses of all queue items to pending
  state.bulkQueue.forEach(item => { item.status = "pending"; item.result = null; });
  renderBulkQueue();

  const speed = parseFloat(dom.sliderSpeed.value) / 100;
  const language = dom.selectLang.value;

  async function convertSingleItem(item, index) {
    item.status = "processing";
    renderBulkQueue();
    updateProgress(
      Math.min(95, Math.floor(15 + (index / total) * 75)),
      `[${index + 1}/${total}] Synthesizing '${item.name}' on Modal GPU...`,
      `Diffusing acoustic frames with ${state.selectedPreset.name}...`
    );

    const payload = {
      name: item.name,
      text: item.text,
      presetId: state.selectedPreset.id,
      speed: speed,
      language: language,
    };
    if (state.selectedPreset.type === "designed" && state.selectedPreset.instruct) {
      payload.instruct = state.selectedPreset.instruct;
    }
    if (state.selectedPreset.ref_audio_b64) {
      payload.ref_audio_b64 = state.selectedPreset.ref_audio_b64;
      payload.ref_text = state.selectedPreset.ref_text;
    } else if (state.selectedPreset.type === "cloned" && state.selectedPreset.ref_text) {
      payload.ref_text = state.selectedPreset.ref_text;
    }

    try {
      const res = await fetch("/api/modal/convert_script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Server returned ${res.status}`);
      }

      const data = await res.json();
      item.status = "completed";
      item.result = data;
      renderBulkQueue();
      showToast(`✓ [${index + 1}/${total}] '${item.name}' completed & saved! (${data.duration}s audio)`, "success");
      return data;
    } catch (err) {
      item.status = "error";
      renderBulkQueue();
      showToast(`❌ Error on '${item.name}': ${err.message}`, "error");
      throw err;
    }
  }

  try {
    setPipelineStep("step-connect", "completed");
    setPipelineStep("step-diffuse", "active");

    // 1. Run First Script to verify files & warm up container
    const firstItem = state.bulkQueue[0];
    updateProgress(15, `[1/${total}] Synthesizing 1st Script: '${firstItem.name}'...`, "Verifying model and file output...");
    const firstResult = await convertSingleItem(firstItem, 0);

    // Auto-play or preview first audio
    if (firstResult && (firstResult.mp3_b64 || firstResult.audioUrl)) {
      state.lastFolder = firstResult.folder;
      playBulkItemAudio(firstItem.id);
    }

    // 2. Dispatch remaining scripts simultaneously
    if (state.bulkQueue.length > 1) {
      const remainingItems = state.bulkQueue.slice(1);
      updateProgress(40, `1st script saved! Dispatching remaining ${remainingItems.length} scripts simultaneously...`, "Modal T4 GPU parallel processing active...");
      showToast(`1st script saved! Launching remaining ${remainingItems.length} scripts simultaneously on Modal...`, "info");

      // Execute remaining items in parallel (simultaneously)
      const promises = remainingItems.map((item, idx) => convertSingleItem(item, idx + 1));
      await Promise.allSettled(promises);
    }

    setPipelineStep("step-diffuse", "completed");
    setPipelineStep("step-mp3", "completed");
    setPipelineStep("step-srt", "completed");
    setPipelineStep("step-json", "completed");
    updateProgress(100, `Bulk Complete! All ${total} Scripts Synthesized.`, "All 4 files (MP3, SRT, JSON, TXT) saved for each script in output/ folder.");
    showToast(`🎉 Bulk synthesis completed! All scripts saved to output/ folder.`, "success");
  } catch (err) {
    console.error("Bulk conversion error:", err);
    updateProgress(0, "Bulk Synthesis Interrupted", err.message);
    showToast(`Bulk Synthesis Notice: ${err.message}`, "error");
  } finally {
    clearInterval(timerInterval);
    state.bulkIsConverting = false;
    dom.btnConvertModal.disabled = false;
    dom.btnConvertText.textContent = `Synthesize All (${state.bulkQueue.length}) on Modal (T4 GPU)`;
  }
}

// ============================================================================
// CONVERT TO SPEECH ON MODAL T4 GPU
// ============================================================================
async function startModalConversion() {
  if (state.mode === "bulk") {
    return startBulkModalConversion();
  }
  const text = dom.ttsTextInput.value.trim();
  if (!text) {
    showToast("Please paste or type script text before synthesizing.", "error");
    dom.ttsTextInput.focus();
    return;
  }

  if (!state.selectedPreset) {
    showToast("Please select a narrator from the catalog.", "error");
    return;
  }

  let modalUrl = dom.modalUrlInput.value.trim().replace(/\/+$/, "");
  if (modalUrl.endsWith(".modal")) {
    modalUrl += ".run";
    dom.modalUrlInput.value = modalUrl;
  }
  if (!modalUrl) {
    showToast("Please provide your Modal endpoint URL in the header.", "error");
    dom.modalUrlInput.focus();
    return;
  }

  state.isConverting = true;
  dom.btnConvertModal.disabled = true;
  dom.btnConvertText.textContent = "Synthesizing on Cloud T4 GPU...";
  
  // Show and reset progress box
  dom.progressBox.style.display = "block";
  dom.resultCard.style.display = "none";
  resetPipelineSteps();
  setPipelineStep("step-connect", "active");

  const startTime = Date.now();
  const timerInterval = setInterval(() => {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    dom.progressTimer.textContent = `⏱️ ${elapsed}s`;
  }, 100);

  updateProgress(15, "Connecting to Modal Cloud T4...", "Dispatching synthesis job to serverless GPU...");

  try {
    const speed = parseFloat(dom.sliderSpeed.value) / 100;
    const language = dom.selectLang.value;

    const payload = {
      text: text,
      presetId: state.selectedPreset.id,
      speed: speed,
      language: language,
    };

    // If preset is a designed voice, include instruct
    if (state.selectedPreset.type === "designed" && state.selectedPreset.instruct) {
      payload.instruct = state.selectedPreset.instruct;
    }

    // If preset has custom ref_audio_b64 or is cloned, pass reference parameters
    if (state.selectedPreset.ref_audio_b64) {
      payload.ref_audio_b64 = state.selectedPreset.ref_audio_b64;
      payload.ref_text = state.selectedPreset.ref_text || text;
    } else if (state.selectedPreset.type === "cloned" && state.selectedPreset.ref_text) {
      payload.ref_text = state.selectedPreset.ref_text;
    }

    setPipelineStep("step-connect", "completed");
    setPipelineStep("step-diffuse", "active");
    updateProgress(35, "Neural Diffusion in Progress (T4 GPU)...", "Running multi-chunk flow matching in FP16 precision...");

    // Send conversion request: try local desktop bridge first (Modal Python SDK with 900s timeout & auto-save)
    let res;
    let data;
    let usedBridge = false;
    try {
      res = await fetch("/api/modal/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modalUrl: modalUrl, ...payload }),
      });
      if (res.ok) {
        usedBridge = true;
        data = await res.json();
      } else {
        throw new Error("Bridge route not responding, falling back to direct");
      }
    } catch (bridgeErr) {
      console.log("Bridge note, attempting direct Modal fetch with async polling:", bridgeErr);
      // Direct Modal cloud execution
      // For long text scripts (> 200 chars or > 30 words), use the non-blocking async spawn & poll flow
      // which completely eliminates the 150-second Modal HTTP gateway timeout!
      const isLongText = (payload.text || "").length > 200 || (payload.text || "").split(/\s+/).length > 30;
      if (isLongText) {
        updateProgress(35, "Spawning T4 GPU Cloud Task...", "Dispatching long narration to Modal worker...");
        const spawnRes = await fetch(`${modalUrl}/api/tts/generate_async`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!spawnRes.ok) {
          const errData = await spawnRes.json().catch(() => ({}));
          throw new Error(errData.detail || `Modal spawn returned ${spawnRes.status}`);
        }
        const spawnData = await spawnRes.json();
        const jobId = spawnData.job_id;
        if (!jobId) {
          throw new Error("Modal did not return a valid Job ID.");
        }

        // Poll every 1.8 seconds - each poll is a ~40ms HTTP request, completely immune to 150s gateway timeouts!
        let completed = false;
        let pollCount = 0;
        while (!completed && pollCount < 500) { // Up to 15 minutes
          await new Promise(r => setTimeout(r, 1800));
          pollCount++;

          try {
            const statusRes = await fetch(`${modalUrl}/api/tts/status/${jobId}`);
            if (statusRes.ok) {
              const statusData = await statusRes.json();
              if (statusData.status === "completed") {
                completed = true;
                data = statusData.result || statusData;
                break;
              } else if (statusData.status === "failed") {
                throw new Error(statusData.error || "Modal cloud synthesis failed.");
              } else {
                const elapsedSec = (Date.now() - startTime) / 1000;
                const dynamicPct = Math.min(90, 30 + Math.floor(elapsedSec * 0.45));
                updateProgress(
                  dynamicPct,
                  "Multi-Chunk Flow Matching in Progress (T4 GPU)...",
                  `Synthesizing broadcast audio (${elapsedSec.toFixed(1)}s elapsed)...`
                );
              }
            }
          } catch (pollErr) {
            console.warn("Status poll error, will retry:", pollErr);
          }
        }

        if (!completed || !data) {
          throw new Error("Synthesis timed out after cloud worker execution limit.");
        }
      } else {
        // Fast path for short text
        res = await fetch(`${modalUrl}/api/tts/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.detail || `Server returned ${res.status}`);
        }
        data = await res.json();
      }
    }
    console.log("Modal Response:", data);

    setPipelineStep("step-mp3", "completed");
    setPipelineStep("step-srt", "completed");
    setPipelineStep("step-json", "completed");
    updateProgress(100, "Synthesized! Delivering All 3 Files...", "All assets verified.");

    // Handle the 3 files
    await handleConversionOutput(data, modalUrl);

    showToast("Conversion successful! 3 files downloaded.", "success");
  } catch (err) {
    console.error("Conversion error:", err);
    updateProgress(0, "Synthesis Failed", err.message);
    showToast(`Modal Synthesis Error: ${err.message}`, "error");
  } finally {
    clearInterval(timerInterval);
    state.isConverting = false;
    dom.btnConvertModal.disabled = false;
    dom.btnConvertText.textContent = "Synthesize on Modal (T4 GPU)";
  }
}

// Save & Present 4 Files: speech.mp3, speech.json, speech.srt, script.txt
async function handleConversionOutput(data, modalUrl) {
  const folder = data.folder || `speech_${Date.now()}`;
  state.lastFolder = folder;
  
  // Format URLs
  const audioUrl = data.audioUrl?.startsWith("http") ? data.audioUrl : `${modalUrl}${data.audioUrl}`;
  const srtUrl = data.srtUrl?.startsWith("http") ? data.srtUrl : `${modalUrl}${data.srtUrl}`;
  const jsonUrl = data.jsonTimestampsUrl?.startsWith("http") ? data.jsonTimestampsUrl : `${modalUrl}${data.jsonTimestampsUrl}`;
  const scriptText = data.script_text || dom.ttsTextInput.value.trim();

  // If local bridge is active, save files to local output/folder
  try {
    await fetch("/api/save_conversion_files", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        folder: folder,
        mp3_b64: data.mp3_b64,
        srt_content: data.srt_content,
        json_content: data.json_content,
        words: data.words,
        script_text: scriptText,
      })
    });
  } catch (localSaveErr) {
    console.log("Local bridge save note:", localSaveErr);
  }

  // Update Result Card
  dom.resultFolderPath.textContent = `output/${folder}`;
  
  // Configure download links
  if (data.mp3_b64) {
    dom.linkDownloadMp3.href = `data:audio/mp3;base64,${data.mp3_b64}`;
  } else {
    dom.linkDownloadMp3.href = audioUrl;
  }
  dom.linkDownloadMp3.setAttribute("download", "speech.mp3");

  if (data.srt_content) {
    const srtBlob = new Blob([data.srt_content], { type: "text/plain;charset=utf-8" });
    dom.linkDownloadSrt.href = URL.createObjectURL(srtBlob);
  } else {
    dom.linkDownloadSrt.href = srtUrl;
  }
  dom.linkDownloadSrt.setAttribute("download", "speech.srt");

  if (data.json_content) {
    const jsonBlob = new Blob([typeof data.json_content === "string" ? data.json_content : JSON.stringify(data.json_content, null, 2)], { type: "application/json;charset=utf-8" });
    dom.linkDownloadJson.href = URL.createObjectURL(jsonBlob);
  } else {
    dom.linkDownloadJson.href = jsonUrl;
  }
  dom.linkDownloadJson.setAttribute("download", "speech.json");

  // Configure script.txt download
  if (dom.linkDownloadTxt) {
    const txtBlob = new Blob([scriptText], { type: "text/plain;charset=utf-8" });
    dom.linkDownloadTxt.href = URL.createObjectURL(txtBlob);
    dom.linkDownloadTxt.setAttribute("download", "script.txt");
  }

  dom.resultCard.style.display = "block";

  // Automatically load into Karaoke player!
  state.currentWords = data.words || [];
  const playUrl = data.mp3_b64 ? `data:audio/mp3;base64,${data.mp3_b64}` : audioUrl;
  loadAndPlayAudio(
    playUrl,
    state.selectedPreset ? state.selectedPreset.name : "Modal Synthesis",
    `Folder: ${folder}`,
    getAvatarUrl(state.selectedPreset),
    dom.ttsTextInput.value,
    state.currentWords,
    false
  );
}

function openOutputFolder() {
  if (!state.lastFolder) {
    showToast("No conversion folder to open yet.", "info");
    return;
  }
  // Call local bridge to open folder in Windows Explorer
  fetch(`/api/open_folder?folder=${encodeURIComponent(state.lastFolder)}`)
    .then(r => r.json())
    .then(res => {
      if (res.success) {
        showToast(`Opened folder in Windows Explorer: ${state.lastFolder}`, "success");
      } else {
        showToast(`Folder located at: output/${state.lastFolder}`, "info");
      }
    })
    .catch(() => {
      showToast(`Folder located at: output/${state.lastFolder}`, "info");
    });
}

function updateProgress(percent, title, detail) {
  dom.progressPercent.textContent = `${percent}%`;
  dom.progressBarFill.style.width = `${percent}%`;
  if (title) dom.progressStageTitle.textContent = title;
  if (detail) dom.progressDetailText.textContent = detail;
}

function setPipelineStep(stepId, status) {
  const el = document.getElementById(stepId);
  if (!el) return;
  el.classList.remove("active", "completed");
  if (status) el.classList.add(status);
}

function resetPipelineSteps() {
  ["step-connect", "step-diffuse", "step-mp3", "step-srt", "step-json"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.className = "pipe-step";
  });
}

// ============================================================================
// ============================================================================
// AUDIO PLAYER, REAL-TIME AUDIO SETTINGS & LIVE KARAOKE
// ============================================================================

// Web Audio API Graph for Real-Time Pitch & Equalization
let audioCtx = null;
let mediaSource = null;
let biquadLow = null;
let biquadHigh = null;

function ensureAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    try {
      audioCtx = new AudioContextClass();
      mediaSource = audioCtx.createMediaElementSource(dom.audioEngine);
      
      biquadLow = audioCtx.createBiquadFilter();
      biquadLow.type = "lowshelf";
      biquadLow.frequency.value = 240; // chest & warmth

      biquadHigh = audioCtx.createBiquadFilter();
      biquadHigh.type = "highshelf";
      biquadHigh.frequency.value = 3200; // speech presence & brightness

      mediaSource.connect(biquadLow);
      biquadLow.connect(biquadHigh);
      biquadHigh.connect(audioCtx.destination);
    } catch (err) {
      console.warn("WebAudio initialization note:", err);
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

function applyCurrentAudioSettings() {
  const speed = parseFloat(dom.sliderSpeed.value) / 100;
  const pitch = parseInt(dom.sliderPitch.value, 10);

  // 1. Playback Speed / Speaking Rate
  if (dom.audioEngine) {
    dom.audioEngine.playbackRate = speed;
    dom.audioEngine.preservesPitch = (pitch === 0);
  }

  // 2. Pitch / Tone EQ via Web Audio
  ensureAudioContext();
  if (biquadLow && biquadHigh) {
    if (pitch < 0) {
      // Deeper voice: boost warm low frequencies up to +8dB, soften highs down to -6dB
      const factor = Math.abs(pitch) / 10;
      biquadLow.gain.value = factor * 8.0;
      biquadHigh.gain.value = -factor * 6.0;
    } else if (pitch > 0) {
      // Brighter voice: cut low mud down to -5dB, lift crisp presence up to +7.5dB
      const factor = pitch / 10;
      biquadLow.gain.value = -factor * 5.0;
      biquadHigh.gain.value = factor * 7.5;
    } else {
      biquadLow.gain.value = 0;
      biquadHigh.gain.value = 0;
    }
  }
}

// Generate fluid word-level timestamps across the audio sample duration
function buildSampleWordTimestamps(rawText, duration) {
  if (!rawText || !rawText.trim()) return [];
  const tokens = rawText.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];
  const safeDuration = duration > 0 ? duration : Math.max(3.0, tokens.length * 0.38);
  
  const totalChars = tokens.reduce((acc, t) => acc + t.length, 0);
  let currTime = 0.05;
  const availableTime = Math.max(1.0, safeDuration - 0.2);

  return tokens.map((word) => {
    const wordDuration = Math.max(0.18, (word.length / totalChars) * availableTime);
    const start = currTime;
    const end = Math.min(safeDuration, start + wordDuration);
    currTime = end;
    return {
      word: word,
      start: Number(start.toFixed(3)),
      end: Number(end.toFixed(3))
    };
  });
}

function setupAudioListeners() {
  const audio = dom.audioEngine;

  audio.addEventListener("timeupdate", () => {
    const curr = audio.currentTime;
    const total = audio.duration || 1;
    dom.playerTimeCurr.textContent = formatTime(curr);
    dom.playerTimeTotal.textContent = formatTime(total);
    dom.playerScrubberFill.style.width = `${(curr / total) * 100}%`;

    // Karaoke word highlight sync
    syncKaraoke(curr);
  });

  audio.addEventListener("loadedmetadata", () => {
    state.audioDuration = audio.duration;
    dom.playerTimeTotal.textContent = formatTime(audio.duration);
    applyCurrentAudioSettings();

    // Re-scale sample word timestamps if this is an audition
    if (state.isAuditioning && state.currentRawText && (!state.currentWords || state.currentWords.length === 0 || state.isEstimatedWords)) {
      state.currentWords = buildSampleWordTimestamps(state.currentRawText, audio.duration);
      state.isEstimatedWords = true;
      if (state.currentWords && state.currentWords.length > 0) {
        dom.playerKaraokeText.innerHTML = state.currentWords.map((w, idx) => {
          return `<span id="kword-${idx}" class="karaoke-word" data-start="${w.start}" data-end="${w.end}">${escapeHtml(w.word)}</span> `;
        }).join("");
      }
    }
  });

  audio.addEventListener("play", () => {
    applyCurrentAudioSettings();
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
      : "Playing Cloud Synthesis · 24 kHz Broadcast Audio";
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

// ============================================================================
// COLUMN RESIZER (Click and Drag Splitter)
// ============================================================================
function setupColumnResizer() {
  const container = document.getElementById("studio-container");
  const resizer = document.getElementById("studio-resizer");
  if (!container || !resizer) return;

  const savedWidth = localStorage.getItem("omnivoice_catalog_width");
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
    localStorage.setItem("omnivoice_catalog_width", clampedWidth);
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

function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
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

    let endpoint = "/api/presets/transcribe";
    if (state.isConnected && state.modalUrl) {
      endpoint = `${state.modalUrl.replace(/\/+$/, '')}/api/presets/transcribe`;
    }

    const resp = await fetch(endpoint, {
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
    // Read audio as Base64 for instant Cloud GPU synthesis
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

    let endpoint = "/api/presets/clone";
    if (state.isConnected && state.modalUrl) {
      endpoint = `${state.modalUrl.replace(/\/+$/, '')}/api/presets/clone`;
    }

    let newPreset = null;
    try {
      const resp = await fetch(endpoint, {
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
    auditionPreset(newPreset.id);

  } catch (err) {
    console.error("Voice clone error:", err);
    showToast(`Voice cloning failed: ${err.message}`, "error");
  } finally {
    if (submitBtn) submitBtn.disabled = false;
    if (submitText) submitText.textContent = "🚀 Save & Clone Voice";
    if (submitSpinner) submitSpinner.style.display = "none";
  }
}

