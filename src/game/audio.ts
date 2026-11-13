// 使用 WebAudio 合成的音效，无需任何外部资源，离线可用
let ctx: AudioContext | null = null;
let enabled = true;
const last: Record<string, number> = {};

export function setSound(on: boolean) {
  enabled = on;
}

function ac(): AudioContext | null {
  if (!enabled) return null;
  if (!ctx) {
    const C = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

function tone(freq: number, dur: number, type: OscillatorType, vol: number, slide = 0, delay = 0) {
  const a = ac();
  if (!a) return;
  const t = a.currentTime + delay;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur: number, vol: number, delay = 0) {
  const a = ac();
  if (!a) return;
  const n = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, n, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = a.createBufferSource();
  src.buffer = buf;
  const g = a.createGain();
  g.gain.value = vol;
  src.connect(g).connect(a.destination);
  src.start(a.currentTime + delay);
}

export type Sfx =
  | "arrow"
  | "cannon"
  | "frost"
  | "tesla"
  | "sniper"
  | "boom"
  | "build"
  | "upgrade"
  | "sell"
  | "click"
  | "error"
  | "kill"
  | "leak"
  | "skill"
  | "wave"
  | "win"
  | "lose"
  | "meteor";

export function sfx(name: Sfx) {
  if (!enabled) return;
  const now = performance.now();
  const gap: Partial<Record<Sfx, number>> = { arrow: 70, cannon: 90, frost: 90, tesla: 90, kill: 60, boom: 70, sniper: 100 };
  const g = gap[name];
  if (g) {
    if (now - (last[name] ?? 0) < g) return;
    last[name] = now;
  }
  switch (name) {
    case "arrow": tone(900, 0.06, "triangle", 0.04, -500); break;
    case "cannon": tone(140, 0.18, "sawtooth", 0.07, -90); noise(0.1, 0.05); break;
    case "frost": tone(1400, 0.1, "sine", 0.04, -600); break;
    case "tesla": tone(300, 0.12, "square", 0.04, 700); break;
    case "sniper": tone(220, 0.25, "sawtooth", 0.08, -180); noise(0.08, 0.06); break;
    case "boom": noise(0.28, 0.12); tone(90, 0.25, "sine", 0.1, -50); break;
    case "build": tone(330, 0.08, "square", 0.05); tone(495, 0.1, "square", 0.05, 0, 0.07); break;
    case "upgrade": tone(440, 0.08, "triangle", 0.07); tone(660, 0.08, "triangle", 0.07, 0, 0.08); tone(880, 0.14, "triangle", 0.07, 0, 0.16); break;
    case "sell": tone(600, 0.08, "square", 0.05, -250); break;
    case "click": tone(520, 0.04, "square", 0.03); break;
    case "error": tone(160, 0.14, "square", 0.06, -40); break;
    case "kill": tone(700, 0.05, "sine", 0.03, 300); break;
    case "leak": tone(180, 0.3, "sawtooth", 0.1, -120); break;
    case "skill": tone(300, 0.3, "triangle", 0.08, 600); break;
    case "meteor": noise(0.5, 0.18); tone(70, 0.5, "sine", 0.15, -35); break;
    case "wave": tone(262, 0.15, "square", 0.05); tone(392, 0.2, "square", 0.05, 0, 0.14); break;
    case "win": [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.25, "triangle", 0.08, 0, i * 0.14)); break;
    case "lose": [400, 330, 262, 196].forEach((f, i) => tone(f, 0.3, "sawtooth", 0.07, 0, i * 0.18)); break;
  }
}
