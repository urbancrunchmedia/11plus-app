let _ctx = null;

function getCtx() {
  if (!_ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    _ctx = new AC();
  }
  return _ctx;
}

// iOS/Android lock audio until the first real user gesture. Unlock once on the
// first interaction anywhere: resume the context and play a 1-sample silent
// buffer (the trick that fully wakes Web Audio on iOS). After this, the tones
// below play instantly from any tap.
function unlock() {
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") c.resume().catch(() => {});
  try {
    const src = c.createBufferSource();
    src.buffer = c.createBuffer(1, 1, 22050);
    src.connect(c.destination);
    src.start(0);
  } catch (_) {}
}

if (typeof window !== "undefined") {
  const onFirst = () => {
    unlock();
    ["pointerdown", "touchstart", "touchend", "click", "keydown"].forEach((e) =>
      window.removeEventListener(e, onFirst)
    );
  };
  ["pointerdown", "touchstart", "touchend", "click", "keydown"].forEach((e) =>
    window.addEventListener(e, onFirst, { passive: true })
  );
}

function playTones(schedule) {
  try {
    const c = getCtx();
    if (!c) return;
    const run = () => schedule(c, c.currentTime);
    if (c.state === "suspended") {
      c.resume().then(run).catch(() => {});
    } else {
      run();
    }
  } catch (_) {}
}

function tone(c, freq, start, duration, vol = 0.28) {
  const osc  = c.createOscillator();
  const gain = c.createGain();
  osc.connect(gain);
  gain.connect(c.destination);
  osc.type = "sine";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(vol, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  osc.start(start);
  osc.stop(start + duration);
}

export function playCorrect() {
  try { if (navigator.vibrate) navigator.vibrate(40); } catch (_) {}

  playTones((c, now) => {
    tone(c, 523,  now,        0.6,  0.18);  // C5
    tone(c, 784,  now + 0.12, 0.55, 0.12);  // G5
    tone(c, 1047, now + 0.24, 0.7,  0.08);  // C6
  });
}

export function playWrong() {
  try { if (navigator.vibrate) navigator.vibrate([40, 60, 40]); } catch (_) {}

  playTones((c, now) => {
    const osc  = c.createOscillator();
    const gain = c.createGain();
    osc.connect(gain);
    gain.connect(c.destination);
    osc.type = "square";
    osc.frequency.value = 160;
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.start(now);
    osc.stop(now + 0.18);
  });
}
