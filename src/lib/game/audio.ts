let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let sfxBus: GainNode | null = null;
let musicBus: GainNode | null = null;
let unlockBound = false;
let noiseBuf: AudioBuffer | null = null;
const fanfareOsc: OscillatorNode[] = [];

function ctor(): typeof AudioContext | null {
  if (typeof window === "undefined") return null;
  return (
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext ||
    null
  );
}

function getCtx(): AudioContext | null {
  if (ctx) return ctx;
  const C = ctor();
  if (!C) return null;
  ctx = new C({ latencyHint: "interactive" });
  master = ctx.createGain();
  sfxBus = ctx.createGain();
  musicBus = ctx.createGain();
  master.gain.value = 0.9;
  sfxBus.gain.value = 1;
  musicBus.gain.value = 0.85;
  sfxBus.connect(master);
  musicBus.connect(master);
  master.connect(ctx.destination);
  return ctx;
}

function resume(c: AudioContext): void {
  if (c.state === "suspended") void c.resume();
}

export function unlockAudio(): void {
  const c = getCtx();
  if (c) resume(c);
  bindUnlock();
}

function bindUnlock(): void {
  if (unlockBound || typeof window === "undefined") return;
  unlockBound = true;
  const go = () => {
    const c = getCtx();
    if (c) resume(c);
  };
  window.addEventListener("pointerdown", go, { capture: true });
  window.addEventListener("keydown", go, { capture: true });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") go();
  });
}

function graph() {
  const c = getCtx();
  if (!c || !sfxBus || !musicBus) return null;
  resume(c);
  return { c, sfx: sfxBus, music: musicBus };
}

function noise(c: AudioContext): AudioBuffer {
  if (noiseBuf) return noiseBuf;
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * 0.25), c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  noiseBuf = buf;
  return buf;
}

function env(
  c: AudioContext,
  peak: number,
  attack: number,
  hold: number,
  decay: number,
  t0: number,
): GainNode {
  const g = c.createGain();
  const a = Math.max(0.003, attack);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + a);
  g.gain.setValueAtTime(Math.max(0.0002, peak), t0 + a + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + hold + decay);
  return g;
}

function tone(opts: {
  c: AudioContext;
  dest: AudioNode;
  freq: number;
  type?: OscillatorType;
  peak: number;
  attack?: number;
  hold?: number;
  decay: number;
  t0: number;
  pan?: number;
  filter?: number;
  track?: OscillatorNode[];
}): OscillatorNode {
  const osc = opts.c.createOscillator();
  osc.type = opts.type ?? "sine";
  osc.frequency.setValueAtTime(opts.freq, opts.t0);
  const g = env(
    opts.c,
    opts.peak,
    opts.attack ?? 0.006,
    opts.hold ?? 0.02,
    opts.decay,
    opts.t0,
  );
  let node: AudioNode = osc;
  if (opts.filter) {
    const f = opts.c.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.setValueAtTime(opts.filter, opts.t0);
    f.Q.value = 0.8;
    osc.connect(f);
    node = f;
  }
  if (opts.pan != null && opts.c.createStereoPanner) {
    const p = opts.c.createStereoPanner();
    p.pan.setValueAtTime(opts.pan, opts.t0);
    node.connect(p);
    p.connect(g);
  } else {
    node.connect(g);
  }
  g.connect(opts.dest);
  osc.start(opts.t0);
  osc.stop(opts.t0 + (opts.attack ?? 0.006) + (opts.hold ?? 0.02) + opts.decay + 0.05);
  if (opts.track) opts.track.push(osc);
  osc.onended = () => {
    try {
      osc.disconnect();
      g.disconnect();
    } catch {
      /* already gone */
    }
    if (opts.track) {
      const i = opts.track.indexOf(osc);
      if (i >= 0) opts.track.splice(i, 1);
    }
  };
  return osc;
}

function burst(
  c: AudioContext,
  dest: AudioNode,
  t0: number,
  peak: number,
  hp: number,
  decay: number,
): void {
  const src = c.createBufferSource();
  src.buffer = noise(c);
  const f = c.createBiquadFilter();
  f.type = "highpass";
  f.frequency.value = hp;
  const g = env(c, peak, 0.004, 0.01, decay, t0);
  src.connect(f);
  f.connect(g);
  g.connect(dest);
  src.start(t0);
  src.stop(t0 + decay + 0.05);
}

/** Bright desk-bell ding — layered partials, not a single beep. */
export function playCorrect(sound: boolean): void {
  if (!sound) return;
  const g = graph();
  if (!g) return;
  const { c, sfx } = g;
  const t0 = c.currentTime;
  const j = 1 + (Math.random() * 0.03 - 0.015);

  burst(c, sfx, t0, 0.045, 1800, 0.04);
  tone({
    c,
    dest: sfx,
    freq: 1318.5 * j,
    type: "sine",
    peak: 0.11,
    attack: 0.004,
    hold: 0.018,
    decay: 0.22,
    t0,
  });
  tone({
    c,
    dest: sfx,
    freq: 1975.5 * j,
    type: "triangle",
    peak: 0.055,
    attack: 0.005,
    hold: 0.01,
    decay: 0.28,
    t0,
    pan: 0.18,
  });
  tone({
    c,
    dest: sfx,
    freq: 2637 * j,
    type: "sine",
    peak: 0.04,
    attack: 0.003,
    hold: 0,
    decay: 0.2,
    t0,
    pan: -0.12,
  });
  tone({
    c,
    dest: sfx,
    freq: 3136 * j,
    type: "sine",
    peak: 0.018,
    attack: 0.002,
    hold: 0,
    decay: 0.12,
    t0,
  });
}

export function playWrong(sound: boolean): void {
  if (!sound) return;
  const g = graph();
  if (!g) return;
  const { c, sfx } = g;
  const t0 = c.currentTime;
  tone({
    c,
    dest: sfx,
    freq: 196,
    type: "triangle",
    peak: 0.05,
    attack: 0.004,
    hold: 0.02,
    decay: 0.14,
    t0,
  });
  tone({
    c,
    dest: sfx,
    freq: 147,
    type: "sine",
    peak: 0.03,
    attack: 0.006,
    hold: 0.02,
    decay: 0.16,
    t0,
  });
}

export function playStart(sound: boolean): void {
  stopFanfare();
  if (!sound) return;
  const g = graph();
  if (!g) return;
  const { c, sfx } = g;
  const t0 = c.currentTime;
  tone({
    c,
    dest: sfx,
    freq: 523.25,
    type: "sine",
    peak: 0.04,
    attack: 0.01,
    hold: 0.02,
    decay: 0.1,
    t0,
  });
  tone({
    c,
    dest: sfx,
    freq: 659.25,
    type: "sine",
    peak: 0.035,
    attack: 0.01,
    hold: 0.03,
    decay: 0.14,
    t0: t0 + 0.07,
  });
}

function stopFanfare(): void {
  if (!ctx) return;
  const now = ctx.currentTime;
  for (const osc of fanfareOsc.splice(0)) {
    try {
      osc.stop(now);
    } catch {
      /* already stopped */
    }
  }
}

/** Short grand sting when a round ends. Full cadence if the clock completed. */
export function playFinish(sound: boolean, completed: boolean): void {
  if (!sound) return;
  const g = graph();
  if (!g) return;
  stopFanfare();
  const { c, music } = g;
  const t0 = c.currentTime + 0.08;
  const track = fanfareOsc;

  if (!completed) {
    tone({
      c,
      dest: music,
      freq: 196,
      type: "sine",
      peak: 0.08,
      attack: 0.02,
      hold: 0.05,
      decay: 0.45,
      t0,
      track,
    });
    tone({
      c,
      dest: music,
      freq: 392,
      type: "triangle",
      peak: 0.05,
      attack: 0.02,
      hold: 0.04,
      decay: 0.4,
      t0: t0 + 0.08,
      track,
    });
    tone({
      c,
      dest: music,
      freq: 523.25,
      type: "sine",
      peak: 0.06,
      attack: 0.02,
      hold: 0.08,
      decay: 0.7,
      t0: t0 + 0.22,
      track,
    });
    return;
  }

  burst(c, music, t0, 0.07, 240, 0.22);

  tone({
    c,
    dest: music,
    freq: 65.41,
    type: "sine",
    peak: 0.16,
    attack: 0.03,
    hold: 0.12,
    decay: 1.6,
    t0,
    track,
  });
  tone({
    c,
    dest: music,
    freq: 130.81,
    type: "triangle",
    peak: 0.07,
    attack: 0.04,
    hold: 0.1,
    decay: 1.1,
    t0,
    track,
  });

  const brass = [
    { at: 0.12, freq: 261.63, pan: -0.2 },
    { at: 0.28, freq: 329.63, pan: 0.05 },
    { at: 0.44, freq: 392.0, pan: 0.22 },
    { at: 0.6, freq: 523.25, pan: 0 },
  ];
  for (const n of brass) {
    tone({
      c,
      dest: music,
      freq: n.freq,
      type: "sawtooth",
      peak: 0.045,
      attack: 0.018,
      hold: 0.06,
      decay: 0.32,
      t0: t0 + n.at,
      pan: n.pan,
      filter: 1400,
      track,
    });
    tone({
      c,
      dest: music,
      freq: n.freq * 2,
      type: "sine",
      peak: 0.025,
      attack: 0.02,
      hold: 0.04,
      decay: 0.38,
      t0: t0 + n.at,
      pan: n.pan,
      track,
    });
  }

  const chord = [
    { freq: 261.63, peak: 0.07, pan: -0.25 },
    { freq: 329.63, peak: 0.06, pan: -0.08 },
    { freq: 392.0, peak: 0.07, pan: 0.08 },
    { freq: 523.25, peak: 0.08, pan: 0.22 },
    { freq: 659.25, peak: 0.045, pan: 0.12 },
    { freq: 783.99, peak: 0.03, pan: -0.1 },
  ];
  for (const n of chord) {
    tone({
      c,
      dest: music,
      freq: n.freq,
      type: "sine",
      peak: n.peak,
      attack: 0.04,
      hold: 0.18,
      decay: 1.85,
      t0: t0 + 0.72,
      pan: n.pan,
      track,
    });
  }

  tone({
    c,
    dest: music,
    freq: 1046.5,
    type: "sine",
    peak: 0.05,
    attack: 0.01,
    hold: 0.05,
    decay: 1.1,
    t0: t0 + 0.95,
    pan: 0.15,
    track,
  });
  tone({
    c,
    dest: music,
    freq: 1567.98,
    type: "sine",
    peak: 0.028,
    attack: 0.012,
    hold: 0.04,
    decay: 0.9,
    t0: t0 + 1.12,
    pan: -0.18,
    track,
  });
  tone({
    c,
    dest: music,
    freq: 2093,
    type: "sine",
    peak: 0.016,
    attack: 0.01,
    hold: 0.02,
    decay: 0.7,
    t0: t0 + 1.28,
    track,
  });

  tone({
    c,
    dest: music,
    freq: 98,
    type: "sine",
    peak: 0.1,
    attack: 0.08,
    hold: 0.2,
    decay: 1.8,
    t0: t0 + 1.55,
    track,
  });
  const close = [
    { at: 1.62, freq: 392.0, pan: -0.2 },
    { at: 1.78, freq: 523.25, pan: 0 },
    { at: 1.94, freq: 659.25, pan: 0.16 },
    { at: 2.12, freq: 783.99, pan: 0.08 },
  ];
  for (const n of close) {
    tone({
      c,
      dest: music,
      freq: n.freq,
      type: "triangle",
      peak: 0.045,
      attack: 0.02,
      hold: 0.08,
      decay: 0.9,
      t0: t0 + n.at,
      pan: n.pan,
      track,
    });
  }
  const finalChord = [
    { freq: 261.63, peak: 0.055, pan: -0.22 },
    { freq: 329.63, peak: 0.05, pan: -0.06 },
    { freq: 392.0, peak: 0.06, pan: 0.06 },
    { freq: 523.25, peak: 0.07, pan: 0.2 },
    { freq: 1046.5, peak: 0.03, pan: 0.1 },
  ];
  for (const n of finalChord) {
    tone({
      c,
      dest: music,
      freq: n.freq,
      type: "sine",
      peak: n.peak,
      attack: 0.06,
      hold: 0.25,
      decay: 2.1,
      t0: t0 + 2.28,
      pan: n.pan,
      track,
    });
  }
}

if (typeof window !== "undefined") bindUnlock();
