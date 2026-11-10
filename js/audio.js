// Procedural audio: engine hum, wind / hall ambience, a slow generative pad, and small effects.
export const audio = {
  ctx: null,
  init() {
    if (this.ctx) return;
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
    const c = this.ctx = new C(), out = this.out = c.createGain(); out.gain.value = 0.7; out.connect(c.destination);
    const nb = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; this.noiseBuf = nb;
    const noise = () => { const s = c.createBufferSource(); s.buffer = nb; s.loop = true; s.start(); return s; };
    // engine
    const eg = this.engGain = c.createGain(); eg.gain.value = 0; eg.connect(out);
    const o1 = this.engOsc = c.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 48; const o2 = this.engOsc2 = c.createOscillator(); o2.type = 'square'; o2.frequency.value = 72.5;
    const lf = this.engLP = c.createBiquadFilter(); lf.type = 'lowpass'; lf.frequency.value = 220; o1.connect(lf); o2.connect(lf); const g2 = c.createGain(); g2.gain.value = 0.5; lf.connect(g2); g2.connect(eg);
    const nf = this.engBP = c.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 500; nf.Q.value = 0.7; noise().connect(nf); const ng = c.createGain(); ng.gain.value = 0.35; nf.connect(ng); ng.connect(eg); o1.start(); o2.start();
    // ambience
    const ag = this.ambGain = c.createGain(); ag.gain.value = 0; ag.connect(out);
    const af = this.ambLP = c.createBiquadFilter(); af.type = 'lowpass'; af.frequency.value = 500; noise().connect(af); af.connect(ag);
    const l = c.createOscillator(); l.frequency.value = 0.13; const lg = c.createGain(); lg.gain.value = 180; l.connect(lg); lg.connect(af.frequency); l.start();
    // pad
    const pg = this.padGain = c.createGain(); pg.gain.value = 0.0; const pf = c.createBiquadFilter(); pf.type = 'lowpass'; pf.frequency.value = 900;
    const dl = c.createDelay(1); dl.delayTime.value = 0.47; const fb = c.createGain(); fb.gain.value = 0.45; pf.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(pg); pf.connect(pg); pg.connect(out);
    this.padIn = pf; this.padGain.gain.linearRampToValueAtTime(0.5, c.currentTime + 6);
    this.chord = 0; this.padTick(); setInterval(() => this.padTick(), 9000);
  },
  padTick() {
    const c = this.ctx; if (!c || c.state !== 'running') return;
    const chords = [[110, 164.8, 220, 277.2], [98, 146.8, 196, 246.9], [130.8, 196, 261.6, 329.6], [87.3, 130.8, 174.6, 220], [123.5, 185, 246.9, 311.1]];
    const ch = chords[this.chord++ % chords.length], t = c.currentTime;
    for (const f of ch) for (const det of [-3, 4]) {
      const o = c.createOscillator(), g = c.createGain(); o.type = 'triangle'; o.frequency.value = f; o.detune.value = det + Math.random() * 3;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.028, t + 3.5); g.gain.linearRampToValueAtTime(0, t + 12); o.connect(g); g.connect(this.padIn); o.start(t); o.stop(t + 12.5);
    }
  },
  // per-frame mix: thr 0..1, amb 0..1 (outdoor wind / hall murmur), bright = ambience filter Hz
  mix(thr, boost, amb, bright) {
    const c = this.ctx; if (!c) return; const t = c.currentTime;
    this.engGain.gain.setTargetAtTime(thr > 0.01 ? 0.05 + thr * 0.17 : 0, t, 0.15);
    this.engOsc.frequency.setTargetAtTime(44 + thr * 46 + boost * 30, t, 0.2); this.engOsc2.frequency.setTargetAtTime(66 + thr * 70 + boost * 45, t, 0.2);
    this.engLP.frequency.setTargetAtTime(180 + thr * 500, t, 0.2); this.engBP.frequency.setTargetAtTime(300 + thr * 900 + boost * 600, t, 0.2);
    this.ambGain.gain.setTargetAtTime(amb * 0.16, t, 0.4); this.ambLP.frequency.setTargetAtTime(bright, t, 0.5);
  },
  tone(f, dur, type = 'sine', vol = 0.12, f2 = null, delay = 0) {
    const c = this.ctx; if (!c) return; const t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0005, t + dur); o.connect(g); g.connect(this.out); o.start(t); o.stop(t + dur + 0.05);
  },
  burst(dur, f0, f1, vol = 0.3, q = 0.8) {
    const c = this.ctx; if (!c) return; const t = c.currentTime, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = this.noiseBuf; f.type = 'bandpass'; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); s.connect(f); f.connect(g); g.connect(this.out); s.start(t); s.stop(t + dur);
  },
  charge(on) {
    const c = this.ctx; if (!c) return;
    if (on && !this.chg) { const o = c.createOscillator(), g = c.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(90, c.currentTime); o.frequency.exponentialRampToValueAtTime(900, c.currentTime + 3.2); g.gain.value = 0.05; o.connect(g); g.connect(this.out); o.start(); this.chg = { o, g }; }
    else if (!on && this.chg) { this.chg.g.gain.setTargetAtTime(0, c.currentTime, 0.05); this.chg.o.stop(c.currentTime + 0.3); this.chg = null; }
  },
  sfx(n) {
    if (!this.ctx) return;
    if (n === 'click') this.tone(880, 0.06, 'square', 0.04);
    else if (n === 'ok') { this.tone(660, 0.12, 'triangle', 0.1); this.tone(990, 0.18, 'triangle', 0.1, null, 0.1); }
    else if (n === 'coin') { this.tone(1320, 0.1, 'triangle', 0.1); this.tone(1760, 0.25, 'triangle', 0.1, null, 0.08); }
    else if (n === 'talk') this.tone(330, 0.12, 'sine', 0.08, 392);
    else if (n === 'found') { this.tone(523, 0.3, 'sine', 0.1); this.tone(659, 0.3, 'sine', 0.1, null, 0.15); this.tone(784, 0.6, 'sine', 0.1, null, 0.3); }
    else if (n === 'step') this.burst(0.07, 500 + Math.random() * 300, 180, 0.07, 1.2);
    else if (n === 'bump') { this.burst(0.35, 300, 60, 0.4); this.tone(70, 0.3, 'sine', 0.3, 35); }
    else if (n === 'land') { this.burst(0.5, 500, 80, 0.25); this.tone(90, 0.4, 'sine', 0.25, 45); }
    else if (n === 'ramp') this.tone(140, 1.6, 'sawtooth', 0.03, 110);
    else if (n === 'jump') { this.tone(60, 2.4, 'sine', 0.5, 22); this.burst(2.2, 4000, 90, 0.5, 0.4); }
    else if (n === 'arrive') { this.burst(1.4, 120, 2500, 0.3, 0.5); this.tone(40, 1.2, 'sine', 0.4, 80); }
    else if (n === 'whoosh') this.burst(1.2, 200, 1800, 0.25, 0.5);
    else if (n === 'lift') this.tone(220, 1.2, 'sine', 0.08, 440);
    else if (n === 'deny') this.tone(160, 0.2, 'square', 0.06, 110);
  },
};
