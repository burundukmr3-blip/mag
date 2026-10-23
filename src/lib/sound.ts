// Звуковые сигналы синтезируются в браузере, файлы не нужны (И13).
type SoundName = 'open' | 'correct' | 'wrong' | 'timeUp' | 'special' | 'final';

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  } catch {
    return null;
  }
}

function tone(ac: AudioContext, freq: number, at: number, dur: number, type: OscillatorType = 'sine', volume = 0.18): void {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ac.currentTime + at);
  gain.gain.setValueAtTime(0.0001, ac.currentTime + at);
  gain.gain.exponentialRampToValueAtTime(volume, ac.currentTime + at + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + at + dur);
  osc.connect(gain).connect(ac.destination);
  osc.start(ac.currentTime + at);
  osc.stop(ac.currentTime + at + dur + 0.05);
}

const PATTERNS: Record<SoundName, (ac: AudioContext) => void> = {
  open: (ac) => {
    tone(ac, 523, 0, 0.18, 'triangle');
    tone(ac, 784, 0.12, 0.3, 'triangle');
  },
  correct: (ac) => {
    [523, 659, 784, 1047].forEach((f, i) => tone(ac, f, i * 0.09, 0.25, 'triangle', 0.2));
  },
  wrong: (ac) => {
    tone(ac, 196, 0, 0.45, 'sawtooth', 0.12);
    tone(ac, 147, 0.2, 0.5, 'sawtooth', 0.12);
  },
  timeUp: (ac) => {
    [0, 0.25, 0.5].forEach((t) => tone(ac, 880, t, 0.18, 'square', 0.1));
  },
  special: (ac) => {
    [392, 494, 587, 784, 587, 784].forEach((f, i) => tone(ac, f, i * 0.11, 0.2, 'triangle'));
  },
  final: (ac) => {
    [262, 330, 392, 523].forEach((f, i) => tone(ac, f, i * 0.22, 0.5, 'sine', 0.2));
  },
};

export function playSound(name: SoundName, enabled: boolean): void {
  if (!enabled) return;
  const ac = audio();
  if (ac) PATTERNS[name](ac);
}
