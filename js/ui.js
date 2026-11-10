import { G, rng, hashStr, clamp } from './util.js';
import { SYSTEMS, SYS, GOODS, UPGRADES, price, dist, YEAR } from './data.js';

const $ = (id) => document.getElementById(id);
const fmt = (n) => Math.round(n).toLocaleString('en-US');

// ---------- economy helpers ----------
export const cap = () => UPGRADES[2].vals[G.save.up.hold];
export const jumpRange = () => UPGRADES[0].vals[G.save.up.drive];
export const cargoCount = () => Object.values(G.save.cargo).reduce((a, b) => a + b, 0) + G.save.jobs.reduce((a, j) => a + (j.qty || 0), 0);
export function offers(sys) {
  const seed = hashStr(sys.id) + (G.save.board[sys.id] || 0) * 977, r = rng(seed), out = [];
  const near = SYSTEMS.filter((s) => s.id !== sys.id).map((s) => ({ s, d: dist(s, sys) })).sort((a, b) => a.d - b.d);
  for (let i = 0; i < 3; i++) {
    const p = near[Math.min(near.length - 1, (r() * r() * 16) | 0)], good = GOODS[(r() * GOODS.length) | 0], qty = 1 + ((r() * 4) | 0);
    if (out.some((q) => q.to === p.s.id && q.good === good.name)) continue;
    out.push({ id: `${sys.id}:${seed}:${i}`, type: 'delivery', from: sys.id, to: p.s.id, good: good.name, qty, reward: Math.round((180 + p.d * 0.22 + qty * 25) / 10) * 10 });
  }
  const inv = near.filter((n) => !n.s.lore && !G.save.surveyed[n.s.id] && !G.save.jobs.some((j) => j.type === 'survey' && j.to === n.s.id));
  if (inv.length) { const p = inv[Math.min(inv.length - 1, (r() * 4) | 0)]; out.push({ id: `${sys.id}:${seed}:s`, type: 'survey', from: sys.id, to: p.s.id, qty: 0, reward: Math.round((260 + p.d * 0.2) / 10) * 10 }); }
  return out.filter((o) => !G.save.jobs.some((j) => j.id === o.id) && !(o.type === 'delivery' && G.save.jobs.some((j) => j.to === o.to && j.good === o.good)));
}
export const jobTitle = (j) => j.type === 'survey' ? `Survey the ${SYS[j.to].name} system` : `Deliver ${j.qty} crate${j.qty > 1 ? 's' : ''} of ${j.good} to ${SYS[j.to].name}`;
function completeDeliveries(sys) {
  const done = G.save.jobs.filter((j) => j.type === 'delivery' && j.to === sys.id);
  G.save.jobs = G.save.jobs.filter((j) => !done.includes(j));
  let sum = 0; for (const j of done) sum += j.reward;
  if (sum) { G.save.credits += sum; G.changed(); G.audio.sfx('coin'); }
  return done;
}

// ---------- HUD ----------
export const ui = {
  modal: null, mapOpen: false, mk: [],
  init() {
    this.el = { loc: $('loc'), status: $('status'), prompt: $('prompt'), hint: $('hint'), toasts: $('toasts'), flight: $('flight'), spd: $('spd'), alt: $('alt'), altl: $('altl'), mode: $('mode'), thr: $('thr').firstElementChild, ret: $('ret'), stick: $('stick'), markers: $('markers'), jump: $('jump'), modal: $('modal'), map: $('map'), fade: $('fade') };
    this.el.modal.addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (b && this.modal && !b.disabled) this.modal.pick(+b.dataset.i); });
    this.initMap();
  },
  toast(html, good, ms = 4200) {
    const d = document.createElement('div'); d.className = 'toast' + (good ? ' good' : ''); d.innerHTML = html; this.el.toasts.appendChild(d);
    while (this.el.toasts.children.length > 4) this.el.toasts.firstChild.remove();
    setTimeout(() => d.remove(), ms);
  },
  prompt(t) { if (t === this._p) return; this._p = t; this.el.prompt.style.display = t ? 'block' : 'none'; if (t) this.el.prompt.innerHTML = `<kbd>F</kbd>${t}`; },
  hint(t) { if (t === this._h) return; this._h = t; this.el.hint.innerHTML = t || ''; },
  loc(a, b) { const k = a + b; if (k === this._l) return; this._l = k; this.el.loc.innerHTML = `<b>${a}</b>${b}<br><i>${YEAR}</i>`; },
  status() {
    const s = G.save, k = s.credits + ':' + cargoCount() + ':' + cap() + ':' + s.jobs.length; if (k === this._s) return; this._s = k;
    this.el.status.innerHTML = `<b>${fmt(s.credits)}</b> credits<span>Hold ${cargoCount()} / ${cap()} · ${s.jobs.length} job${s.jobs.length === 1 ? '' : 's'}</span><span>H help · Tab journal · M chart</span>`;
  },
  flight(f) {
    this.el.flight.style.display = f ? 'flex' : 'none'; this.el.ret.className = f ? 'fly' : ''; this.el.stick.style.display = f && f.stick ? 'block' : 'none';
    if (!f) return;
    this.el.spd.textContent = fmt(f.spd); this.el.alt.textContent = f.alt; this.el.altl.textContent = f.altl; this.el.mode.textContent = f.mode;
    const t = f.thr; this.el.thr.style.left = (t < 0 ? 20 + t * 80 : 20) + '%'; this.el.thr.style.width = Math.abs(t) * 80 + '%';
    if (f.stick) { this.el.stick.style.left = (innerWidth / 2 + f.stick[0] * 120) + 'px'; this.el.stick.style.top = (innerHeight / 2 + f.stick[1] * 120) + 'px'; }
  },
  markers(list) {
    while (this.mk.length < list.length) { const d = document.createElement('div'); d.className = 'mk'; this.el.markers.appendChild(d); this.mk.push(d); }
    this.mk.forEach((d, i) => {
      const m = list[i]; if (!m) { d.style.display = 'none'; return; }
      d.style.display = 'block'; d.style.left = m.x + 'px'; d.style.top = m.y + 'px'; d.style.color = m.color || '#f0c070'; d.className = 'mk' + (m.off ? ' off' : '');
      const h = m.label + (m.sub ? `<small>${m.sub}</small>` : ''); if (d._h !== h) { d._h = h; d.innerHTML = h; }
    });
  },
  jump(text, frac) { const j = this.el.jump; j.style.display = text ? 'block' : 'none'; if (text) { if (j._t !== text) { j._t = text; j.firstElementChild.innerHTML = text; } j.querySelector('i').style.width = (frac * 100) + '%'; } },
  fade(color, op) { this.el.fade.style.background = color; this.el.fade.style.opacity = op; },

  // ---------- modal menus ----------
  open(html, opts = [], o = {}) {
    document.exitPointerLock?.();
    const list = opts.map((p, i) => `<button class="opt" data-i="${i}" ${p.dis ? 'disabled' : ''}><b>${i + 1}</b>${p.t}</button>`).join('');
    this.el.modal.innerHTML = `<div class="panel">${html}${list}<div class="foot">${o.foot || 'Press a number or click · Esc to close'}</div></div>`;
    this.el.modal.style.display = 'flex';
    this.modal = { pick: (i) => { const p = opts[i] || (o.extra && o.extra[i]); if (p && !p.dis) { G.audio.sfx('click'); p.fn(); } }, opts, onClose: o.onClose };
  },
  close() { if (!this.modal) return; this.modal = null; this.el.modal.style.display = 'none'; G.relock(); },
  key(code) {
    if (code === 'Escape' || code === 'KeyF' && this.modal.opts.length === 0) return this.close();
    const m = /^(Digit|Numpad)(\d)$/.exec(code); if (m) this.modal.pick(+m[2] - 1);
  },
  dialog(def, id, node = 'start') {
    const n = def.n[node];
    const opts = n.opts.map((p) => ({ t: p.t, fn: () => {
      if (p.end) return this.close();
      if (p.go) return this.dialog(def, id, p.go);
      if (p.act === 'trade') return this.market();
      if (p.act === 'jobs') return this.jobs(def.name);
      if (p.act === 'upgrades') return this.upgrades(def.name);
    } }));
    this.open(`<h2>${def.name}</h2><div class="sub">${def.role}</div><p>“${n.text}”</p>`, opts);
    if (node === 'start') G.audio.sfx('talk');
  },
  market() {
    const sys = G.sys, s = G.save;
    const rows = GOODS.map((g, i) => { const p = price(sys, g.id), sell = Math.round(p * 0.9), have = s.cargo[g.id] || 0;
      return `<tr><td>${g.name}</td><td class="n">${p}</td><td class="n">${sell}</td><td class="n">${have || '·'}</td><td class="n"><button class="btn" data-i="${100 + i}" ${s.credits < p || cargoCount() >= cap() ? 'disabled' : ''}>Buy</button> <button class="btn" data-i="${200 + i}" ${have ? '' : 'disabled'}>Sell</button></td></tr>`; }).join('');
    const extra = {};
    GOODS.forEach((g, i) => {
      const p = price(sys, g.id);
      extra[100 + i] = { fn: () => { if (s.credits >= p && cargoCount() < cap()) { s.credits -= p; s.cargo[g.id] = (s.cargo[g.id] || 0) + 1; G.changed(); this.market(); } } };
      extra[200 + i] = { fn: () => { if (s.cargo[g.id]) { s.credits += Math.round(p * 0.9); s.cargo[g.id]--; G.changed(); this.market(); } } };
    });
    this.open(`<h2>Market — ${sys.name}</h2><div class="sub">${fmt(s.credits)} credits · hold ${cargoCount()} / ${cap()} crates</div>
      <table><tr><th>Commodity</th><th style="text-align:right">Buy</th><th style="text-align:right">Sell</th><th style="text-align:right">In hold</th><th></th></tr>${rows}</table>`, [], { extra, foot: 'Prices per crate · Esc to close' });
  },
  jobs(who) {
    const sys = G.sys, s = G.save, done = completeDeliveries(sys);
    let html = `<h2>Work — ${sys.name}</h2><div class="sub">${who || 'Job board'}</div>`;
    if (done.length) html += `<h3>Delivered</h3>` + done.map((j) => `<div class="row"><span>${jobTitle(j)}</span><b style="color:var(--teal)">+${fmt(j.reward)} cr</b></div>`).join('');
    const offs = offers(sys), extra = {};
    html += `<h3>On offer</h3>` + (offs.length ? offs.map((j, i) => {
      const full = j.qty && cargoCount() + j.qty > cap(), d = dist(sys, SYS[j.to]);
      extra[100 + i] = { fn: () => { if (full || s.jobs.length >= 6) return; s.jobs.push(j); s.board[sys.id] = (s.board[sys.id] || 0) + 1; G.changed(); G.audio.sfx('ok'); this.jobs(who); } };
      return `<div class="row"><span>${jobTitle(j)}<small>${fmt(d)} parsecs · ${SYS[j.to].faction}${j.type === 'survey' ? ' · fly within scanner range of the planet' : ' · report to the port office there'}</small></span><span style="white-space:nowrap"><b style="color:var(--amber)">${fmt(j.reward)} cr</b> &nbsp;<button class="btn" data-i="${100 + i}" ${full || s.jobs.length >= 6 ? 'disabled' : ''}>${full ? 'Hold full' : 'Accept'}</button></span></div>`;
    }).join('') : '<p>Nothing on the board today.</p>');
    if (s.jobs.length) html += `<h3>Your contracts</h3>` + s.jobs.map((j) => `<div class="row"><span>${jobTitle(j)}</span><span>${fmt(j.reward)} cr</span></div>`).join('');
    this.open(html, [], { extra, foot: 'Esc to close' });
  },
  upgrades(who) {
    const s = G.save, extra = {};
    const rows = UPGRADES.map((u, i) => {
      const lv = s.up[u.id], next = lv + 1, has = next < u.tiers.length, c = has ? u.cost[next] : 0;
      extra[100 + i] = { fn: () => { if (has && s.credits >= c) { s.credits -= c; s.up[u.id] = next; G.changed(); G.audio.sfx('ok'); this.upgrades(who); } } };
      return `<div class="row"><span>${u.name}<small>Fitted: ${u.tiers[lv]}${has ? ' → ' + u.tiers[next] : ' (best available)'}</small></span><span style="white-space:nowrap">${has ? `<b style="color:var(--amber)">${fmt(c)} cr</b> &nbsp;<button class="btn" data-i="${100 + i}" ${s.credits < c ? 'disabled' : ''}>Fit</button>` : '—'}</span></div>`;
    }).join('');
    this.open(`<h2>Shipwright</h2><div class="sub">${who || ''} · ${fmt(s.credits)} credits</div>${rows}`, [], { extra, foot: 'Esc to close' });
  },
  station(name) {
    this.open(`<h2>${name}</h2><div class="sub">Docked · ${G.sys.name} orbit</div><p>The docking clamps take hold with a clang that carries through the hull. A tired voice on the speaker reads you the berth charges and wishes you a pleasant stay, in that order.</p>`,
      [{ t: 'Commodity exchange', fn: () => this.market() }, { t: 'Contract board', fn: () => this.jobs(name) }, { t: 'Undock', fn: () => this.close() }]);
  },
  journal() {
    const s = G.save;
    const cargo = GOODS.filter((g) => s.cargo[g.id]).map((g) => `${g.name} × ${s.cargo[g.id]}`).join(' · ') || 'empty';
    const vis = Object.keys(s.visited).length, found = Object.keys(s.found).filter((k) => !k.endsWith(':boarded')).length;
    this.open(`<h2>Ship's Journal</h2><div class="sub">${YEAR}</div>
      <h3>Purse & hold</h3><p>${fmt(s.credits)} credits. Hold ${cargoCount()} / ${cap()}: ${cargo}.</p>
      <h3>Contracts</h3>${s.jobs.length ? s.jobs.map((j) => `<div class="row"><span>${jobTitle(j)}<small>${j.type === 'survey' ? 'Jump there and fly close to the planet' : 'Land and report to the port office or factor'}</small></span><span>${fmt(j.reward)} cr</span></div>`).join('') : '<p>None. Dockmasters, factors and bureaux post work.</p>'}
      <h3>The ship</h3>${UPGRADES.map((u) => `<div class="row"><span>${u.name}</span><span>${u.tiers[s.up[u.id]]}</span></div>`).join('')}
      <h3>Travels</h3><p>${vis} of ${SYSTEMS.length} charted systems visited · ${found} places discovered on foot.</p>`, [], { foot: 'Tab or Esc to close' });
  },
  help() {
    const k = (a, b) => `<div><kbd>${a}</kbd>${b}</div>`;
    this.open(`<h2>Controls</h2>
      <h3>On foot</h3><div class="keys">${k('W A S D', 'Walk')}${k('Mouse', 'Orbit camera (click to capture)')}${k('Shift', 'Run')}${k('Space', 'Jump')}${k('F', 'Talk / use / sit')}${k('← ↑ ↓ →', 'Look without mouse')}</div>
      <h3>Motorcycle</h3><div class="keys">${k('F', 'Ride / park')}${k('W / S', 'Throttle / reverse')}${k('A / D', 'Steer')}${k('Space', 'Brake')}${k('Shift', 'Boost')}${k('N', 'Korell surface atlas')}</div>
      <h3>Flying</h3><div class="keys">${k('Space', 'Lift off · thrust up')}${k('C', 'Thrust down (to land)')}${k('W / S', 'Throttle up / down')}${k('Mouse', 'Pitch & yaw')}${k('A / D', 'Yaw')}${k('Q / E', 'Roll')}${k('Shift', 'Boost')}${k('X', 'Full stop')}${k('V', 'Cockpit / chase view')}${k('L', 'Landing assist')}${k('F', 'Leave the seat · dock')}${k('I', 'Invert pitch')}</div>
      <h3>Travelling</h3><div class="keys">${k('M', 'Galactic chart — pick a star')}${k('J', 'Hold to charge & jump')}${k('Tab', 'Journal')}${k('H', 'This help')}</div>
      <p style="font-size:13px;color:var(--dim)">To leave a world: sit in the pilot's seat, press Space to lift, point the nose up and climb. To reach another star: open the chart, plot a course inside your range ring, fly clear of the planet, put the nose on the marker and hold J. To land: fly at the planet, descend toward the port, then set down gently with C — or press L.</p>`, [], { foot: 'H or Esc to close' });
  },

  // ---------- galactic chart ----------
  initMap() {
    const c = this.mapc = $('mapc'), r = rng(99);
    this.bg = document.createElement('canvas'); this.bg.width = this.bg.height = 1024; const g = this.bg.getContext('2d');
    g.fillStyle = '#05070a'; g.fillRect(0, 0, 1024, 1024);
    const gr = g.createRadialGradient(512, 512, 0, 512, 512, 200); gr.addColorStop(0, 'rgba(255,230,190,.55)'); gr.addColorStop(1, 'rgba(255,230,190,0)'); g.fillStyle = gr; g.fillRect(0, 0, 1024, 1024);
    for (let i = 0; i < 26000; i++) {
      const arm = (i % 4) * Math.PI / 2, d = Math.pow(r(), 0.7) * 480, a = arm + d * 0.0105 + (r() - 0.5) * (0.9 - d / 900) + (r() < 0.25 ? r() * 6.28 : 0);
      const b = 0.15 + r() * 0.5; g.fillStyle = `rgba(${200 + r() * 55 | 0},${200 + r() * 40 | 0},${210 + r() * 45 | 0},${b})`; g.fillRect(512 + Math.cos(a) * d, 512 + Math.sin(a) * d, r() < 0.1 ? 1.6 : 1, 1);
    }
    this.view = { x: 0, y: 0, z: 0.03 }; this.sel = null;
    let drag = null;
    c.addEventListener('mousedown', (e) => { drag = { x: e.clientX, y: e.clientY, moved: 0 }; });
    addEventListener('mousemove', (e) => { if (!drag || !this.mapOpen) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.moved += Math.abs(dx) + Math.abs(dy); this.view.x -= dx / this.view.z; this.view.y -= dy / this.view.z; drag.x = e.clientX; drag.y = e.clientY; this.drawMap(); });
    addEventListener('mouseup', (e) => {
      if (!drag || !this.mapOpen) { drag = null; return; }
      if (drag.moved < 5) { let best = null, bd = 18; for (const s of SYSTEMS) { const p = this.m2s(s), d = Math.hypot(p[0] - e.clientX, p[1] - e.clientY); if (d < bd) { bd = d; best = s; } } if (best) { this.sel = best; G.audio.sfx('click'); this.drawMap(); } }
      drag = null;
    });
    c.addEventListener('wheel', (e) => { e.preventDefault(); const v = this.view, f = Math.exp(-e.deltaY * 0.0015), mx = (e.clientX - innerWidth / 2) / v.z + v.x, my = (e.clientY - innerHeight / 2) / v.z + v.y; v.z = clamp(v.z * f, 0.018, 1.2); v.x = mx - (e.clientX - innerWidth / 2) / v.z; v.y = my - (e.clientY - innerHeight / 2) / v.z; this.drawMap(); }, { passive: false });
    $('mapinfo').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.a === 'plot') { G.setTarget(this.sel.id); } else if (b.dataset.a === 'clear') G.setTarget(null); else if (b.dataset.a === 'close') return this.toggleMap(false); this.drawMap(); });
  },
  m2s(s) { const v = this.view; return [innerWidth / 2 + (s.x - v.x) * v.z, innerHeight / 2 + (s.y - v.y) * v.z]; },
  toggleMap(on) {
    this.mapOpen = on ?? !this.mapOpen; this.el.map.style.display = this.mapOpen ? 'block' : 'none';
    if (this.mapOpen) { document.exitPointerLock?.(); const v = this.view; v.x = G.sys.x - 900; v.y = G.sys.y + 300; v.z = Math.min(innerWidth, innerHeight) / (jumpRange() * 2.6); this.sel = G.save.target ? SYS[G.save.target] : G.sys; this.drawMap(); G.audio.sfx('click'); }
    else G.relock();
  },
  drawMap() {
    const c = this.mapc, dpr = Math.min(devicePixelRatio, 2); if (c.width !== innerWidth * dpr) { c.width = innerWidth * dpr; c.height = innerHeight * dpr; }
    const g = c.getContext('2d'), v = this.view, cur = G.sys, R = jumpRange(); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#05070a'; g.fillRect(0, 0, innerWidth, innerHeight);
    const o = this.m2s({ x: -16000, y: -16000 }), sz = 32000 * v.z; g.imageSmoothingEnabled = true; g.drawImage(this.bg, o[0], o[1], sz, sz);
    const cp = this.m2s(cur);
    g.strokeStyle = 'rgba(95,216,200,.55)'; g.setLineDash([6, 6]); g.beginPath(); g.arc(cp[0], cp[1], R * v.z, 0, 7); g.stroke(); g.setLineDash([]);
    g.fillStyle = 'rgba(95,216,200,.05)'; g.fill();
    if (G.save.target) { const tp = this.m2s(SYS[G.save.target]); g.strokeStyle = '#5fd8c8'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(cp[0], cp[1]); g.lineTo(tp[0], tp[1]); g.stroke(); g.lineWidth = 1; }
    g.font = '11px "Futura","Gill Sans",sans-serif'; g.textBaseline = 'middle';
    for (const s of SYSTEMS) {
      const p = this.m2s(s), vis = G.save.visited[s.id], col = s.lore ? '#f0c070' : '#5fd8c8';
      g.globalAlpha = vis || s.lore ? 1 : 0.7; g.strokeStyle = g.fillStyle = col;
      if (s.lore) { g.beginPath(); g.moveTo(p[0], p[1] - 6); g.lineTo(p[0] + 5, p[1]); g.lineTo(p[0], p[1] + 6); g.lineTo(p[0] - 5, p[1]); g.closePath(); g.fill(); }
      else { g.beginPath(); g.arc(p[0], p[1], 4, 0, 7); vis ? g.fill() : g.stroke(); }
      if (s.lore || v.z > 0.05 || s === this.sel) { g.fillStyle = s.lore ? '#f3e2bf' : '#a8d8d0'; g.fillText(s.name.toUpperCase(), p[0] + 10, p[1] + (s.id === 'alpha' || s.id === 'sirius' ? -9 : s.id === 'anacreon' || s.id === 'smyrno' || s.id === 'cygni' ? 10 : 0)); }
      g.globalAlpha = 1;
    }
    g.strokeStyle = '#fff'; g.beginPath(); g.arc(cp[0], cp[1], 11, 0, 7); g.stroke(); g.fillStyle = '#fff'; g.fillText('YOU ARE HERE', cp[0] - 36, cp[1] - 22);
    if (this.sel) { const p = this.m2s(this.sel); g.strokeStyle = '#fff'; g.strokeRect(p[0] - 9, p[1] - 9, 18, 18); }
    $('mapsub').textContent = `${cur.name} · hyperdrive range ${fmt(R)} parsecs`;
    const s = this.sel, d = s ? dist(s, cur) : 0, here = s === cur, tgt = s && G.save.target === s.id;
    $('mapinfo').innerHTML = s ? `<h2>${s.name}</h2><span class="tag ${s.lore ? 'book' : 'inv'}">${s.lore ? 'From Asimov’s Foundation' : 'Invented for this game'}</span>
      <div style="color:var(--teal)">${s.faction}</div><div style="color:var(--dim)">Population: ${s.pop}${G.save.visited[s.id] ? ' · visited' : ''}</div><p style="margin:8px 0">${s.desc}</p>
      ${here ? '<div style="color:var(--dim)">You are here.</div>' : `<div>${fmt(d)} parsecs ${d > R ? `<span style="color:#ff8a6a">— beyond your ${fmt(R)} pc range. Jump in stages, or fit better coils.</span>` : '— within range'}</div>
      <div style="margin-top:10px"><button class="btn" data-a="plot" ${d > R || tgt ? 'disabled' : ''}>${tgt ? 'Course plotted' : 'Plot course'}</button> ${tgt ? '<button class="btn" data-a="clear">Clear</button>' : ''} <button class="btn" data-a="close">Close chart</button></div>`}` : '';
  },
};
