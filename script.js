const NOTE_FREQUENCIES = {
  C4: 261.63,
  D4: 293.66,
  E4: 329.63,
  F4: 349.23,
  G4: 392.0,
  A4: 440.0,
  B4: 493.88,
  C5: 523.25,
};

const DURATION_BEATS = {
  whole: 4,
  half: 2,
  quarter: 1,
  eighth: 0.5,
};

const BEATS_PER_BAR = 4;

const melody = [];
let selectedDuration = "quarter";
let audioContext = null;
let isPlaying = false;

function getSecondsPerBeat() {
  const bpm = Number(document.getElementById("tempo-input").value) || 90;
  return 60 / bpm;
}

function getAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioContext;
}

function scheduleNoteOn(ctx, pitch, seconds, startTime) {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();

  oscillator.type = "sine";
  oscillator.frequency.value = NOTE_FREQUENCIES[pitch];

  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(0.3, startTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + seconds);

  oscillator.connect(gain);
  gain.connect(ctx.destination);

  oscillator.start(startTime);
  oscillator.stop(startTime + seconds);
}

function scheduleNote(pitch, seconds, startTime) {
  scheduleNoteOn(getAudioContext(), pitch, seconds, startTime);
}

function playNote(pitch, beats) {
  scheduleNote(pitch, beats * getSecondsPerBeat(), getAudioContext().currentTime);
}

function beatsUsedInLastBar() {
  let used = 0;
  for (const note of melody) {
    used += note.beats;
    if (used >= BEATS_PER_BAR) {
      used = used % BEATS_PER_BAR;
    }
  }
  return used;
}

function showMessage(text) {
  const message = document.getElementById("message");
  message.textContent = text;
  clearTimeout(showMessage.timer);
  showMessage.timer = setTimeout(() => (message.textContent = ""), 1500);
}

function addNote(pitch) {
  const beats = DURATION_BEATS[selectedDuration];
  const beatsUsed = beatsUsedInLastBar();

  if (beatsUsed + beats > BEATS_PER_BAR) {
    showMessage(`Not enough room left in this bar for a ${selectedDuration} note`);
    return;
  }

  melody.push({ pitch, duration: selectedDuration, beats });
  renderStave();
}

function undo() {
  if (melody.length === 0) return;
  melody.pop();
  if (selectedNoteIndex !== null && selectedNoteIndex >= melody.length) {
    hideCorrectionPanel();
  }
  renderStave();
}

function playMelody() {
  if (isPlaying || melody.length === 0) return;
  isPlaying = true;
  document.getElementById("play-btn").disabled = true;

  const ctx = getAudioContext();
  const secondsPerBeat = getSecondsPerBeat();
  const startedAt = ctx.currentTime + 0.05;
  let t = startedAt;

  melody.forEach((note, index) => {
    const seconds = note.beats * secondsPerBeat;
    scheduleNote(note.pitch, seconds, t);

    const delayMs = (t - ctx.currentTime) * 1000;
    setTimeout(() => setNoteHighlight(index, true), delayMs);
    setTimeout(() => setNoteHighlight(index, false), delayMs + seconds * 900);

    t += seconds;
  });

  setTimeout(() => {
    isPlaying = false;
    document.getElementById("play-btn").disabled = false;
  }, (t - ctx.currentTime) * 1000);
}

function setNoteHighlight(index, on) {
  const notehead = document.querySelector(`.notehead[data-index="${index}"]`);
  if (notehead) notehead.classList.toggle("playing", on);
}

function groupIntoBars() {
  const bars = [];
  let bar = [];
  let beatsInBar = 0;

  for (const note of melody) {
    bar.push(note);
    beatsInBar += note.beats;
    if (beatsInBar >= BEATS_PER_BAR) {
      bars.push(bar);
      bar = [];
      beatsInBar = 0;
    }
  }
  if (bar.length > 0) bars.push(bar);
  return bars;
}

// Vertical position of each pitch, in half-line-spacing steps up from the
// bottom stave line (E4). Alternating lines/spaces of a treble stave.
const NOTE_STEP = {
  C4: -2,
  D4: -1,
  E4: 0,
  F4: 1,
  G4: 2,
  A4: 3,
  B4: 4,
  C5: 5,
};

const LINE_SPACING = 10;
const HALF_STEP = LINE_SPACING / 2;
const BOTTOM_LINE_Y = 90;
const TOP_LINE_Y = BOTTOM_LINE_Y - 4 * LINE_SPACING;
const NOTE_SLOT_WIDTH = 45;
const BAR_LINE_GAP = 15;
const CLEF_WIDTH = 60;
const SVG_HEIGHT = 150;

function pitchY(pitch) {
  return BOTTOM_LINE_Y - NOTE_STEP[pitch] * HALF_STEP;
}

function svgEl(tag, attrs) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [key, value] of Object.entries(attrs)) {
    el.setAttribute(key, value);
  }
  return el;
}

function drawStaveLines(svg, width) {
  for (let i = 0; i < 5; i++) {
    const y = TOP_LINE_Y + i * LINE_SPACING;
    svg.appendChild(
      svgEl("line", { x1: 5, y1: y, x2: width - 5, y2: y, stroke: "#333", "stroke-width": 1 })
    );
  }
}

function drawClef(svg) {
  const clef = svgEl("text", {
    x: 8,
    y: BOTTOM_LINE_Y + 6,
    "font-size": 62,
    "font-family": "Bravura, Leland, 'Noto Music', 'Apple Symbols', serif",
  });
  clef.textContent = "\u{1D11E}";
  svg.appendChild(clef);
}

function drawNote(svg, x, note, index, interactive) {
  const y = pitchY(note.pitch);
  const isHollow = note.duration === "whole" || note.duration === "half";
  const hasStem = note.duration !== "whole";

  if (note.pitch === "C4") {
    svg.appendChild(
      svgEl("line", { x1: x - 9, y1: y, x2: x + 9, y2: y, stroke: "#333", "stroke-width": 1 })
    );
  }

  const isSelected = interactive && index === selectedNoteIndex;
  const notehead = svgEl("ellipse", {
    cx: x,
    cy: y,
    rx: 6,
    ry: 4.5,
    fill: isHollow ? "none" : isSelected ? "#e08b2f" : "#222",
    stroke: isSelected ? "#e08b2f" : "#222",
    "stroke-width": 1.2,
    class: isSelected ? "notehead selected" : "notehead",
    "data-index": index,
  });
  if (interactive) {
    notehead.addEventListener("pointerdown", () => selectNote(index));
  }
  svg.appendChild(notehead);

  if (hasStem) {
    const stemTopY = y - 32;
    svg.appendChild(
      svgEl("line", { x1: x + 6, y1: y, x2: x + 6, y2: stemTopY, stroke: "#222", "stroke-width": 1.2 })
    );

    if (note.duration === "eighth") {
      svg.appendChild(
        svgEl("path", {
          d: `M ${x + 6} ${stemTopY} q 10 4 10 16`,
          fill: "none",
          stroke: "#222",
          "stroke-width": 1.2,
        })
      );
    }
  }
}

function staveWidth(bars) {
  return CLEF_WIDTH + melody.length * NOTE_SLOT_WIDTH + bars.length * BAR_LINE_GAP + 20;
}

function buildStaveContent(container, bars, width, interactive = false) {
  drawStaveLines(container, width);
  drawClef(container);

  let x = CLEF_WIDTH + 20;
  let index = 0;
  bars.forEach((bar) => {
    bar.forEach((note) => {
      drawNote(container, x, note, index, interactive);
      x += NOTE_SLOT_WIDTH;
      index += 1;
    });
    container.appendChild(
      svgEl("line", { x1: x, y1: TOP_LINE_Y, x2: x, y2: BOTTOM_LINE_Y, stroke: "#333", "stroke-width": 1.2 })
    );
    x += BAR_LINE_GAP;
  });
}

function renderStave() {
  const container = document.getElementById("melody");
  container.innerHTML = "";

  if (melody.length === 0) return;

  const bars = groupIntoBars();
  const width = staveWidth(bars);

  const svg = svgEl("svg", { width, height: SVG_HEIGHT, viewBox: `0 0 ${width} ${SVG_HEIGHT}` });
  buildStaveContent(svg, bars, width, true);

  container.appendChild(svg);
}

const PITCH_ORDER = ["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5"];
let selectedNoteIndex = null;

function selectNote(index) {
  selectedNoteIndex = index;
  renderStave();
  showCorrectionPanel();
}

function showCorrectionPanel() {
  const panel = document.getElementById("correction");
  if (selectedNoteIndex === null || !melody[selectedNoteIndex]) {
    panel.classList.add("hidden");
    return;
  }
  const note = melody[selectedNoteIndex];
  document.getElementById("correction-label").textContent =
    `Note ${selectedNoteIndex + 1}: ${note.pitch} (${note.duration})`;
  panel.classList.remove("hidden");
}

function hideCorrectionPanel() {
  selectedNoteIndex = null;
  document.getElementById("correction").classList.add("hidden");
}

function shiftSelectedPitch(delta) {
  if (selectedNoteIndex === null) return;
  const note = melody[selectedNoteIndex];
  const currentIndex = PITCH_ORDER.indexOf(note.pitch);
  const nextIndex = Math.min(PITCH_ORDER.length - 1, Math.max(0, currentIndex + delta));
  note.pitch = PITCH_ORDER[nextIndex];
  renderStave();
  showCorrectionPanel();
}

function setSelectedDuration(durationName) {
  if (selectedNoteIndex === null) return;
  const note = melody[selectedNoteIndex];
  note.duration = durationName;
  note.beats = DURATION_BEATS[durationName];
  renderStave();
  showCorrectionPanel();
}

function deleteSelectedNote() {
  if (selectedNoteIndex === null) return;
  melody.splice(selectedNoteIndex, 1);
  hideCorrectionPanel();
  renderStave();
}

const CARD_PADDING_X = 20;
const CARD_PADDING_Y = 20;
const CARD_HEADER_HEIGHT = 36;
const CARD_MESSAGE_HEIGHT = 30;
const CARD_FOOTER_HEIGHT = 22;

function buildCardSvg(title, tempo, message) {
  const bars = groupIntoBars();
  const width = staveWidth(bars);
  const cardWidth = Math.max(360, width + CARD_PADDING_X * 2);
  const cardHeight =
    CARD_PADDING_Y * 2 +
    CARD_HEADER_HEIGHT +
    SVG_HEIGHT +
    (message ? CARD_MESSAGE_HEIGHT : 0) +
    CARD_FOOTER_HEIGHT;

  const svg = svgEl("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    width: cardWidth,
    height: cardHeight,
    viewBox: `0 0 ${cardWidth} ${cardHeight}`,
  });

  svg.appendChild(
    svgEl("rect", {
      x: 0,
      y: 0,
      width: cardWidth,
      height: cardHeight,
      rx: 14,
      fill: "#fdfaf5",
      stroke: "#e2ddd2",
    })
  );

  const titleEl = svgEl("text", {
    x: CARD_PADDING_X,
    y: CARD_PADDING_Y + 20,
    "font-size": 18,
    "font-family": "system-ui, sans-serif",
    "font-weight": "bold",
    fill: "#222",
  });
  titleEl.textContent = title || "Untitled sketch";
  svg.appendChild(titleEl);

  const tempoEl = svgEl("text", {
    x: cardWidth - CARD_PADDING_X,
    y: CARD_PADDING_Y + 20,
    "text-anchor": "end",
    "font-size": 13,
    "font-family": "system-ui, sans-serif",
    fill: "#777",
  });
  tempoEl.textContent = `♩ = ${tempo} bpm`;
  svg.appendChild(tempoEl);

  const staveGroup = svgEl("g", {
    transform: `translate(${CARD_PADDING_X}, ${CARD_PADDING_Y + CARD_HEADER_HEIGHT})`,
  });
  buildStaveContent(staveGroup, bars, width);
  svg.appendChild(staveGroup);

  if (message) {
    const messageEl = svgEl("text", {
      x: CARD_PADDING_X,
      y: CARD_PADDING_Y + CARD_HEADER_HEIGHT + SVG_HEIGHT + 20,
      "font-size": 13,
      "font-family": "system-ui, sans-serif",
      "font-style": "italic",
      fill: "#555",
    });
    messageEl.textContent = message;
    svg.appendChild(messageEl);
  }

  const watermark = svgEl("text", {
    x: cardWidth - CARD_PADDING_X,
    y: cardHeight - 8,
    "text-anchor": "end",
    "font-size": 11,
    "font-family": "system-ui, sans-serif",
    fill: "#bbb",
  });
  watermark.textContent = "Few Bars";
  svg.appendChild(watermark);

  return svg;
}

function svgToPngBlob(svg) {
  const width = Number(svg.getAttribute("width"));
  const height = Number(svg.getAttribute("height"));
  const svgString = new XMLSerializer().serializeToString(svg);
  const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = 2;
      const canvas = document.createElement("canvas");
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext("2d");
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))), "image/png");
    };
    img.onerror = reject;
    img.src = svgUrl;
  });
}

function encodeWavMono(samples, sampleRate) {
  const bytesPerSample = 2;
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  function writeString(offset, str) {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  }

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += bytesPerSample;
  }

  return new Blob([buffer], { type: "audio/wav" });
}

async function renderMelodyToWavBlob() {
  const secondsPerBeat = getSecondsPerBeat();
  const totalSeconds = melody.reduce((sum, note) => sum + note.beats * secondsPerBeat, 0) + 0.3;
  const sampleRate = 44100;
  const offlineCtx = new OfflineAudioContext(1, Math.ceil(sampleRate * totalSeconds), sampleRate);

  let t = 0;
  melody.forEach((note) => {
    const seconds = note.beats * secondsPerBeat;
    scheduleNoteOn(offlineCtx, note.pitch, seconds, t);
    t += seconds;
  });

  const buffer = await offlineCtx.startRendering();
  return encodeWavMono(buffer.getChannelData(0), buffer.sampleRate);
}

async function exportCard() {
  if (melody.length === 0) {
    showMessage("Add some notes before exporting");
    return;
  }

  const title = document.getElementById("title-input").value.trim();
  const tempo = document.getElementById("tempo-input").value || 90;
  const message = document.getElementById("message-input").value.trim();

  const svg = buildCardSvg(title, tempo, message);
  const [imageBlob, audioBlob] = await Promise.all([svgToPngBlob(svg), renderMelodyToWavBlob()]);

  const preview = document.getElementById("card-preview");
  preview.src = URL.createObjectURL(imageBlob);
  preview.classList.add("visible");

  const audioPreview = document.getElementById("audio-preview");
  audioPreview.src = URL.createObjectURL(audioBlob);
  audioPreview.classList.add("visible");

  const imageFile = new File([imageBlob], "few-bars.png", { type: "image/png" });
  const audioFile = new File([audioBlob], "few-bars.wav", { type: "audio/wav" });

  if (navigator.canShare && navigator.canShare({ files: [imageFile, audioFile] })) {
    try {
      await navigator.share({
        files: [imageFile, audioFile],
        title: title || "Few Bars sketch",
        text: message,
      });
      return;
    } catch (err) {
      if (err.name === "AbortError") return;
    }
  }

  [
    { blob: imageBlob, name: "few-bars.png" },
    { blob: audioBlob, name: "few-bars.wav" },
  ].forEach(({ blob, name }) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  });
}

document.querySelectorAll(".duration").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".duration").forEach((b) => b.classList.remove("active"));
    button.classList.add("active");
    selectedDuration = button.dataset.duration;
  });
});

document.querySelectorAll(".key").forEach((key) => {
  key.addEventListener("pointerdown", () => {
    const note = key.dataset.note;
    playNote(note, DURATION_BEATS[selectedDuration]);
    key.classList.add("active");
    addNote(note);
  });

  key.addEventListener("pointerup", () => key.classList.remove("active"));
  key.addEventListener("pointerleave", () => key.classList.remove("active"));
});

document.getElementById("play-btn").addEventListener("click", playMelody);
document.getElementById("undo-btn").addEventListener("click", undo);
document.getElementById("export-btn").addEventListener("click", exportCard);

document.getElementById("pitch-up-btn").addEventListener("click", () => shiftSelectedPitch(1));
document.getElementById("pitch-down-btn").addEventListener("click", () => shiftSelectedPitch(-1));
document.getElementById("delete-note-btn").addEventListener("click", deleteSelectedNote);
document.getElementById("deselect-btn").addEventListener("click", () => {
  hideCorrectionPanel();
  renderStave();
});
document.querySelectorAll(".correction-duration").forEach((button) => {
  button.addEventListener("click", () => setSelectedDuration(button.dataset.duration));
});

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function frequencyToNoteName(freq) {
  const midi = Math.round(69 + 12 * Math.log2(freq / 440));
  const name = NOTE_NAMES[((midi % 12) + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${name}${octave}`;
}

// Autocorrelation pitch detector: finds the lag (period) at which the
// waveform best matches a shifted copy of itself, then refines it with
// parabolic interpolation around the peak for sub-sample accuracy.
function autoCorrelate(buffer, sampleRate) {
  const size = buffer.length;

  let rms = 0;
  for (let i = 0; i < size; i++) rms += buffer[i] * buffer[i];
  rms = Math.sqrt(rms / size);
  if (rms < 0.01) return -1;

  let start = 0;
  let end = size - 1;
  const threshold = 0.2;
  while (start < size / 2 && Math.abs(buffer[start]) < threshold) start++;
  while (end > size / 2 && Math.abs(buffer[end]) < threshold) end--;

  const trimmed = buffer.slice(start, end);
  const n = trimmed.length;
  if (n < 8) return -1;

  const correlation = new Array(n).fill(0);
  for (let lag = 0; lag < n; lag++) {
    for (let i = 0; i < n - lag; i++) {
      correlation[lag] += trimmed[i] * trimmed[i + lag];
    }
  }

  let d = 0;
  while (d < n - 1 && correlation[d] > correlation[d + 1]) d++;

  let maxValue = -1;
  let maxLag = -1;
  for (let lag = d; lag < n; lag++) {
    if (correlation[lag] > maxValue) {
      maxValue = correlation[lag];
      maxLag = lag;
    }
  }
  if (maxLag <= 0) return -1;

  const prev = correlation[maxLag - 1] ?? correlation[maxLag];
  const curr = correlation[maxLag];
  const next = correlation[maxLag + 1] ?? correlation[maxLag];
  const a = (prev + next - 2 * curr) / 2;
  const b = (next - prev) / 2;
  const refinedLag = a ? maxLag - b / (2 * a) : maxLag;

  return refinedLag > 0 ? sampleRate / refinedLag : -1;
}

const DURATION_OPTIONS_BEATS = [0.5, 1, 2, 4];
const BEATS_TO_DURATION_NAME = { 0.5: "eighth", 1: "quarter", 2: "half", 4: "whole" };
const MIN_HUM_NOTE_BEATS = 0.2;

function nearestAllowedPitch(freq) {
  let best = null;
  let bestDiff = Infinity;
  for (const [pitch, pitchFreq] of Object.entries(NOTE_FREQUENCIES)) {
    const diff = Math.abs(Math.log2(freq / pitchFreq));
    if (diff < bestDiff) {
      bestDiff = diff;
      best = pitch;
    }
  }
  return best;
}

function nearestDurationBeats(rawBeats) {
  return DURATION_OPTIONS_BEATS.reduce((best, option) =>
    Math.abs(option - rawBeats) < Math.abs(best - rawBeats) ? option : best
  );
}

let humStream = null;
let humSource = null;
let humAnalyser = null;
let humRafId = null;
let isHumming = false;
let humCurrentPitch = null;
let humNoteStartedAt = 0;

async function startHumming() {
  const ctx = getAudioContext();
  humStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  humSource = ctx.createMediaStreamSource(humStream);
  humAnalyser = ctx.createAnalyser();
  humAnalyser.fftSize = 2048;
  humSource.connect(humAnalyser);

  isHumming = true;
  humCurrentPitch = null;
  document.getElementById("hum-btn").textContent = "Stop humming";
  document.getElementById("hum-btn").classList.add("listening");
  detectPitchLoop();
}

function stopHumming() {
  isHumming = false;
  cancelAnimationFrame(humRafId);
  if (humCurrentPitch !== null) {
    finalizeHummedNote();
    humCurrentPitch = null;
  }
  humStream.getTracks().forEach((track) => track.stop());
  humSource.disconnect();

  document.getElementById("hum-btn").textContent = "Start humming";
  document.getElementById("hum-btn").classList.remove("listening");
  document.getElementById("pitch-readout").textContent = "—";
}

function finalizeHummedNote() {
  const elapsedSeconds = (performance.now() - humNoteStartedAt) / 1000;
  const rawBeats = elapsedSeconds / getSecondsPerBeat();
  if (rawBeats < MIN_HUM_NOTE_BEATS) return;

  let beats = nearestDurationBeats(rawBeats);
  const room = BEATS_PER_BAR - beatsUsedInLastBar();
  while (beats > room) {
    beats = DURATION_OPTIONS_BEATS[DURATION_OPTIONS_BEATS.indexOf(beats) - 1];
  }

  melody.push({ pitch: humCurrentPitch, duration: BEATS_TO_DURATION_NAME[beats], beats });
  renderStave();
}

function detectPitchLoop() {
  if (!isHumming) return;

  const buffer = new Float32Array(humAnalyser.fftSize);
  humAnalyser.getFloatTimeDomainData(buffer);
  const freq = autoCorrelate(buffer, getAudioContext().sampleRate);
  const readout = document.getElementById("pitch-readout");

  if (freq > 0) {
    const pitch = nearestAllowedPitch(freq);
    readout.textContent = `${freq.toFixed(1)} Hz  ≈  ${frequencyToNoteName(freq)}  →  ${pitch}`;

    if (humCurrentPitch === null) {
      humCurrentPitch = pitch;
      humNoteStartedAt = performance.now();
    } else if (pitch !== humCurrentPitch) {
      finalizeHummedNote();
      humCurrentPitch = pitch;
      humNoteStartedAt = performance.now();
    }
  } else {
    readout.textContent = "...";
    if (humCurrentPitch !== null) {
      finalizeHummedNote();
      humCurrentPitch = null;
    }
  }

  humRafId = requestAnimationFrame(detectPitchLoop);
}

document.getElementById("hum-btn").addEventListener("click", () => {
  if (isHumming) {
    stopHumming();
  } else {
    startHumming().catch((err) => showMessage(`Microphone access failed: ${err.message}`));
  }
});
