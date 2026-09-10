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

function getAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioContext;
}

function playNote(note, beats) {
  const ctx = getAudioContext();
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();

  oscillator.type = "sine";
  oscillator.frequency.value = NOTE_FREQUENCIES[note];

  const seconds = beats * 0.4;
  const now = ctx.currentTime;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.3, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + seconds);

  oscillator.connect(gain);
  gain.connect(ctx.destination);

  oscillator.start(now);
  oscillator.stop(now + seconds);
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

function drawNote(svg, x, note) {
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

function renderStave() {
  const container = document.getElementById("melody");
  container.innerHTML = "";

  if (melody.length === 0) return;

  const bars = groupIntoBars();
  const totalNotes = melody.length;
  const width = CLEF_WIDTH + totalNotes * NOTE_SLOT_WIDTH + bars.length * BAR_LINE_GAP + 20;

  const svg = svgEl("svg", { width, height: SVG_HEIGHT, viewBox: `0 0 ${width} ${SVG_HEIGHT}` });
  drawStaveLines(svg, width);
  drawClef(svg);

  let x = CLEF_WIDTH + 20;
  bars.forEach((bar) => {
    bar.forEach((note) => {
      drawNote(svg, x, note);
      x += NOTE_SLOT_WIDTH;
    });
    svg.appendChild(
      svgEl("line", { x1: x, y1: TOP_LINE_Y, x2: x, y2: BOTTOM_LINE_Y, stroke: "#333", "stroke-width": 1.2 })
    );
    x += BAR_LINE_GAP;
  });

  container.appendChild(svg);
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
