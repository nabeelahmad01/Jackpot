let unlocked = false;
let sharedCtx = null;

function getCtx() {
  if (typeof window === 'undefined') return null;
  if (!sharedCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    sharedCtx = new Ctx();
  }
  return sharedCtx;
}

// Browsers block audio until the user interacts with the page.
// Prime a shared AudioContext on the first gesture so later alerts can play.
export function initAudioUnlock() {
  if (typeof window === 'undefined' || unlocked) return;

  const unlock = () => {
    try {
      const ctx = getCtx();
      if (ctx) {
        if (ctx.state === 'suspended') ctx.resume().catch(() => {});
        const buffer = ctx.createBuffer(1, 1, 22050);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.start(0);
      }
    } catch (e) {
      // ignore
    }
    unlocked = true;
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
    window.removeEventListener('touchstart', unlock);
  };

  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
  window.addEventListener('touchstart', unlock);
}

function playSynth() {
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});

  const playTone = (freq, startTime, duration) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, startTime);
    gain.gain.setValueAtTime(0.12, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    osc.start(startTime);
    osc.stop(startTime + duration);
  };

  const now = ctx.currentTime;
  playTone(523.25, now, 0.12);
  playTone(659.25, now + 0.08, 0.25);
}

// Play custom uploaded sound if provided, otherwise a synthesized chime.
export function playNotificationSound(customUrl) {
  if (typeof window === 'undefined') return;
  try {
    if (customUrl) {
      const cleanUrl = customUrl.replace(/^data:video\/[^;]+;/, 'data:audio/mpeg;');
      const audio = new Audio(cleanUrl);
      audio.play().catch(() => playSynth());
    } else {
      playSynth();
    }
  } catch (e) {
    playSynth();
  }
}
