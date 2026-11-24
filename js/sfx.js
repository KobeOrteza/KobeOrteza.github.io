/* sfx.js — synthesized sound design (Web Audio, no audio files).
   Off by default; the visitor turns it on from the nav (browsers require a click first).
   API:  KOBE.sfx(name, opts)   KOBE.setSound(on)   KOBE.soundOn()   KOBE.blip(freq, dur, vol, type) */
(() => {
  "use strict";
  const KOBE = (window.KOBE = window.KOBE || {});
  const AC = window.AudioContext || window.webkitAudioContext;

  let ctx = null, master = null, wet = null, dry = null, drone = null;
  let on = false;
  try { on = localStorage.getItem("kobe-sound") === "1"; } catch (_) { /* storage blocked */ }
  const last = {}; // rate limiting per sound

  const init = () => {
    if (ctx || !AC) return !!ctx;
    try {
      ctx = new AC();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18; comp.ratio.value = 4;
      master = ctx.createGain();
      master.gain.value = 0.55;
      master.connect(comp).connect(ctx.destination);
      dry = ctx.createGain(); dry.connect(master);
      // small generated reverb (decaying stereo noise impulse)
      const len = ctx.sampleRate * 1.8;
      const ir = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let c = 0; c < 2; c++) {
        const d = ir.getChannelData(c);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
      }
      const verb = ctx.createConvolver();
      verb.buffer = ir;
      wet = ctx.createGain(); wet.gain.value = 0.28;
      wet.connect(verb).connect(master);
      return true;
    } catch (_) { ctx = null; return false; }
  };

  const out = (node, reverb = 0.3) => {
    node.connect(dry);
    if (reverb > 0) {
      const s = ctx.createGain();
      s.gain.value = reverb;
      node.connect(s).connect(wet);
    }
  };

  // one enveloped oscillator
  const tone = (freq, { dur = 0.08, vol = 0.05, type = "sine", attack = 0.004, slide = 0, delay = 0, reverb = 0.25, detune = 0 } = {}) => {
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.detune.value = detune;
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    out(g, reverb);
    o.start(t);
    o.stop(t + dur + 0.05);
  };

  // filtered noise burst
  const noise = ({ dur = 0.05, vol = 0.03, freq = 3000, q = 1, type = "highpass", sweep = 0, delay = 0, reverb = 0.1 } = {}) => {
    const t = ctx.currentTime + delay;
    const n = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq * sweep), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g);
    out(g, reverb);
    src.start(t);
  };

  // pentatonic scale for musical agent blips
  const PENTA = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.5];

  const SOUNDS = {
    hover: () => tone(2200 + Math.random() * 500, { dur: 0.03, vol: 0.012, type: "sine", reverb: 0.05 }),
    click: () => { tone(880, { dur: 0.06, vol: 0.04, type: "triangle" }); tone(1320, { dur: 0.08, vol: 0.03, type: "triangle", delay: 0.035 }); },
    type: () => noise({ dur: 0.018, vol: 0.022, freq: 4200 + Math.random() * 1500, reverb: 0.02 }),
    claim: (o = {}) => tone(PENTA[(o.agent || 0) * 2 % PENTA.length] * 2, { dur: 0.05, vol: 0.014, type: "sine", reverb: 0.15 }),
    build: (o = {}) => tone(PENTA[((o.agent || 0) + (o.step || 0)) % PENTA.length], { dur: 0.16, vol: 0.03, type: "sine", reverb: 0.35, attack: 0.006 }),
    glitch: () => { noise({ dur: 0.09, vol: 0.03, freq: 1800, type: "bandpass", q: 6, sweep: 0.3 }); tone(160, { dur: 0.08, vol: 0.02, type: "square", slide: 0.5, reverb: 0 }); },
    deploy: () => [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, { dur: 0.7, vol: 0.03, type: "sine", delay: i * 0.07, reverb: 0.6 })),
    complete: () => [392, 523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => tone(f, { dur: 1.1, vol: 0.032, type: i % 2 ? "triangle" : "sine", delay: i * 0.08, reverb: 0.7 })),
    scatter: () => { noise({ dur: 0.45, vol: 0.08, freq: 2400, type: "bandpass", q: 1.4, sweep: 0.12, reverb: 0.4 }); tone(90, { dur: 0.35, vol: 0.08, type: "sine", slide: 0.5, reverb: 0.2 }); },
    grab: () => tone(330, { dur: 0.09, vol: 0.035, type: "triangle", slide: 1.5 }),
    open: () => { tone(440, { dur: 0.22, vol: 0.035, type: "sine", slide: 2, reverb: 0.4 }); tone(660, { dur: 0.25, vol: 0.02, type: "triangle", slide: 2, delay: 0.04, reverb: 0.4 }); },
    close: () => tone(880, { dur: 0.18, vol: 0.03, type: "sine", slide: 0.5, reverb: 0.3 }),
    send: () => tone(700, { dur: 0.1, vol: 0.035, type: "triangle", slide: 1.8 }),
    receive: () => { tone(988, { dur: 0.14, vol: 0.03, type: "sine", reverb: 0.4 }); tone(1318.5, { dur: 0.2, vol: 0.025, type: "sine", delay: 0.07, reverb: 0.4 }); },
    boot: (o = {}) => tone(300 + (o.step || 0) * 110, { dur: 0.06, vol: 0.025, type: "square", reverb: 0.15 }),
    booted: () => { tone(196, { dur: 1.2, vol: 0.05, type: "sine", slide: 2, reverb: 0.7 }); noise({ dur: 0.6, vol: 0.03, freq: 6000, sweep: 0.3, reverb: 0.6 }); },
    on: () => [659.25, 987.77].forEach((f, i) => tone(f, { dur: 0.3, vol: 0.04, type: "sine", delay: i * 0.08, reverb: 0.5 }))
  };
  const LIMIT = { hover: 60, type: 35, claim: 90, build: 110, glitch: 200, deploy: 600 };

  /* Ambient pad: two detuned saws through a slowly breathing low-pass. Very quiet. */
  const startDrone = () => {
    if (drone || !ctx) return;
    const g = ctx.createGain();
    g.gain.value = 0.0001;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.value = 380; lp.Q.value = 3;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
    const lfoG = ctx.createGain(); lfoG.gain.value = 180;
    lfo.connect(lfoG).connect(lp.frequency);
    const oscs = [55, 55.4, 82.4].map((f, i) => {
      const o = ctx.createOscillator();
      o.type = i === 2 ? "triangle" : "sawtooth";
      o.frequency.value = f;
      o.connect(lp);
      o.start();
      return o;
    });
    lp.connect(g);
    out(g, 0.5);
    lfo.start();
    g.gain.exponentialRampToValueAtTime(0.022, ctx.currentTime + 2.5);
    drone = { g, oscs, lfo };
  };
  const stopDrone = () => {
    if (!drone) return;
    const d = drone;
    drone = null;
    d.g.gain.cancelScheduledValues(ctx.currentTime);
    d.g.gain.setValueAtTime(Math.max(0.0001, d.g.gain.value), ctx.currentTime);
    d.g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.8);
    setTimeout(() => { d.oscs.forEach((o) => o.stop()); d.lfo.stop(); }, 900);
  };

  KOBE.soundOn = () => on;
  KOBE.sfx = (name, opts) => {
    if (!on || !SOUNDS[name]) return;
    if (!init()) return;
    if (ctx.state === "suspended") ctx.resume();
    const now = performance.now();
    if (LIMIT[name] && now - (last[name] || 0) < LIMIT[name]) return;
    last[name] = now;
    try { SOUNDS[name](opts); } catch (_) { /* never let audio break the page */ }
  };
  KOBE.blip = (freq = 880, dur = 0.05, vol = 0.03, type = "sine") => {
    if (!on || !init()) return;
    tone(freq, { dur, vol: Math.min(vol, 0.05), type });
  };
  KOBE.setSound = (value) => {
    on = !!value;
    try { localStorage.setItem("kobe-sound", on ? "1" : "0"); } catch (_) {}
    document.documentElement.classList.toggle("sound-on", on);
    if (on) {
      if (!init()) return;
      if (ctx.state === "suspended") ctx.resume();
      SOUNDS.on();
      startDrone();
    } else if (ctx) {
      stopDrone();
    }
    window.dispatchEvent(new CustomEvent("kobe:sound", { detail: on }));
  };

  // A saved "on" preference can only start audio after the first user gesture.
  if (on) {
    document.documentElement.classList.add("sound-on");
    const resume = () => {
      if (!on) return;
      if (init()) { if (ctx.state === "suspended") ctx.resume(); startDrone(); }
    };
    window.addEventListener("pointerdown", resume, { once: true });
    window.addEventListener("keydown", resume, { once: true });
  }
  document.addEventListener("visibilitychange", () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend(); else if (on) ctx.resume();
  });
})();
