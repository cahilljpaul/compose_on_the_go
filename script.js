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
  renderMelody();
}

function renderMelody() {
  const container = document.getElementById("melody");
  container.innerHTML = "";

  let bar = [];
  let beatsInBar = 0;
  let barNumber = 1;

  function flushBar() {
    if (bar.length === 0) return;
    const barEl = document.createElement("span");
    barEl.className = "bar";
    barEl.textContent = `Bar ${barNumber}: ${bar.map((n) => `${n.pitch}(${n.duration})`).join(" ")}`;
    container.appendChild(barEl);
    barNumber += 1;
    bar = [];
    beatsInBar = 0;
  }

  for (const note of melody) {
    bar.push(note);
    beatsInBar += note.beats;
    if (beatsInBar >= BEATS_PER_BAR) {
      flushBar();
    }
  }
  flushBar();
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
