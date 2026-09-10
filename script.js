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

function scheduleNote(pitch, seconds, startTime) {
  const ctx = getAudioContext();
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

function drawNote(svg, x, note, index) {
  const y = pitchY(note.pitch);
  const isHollow = note.duration === "whole" || note.duration === "half";
  const hasStem = note.duration !== "whole";

  if (note.pitch === "C4") {
    svg.appendChild(
      svgEl("line", { x1: x - 9, y1: y, x2: x + 9, y2: y, stroke: "#333", "stroke-width": 1 })
    );
  }

  svg.appendChild(
    svgEl("ellipse", {
      cx: x,
      cy: y,
      rx: 6,
      ry: 4.5,
      fill: isHollow ? "none" : "#222",
      stroke: "#222",
      "stroke-width": 1.2,
      class: "notehead",
      "data-index": index,
    })
  );

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

function buildStaveContent(container, bars, width) {
  drawStaveLines(container, width);
  drawClef(container);

  let x = CLEF_WIDTH + 20;
  let index = 0;
  bars.forEach((bar) => {
    bar.forEach((note) => {
      drawNote(container, x, note, index);
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
  buildStaveContent(svg, bars, width);

  container.appendChild(svg);
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

async function exportCard() {
  if (melody.length === 0) {
    showMessage("Add some notes before exporting");
    return;
  }

  const title = document.getElementById("title-input").value.trim();
  const tempo = document.getElementById("tempo-input").value || 90;
  const message = document.getElementById("message-input").value.trim();

  const svg = buildCardSvg(title, tempo, message);
  const blob = await svgToPngBlob(svg);

  const preview = document.getElementById("card-preview");
  preview.src = URL.createObjectURL(blob);
  preview.classList.add("visible");

  const file = new File([blob], "few-bars.png", { type: "image/png" });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: title || "Few Bars sketch", text: message });
      return;
    } catch (err) {
      if (err.name === "AbortError") return;
    }
  }

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "few-bars.png";
  document.body.appendChild(a);
  a.click();
  a.remove();
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
