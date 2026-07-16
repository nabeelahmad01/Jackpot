let unlocked = false;
let sharedCtx = null;
let activeAudio = null;
let lastPlayAt = 0;
const PLAY_COOLDOWN_MS = 1800;

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
    } catch (_) {
      // ignore unlock errors
    }
    unlocked = true;
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
    window.removeEventListener('touchstart', unlock);
  };

  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('keydown', unlock);
  window.addEventListener('touchstart', unlock, { passive: true });
}

function playSynth() {
  try {
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
  } catch (_) {
    // ignore synth errors
  }
}

function stopActiveAudio() {
  if (!activeAudio) return;
  try {
    activeAudio.pause();
    activeAudio.currentTime = 0;
  } catch (_) {
    // ignore
  }
  activeAudio = null;
}

/**
 * Play alert sound once. Rapid repeat calls within cooldown are ignored
 * so parent + open tab both detecting the same event still produce one beep.
 */
export function playNotificationSound(customUrl) {
  if (typeof window === 'undefined') return false;

  const now = Date.now();
  if (now - lastPlayAt < PLAY_COOLDOWN_MS) return false;
  lastPlayAt = now;

  try {
    stopActiveAudio();

    if (customUrl) {
      const cleanUrl = String(customUrl).replace(/^data:video\/[^;]+;/, 'data:audio/mpeg;');
      const audio = new Audio(cleanUrl);
      audio.preload = 'auto';
      activeAudio = audio;
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.then === 'function') {
        playPromise.catch(() => {
          if (activeAudio === audio) activeAudio = null;
          playSynth();
        });
      }
      audio.onended = () => {
        if (activeAudio === audio) activeAudio = null;
      };
      return true;
    }

    playSynth();
    return true;
  } catch (_) {
    playSynth();
    return true;
  }
}
