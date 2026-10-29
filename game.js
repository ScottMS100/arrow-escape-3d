'use strict';
// Arrow Escape 3D — tap an arrow to slide it out along the way it points.
// An arrow is blocked if any other arrow sits in its path. 2D and 3D modes.

const DIRS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

function rng(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const ck = (x, y, z) => x + ',' + y + ',' + z;

function params(mode, level) {
  if (mode === '2d') {
    return {
      W: Math.min(4 + Math.floor(level / 3), 9),
      H: Math.min(5 + Math.floor(level / 2), 13), D: 1,
      dens: Math.min(0.5 + level * 0.01, 0.68),
      maxLen: Math.min(4 + Math.floor(level / 3), 9),
    };
  }
  const n = Math.min(3 + Math.floor(level / 4), 6);
  return { W: n, H: n, D: n, dens: 0.42, maxLen: Math.min(4 + Math.floor(level / 4), 8) };
}

// Arrows are placed one at a time; a new arrow's exit ray may not cross any
// earlier arrow. Removing them in reverse placement order is then always
// possible, so every level is solvable.
function generate(mode, level) {
  const P = params(mode, level);
  const R = rng(level * 7919 + (mode === '3d' ? 13 : 1));
  const { W, H, D } = P;
  const occ = new Set();
  const inb = (x, y, z) => x >= 0 && y >= 0 && z >= 0 && x < W && y < H && z < D;
  const dirs = mode === '2d' ? DIRS.slice(0, 4) : DIRS;
  const target = Math.floor(W * H * D * P.dens);
  let cells = 0;
  const arrows = [];

  for (let tries = 0; tries < 5000 && cells < target; tries++) {
    const len = 2 + Math.floor(R() * (P.maxLen - 1));
    let p = [Math.floor(R() * W), Math.floor(R() * H), Math.floor(R() * D)];
    if (occ.has(ck(...p))) continue;
    const path = [p];
    const mine = new Set([ck(...p)]);
    let lastd = null;
    while (path.length < len) {
      const opts = dirs.filter(d => {
        const q = [p[0] + d[0], p[1] + d[1], p[2] + d[2]];
        return inb(...q) && !occ.has(ck(...q)) && !mine.has(ck(...q));
      });
      if (!opts.length) break;
      const d = (lastd && opts.includes(lastd) && R() < 0.5) ? lastd : opts[Math.floor(R() * opts.length)];
      p = [p[0] + d[0], p[1] + d[1], p[2] + d[2]];
      path.push(p); mine.add(ck(...p)); lastd = d;
    }
    if (path.length < 2) continue;
    for (const cand of [path, path.slice().reverse()]) {
      const a = cand[cand.length - 2], b = cand[cand.length - 1];
      const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const ray = [];
      let q = [b[0] + d[0], b[1] + d[1], b[2] + d[2]];
      let ok = true;
      while (inb(...q)) {
        if (occ.has(ck(...q)) || mine.has(ck(...q))) { ok = false; break; }
        ray.push(q);
        q = [q[0] + d[0], q[1] + d[1], q[2] + d[2]];
      }
      if (!ok) continue;
      const L = cand.length;
      const ext = cand.concat(ray);
      let e = ray.length ? ray[ray.length - 1] : b;
      for (let i = 0; i < L + 2; i++) { e = [e[0] + d[0], e[1] + d[1], e[2] + d[2]]; ext.push(e); }
      const id = arrows.length;
      arrows.push({
        id, path: cand, dir: d, ray, ext, L,
        hue: (id * 47 + 190) % 360,
        state: 'idle', s: 0, v: 5, bump: -1, flash: 0,
      });
      for (const c of cand) occ.add(ck(...c));
      cells += L;
      break;
    }
  }
  return { P, arrows };
}

if (typeof module !== 'undefined') module.exports = { generate, params, ck };

if (typeof document !== 'undefined') (function () {
  const $ = id => document.getElementById(id);
  const canvas = $('c'), ctx = canvas.getContext('2d');
  const LIGHT = (() => { const v = [-0.35, 0.65, 0.7], l = Math.hypot(...v); return v.map(x => x / l); })();

  let mode = '2d', level = 1, G = null, owner = null;
  let lives = 3, over = false, hintId = -1, hintT = 0;
  let yaw = -0.7, pitch = 0.5;
  let faces = [], samples = [], scale = 1, ox = 0, oy = 0, cw = 0, ch = 0;
  let cY, sY, cP, sP, off = [0, 0, 0];

  const store = {
    get() { try { return JSON.parse(localStorage.getItem('ae_progress')) || { '2d': 1, '3d': 1 }; } catch (e) { return { '2d': 1, '3d': 1 }; } },
    set(m, l) { try { const p = store.get(); p[m] = Math.max(p[m] || 1, l); localStorage.setItem('ae_progress', JSON.stringify(p)); } catch (e) { } },
  };

  function resize() {
    const r = canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    cw = r.width; ch = r.height;
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (G) fit();
  }

  function fit() {
    const { W, H, D } = G.P;
    off = [(W - 1) / 2, (H - 1) / 2, (D - 1) / 2];
    ox = cw / 2; oy = ch / 2;
    if (mode === '2d') scale = Math.min(cw / (W + 0.6), ch / (H + 0.6));
    else scale = Math.min(cw, ch) / (Math.hypot(W, H, D) + 0.8);
  }

  function start(m, l) {
    mode = m; level = l;
    G = generate(m, l);
    owner = new Map();
    for (const a of G.arrows) for (const c of a.path) owner.set(ck(...c), a.id);
    lives = 3; over = false; hintId = -1;
    if (m === '2d') { yaw = 0; pitch = 0; } else { yaw = -0.7; pitch = 0.5; }
    $('menu').classList.add('hide'); $('overlay').classList.add('hide');
    $('title').textContent = (m === '2d' ? '2D' : '3D') + ' · Level ' + l;
    updateHud(); resize();
  }

  function updateHud() { $('lives').textContent = '♥'.repeat(lives) + '♡'.repeat(3 - lives); }

  function showMsg(title, sub, btn, fn) {
    $('msgTitle').textContent = title; $('msgSub').textContent = sub;
    const b = $('msgBtn'); b.textContent = btn; b.onclick = fn;
    $('overlay').classList.remove('hide');
  }

  // ---------- geometry ----------
  function cam(p) {
    const x = p[0] - off[0], y = p[1] - off[1], z = p[2] - off[2];
    const x1 = x * cY + z * sY, z1 = -x * sY + z * cY;
    return [x1, y * cP - z1 * sP, y * sP + z1 * cP];
  }

  function emit(pts, center, hue, sat, light, id) {
    const P = pts.map(cam), C = cam(center);
    const u = [P[1][0] - P[0][0], P[1][1] - P[0][1], P[1][2] - P[0][2]];
    const v = [P[2][0] - P[0][0], P[2][1] - P[0][1], P[2][2] - P[0][2]];
    let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const m = [P[0][0] - C[0], P[0][1] - C[1], P[0][2] - C[2]];
    if (n[0] * m[0] + n[1] * m[1] + n[2] * m[2] < 0) n = n.map(x => -x);
    const len = Math.hypot(...n) || 1; n = n.map(x => x / len);
    if (n[2] <= 0.001) return;
    const lit = Math.max(0, n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]);
    const fill = `hsl(${hue} ${sat}% ${Math.min(92, light * (0.6 + 0.55 * lit))}%)`;
    let z = 0; for (const q of P) z += q[2];
    faces.push({ poly: P.map(q => [ox + q[0] * scale, oy - q[1] * scale]), z: z / P.length, fill, id });
  }

  const BOXF = [[0, 2, 6, 4], [1, 3, 7, 5], [0, 1, 5, 4], [2, 3, 7, 6], [0, 1, 3, 2], [4, 5, 7, 6]];
  function box(lo, hi, hue, sat, light, id) {
    const c = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2];
    const k = i => [i & 1 ? hi[0] : lo[0], i & 2 ? hi[1] : lo[1], i & 4 ? hi[2] : lo[2]];
    for (const f of BOXF) emit(f.map(k), c, hue, sat, light, id);
  }

  function pyramid(c, d, hue, sat, light, id) {
    const ax = d[0] ? 0 : d[1] ? 1 : 2, a1 = (ax + 1) % 3, a2 = (ax + 2) % 3, sg = d[ax];
    const at = (t, p, q) => { const r = c.slice(); r[ax] += sg * t; r[a1] += p; r[a2] += q; return r; };
    const tip = at(0.5, 0, 0), B = 0.32;
    const base = [at(-0.05, -B, -B), at(-0.05, B, -B), at(-0.05, B, B), at(-0.05, -B, B)];
    const ctr = at(0.12, 0, 0);
    for (let i = 0; i < 4; i++) emit([tip, base[i], base[(i + 1) % 4]], ctr, hue, sat, light, id);
    emit(base, ctr, hue, sat, light, id);
  }

  function pointAt(a, u) {
    u = Math.max(0, Math.min(a.ext.length - 1, u));
    const i = Math.min(Math.floor(u), a.ext.length - 2), f = u - i;
    const p = a.ext[i], q = a.ext[i + 1];
    return [p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f, p[2] + (q[2] - p[2]) * f];
  }

  function drawArrow(a) {
    const s = a.s + (a.state === 'idle' && a.bump >= 0 ? 0.28 * Math.sin(Math.PI * a.bump) : 0);
    const pts = [pointAt(a, s)];
    for (let i = Math.floor(s) + 1; i < s + a.L - 1 - 1e-6; i++) pts.push(a.ext[i]);
    const head = pointAt(a, s + a.L - 1);
    pts.push(head);
    const clean = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const p = clean[clean.length - 1];
      if (Math.hypot(pts[i][0] - p[0], pts[i][1] - p[1], pts[i][2] - p[2]) > 1e-6) clean.push(pts[i]);
    }
    let hue = a.hue, sat = 70, light = 55;
    if (a.flash > 0) { hue = 0; sat = 85; light = 55; }
    else if (a.id === hintId) { sat = 90; light = 58 + 14 * Math.sin(performance.now() / 120); }
    const H = 0.19;
    for (let j = 0; j + 1 < clean.length; j++) {
      const A = clean[j], B = clean[j + 1];
      const lo = [Math.min(A[0], B[0]) - H, Math.min(A[1], B[1]) - H, Math.min(A[2], B[2]) - H];
      const hi = [Math.max(A[0], B[0]) + H, Math.max(A[1], B[1]) + H, Math.max(A[2], B[2]) + H];
      if (j + 2 === clean.length) { // no extension past the head end
        for (let k = 0; k < 3; k++) {
          if (a.dir[k] > 0) hi[k] = B[k]; else if (a.dir[k] < 0) lo[k] = B[k];
        }
      }
      box(lo, hi, hue, sat, light, a.id);
    }
    pyramid(head, a.dir, hue, sat, Math.min(75, light + 8), a.id);
    for (let t = 0; t <= a.L - 1; t += 0.5) {
      const q = cam(pointAt(a, s + t));
      samples.push({ id: a.id, x: ox + q[0] * scale, y: oy - q[1] * scale, z: q[2] });
    }
  }

  function render() {
    ctx.clearRect(0, 0, cw, ch);
    if (!G) return;
    cY = Math.cos(yaw); sY = Math.sin(yaw); cP = Math.cos(pitch); sP = Math.sin(pitch);
    faces = []; samples = [];
    const { W, H, D } = G.P;

    ctx.fillStyle = 'rgba(255,255,255,.14)';
    if (mode === '2d') {
      for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) {
        const q = cam([x, y, 0]);
        ctx.beginPath(); ctx.arc(ox + q[0] * scale, oy - q[1] * scale, 2, 0, 6.3); ctx.fill();
      }
    } else {
      const cs = [];
      for (let i = 0; i < 8; i++) cs.push(cam([i & 1 ? W - 0.5 : -0.5, i & 2 ? H - 0.5 : -0.5, i & 4 ? D - 0.5 : -0.5]));
      ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 1; ctx.beginPath();
      for (const [i, j] of [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]]) {
        ctx.moveTo(ox + cs[i][0] * scale, oy - cs[i][1] * scale);
        ctx.lineTo(ox + cs[j][0] * scale, oy - cs[j][1] * scale);
      }
      ctx.stroke();
    }

    for (const a of G.arrows) if (a.state !== 'gone') drawArrow(a);
    faces.sort((p, q) => p.z - q.z);
    ctx.lineWidth = 1; ctx.lineJoin = 'round';
    for (const f of faces) {
      ctx.fillStyle = f.fill; ctx.strokeStyle = f.fill;
      ctx.beginPath();
      f.poly.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
  }

  // ---------- game ----------
  function update(dt) {
    if (!G) return;
    let anyMoving = false;
    for (const a of G.arrows) {
      if (a.flash > 0) a.flash -= dt;
      if (a.bump >= 0) { a.bump += dt / 0.35; if (a.bump >= 1) a.bump = -1; }
      if (a.state === 'moving') {
        anyMoving = true;
        a.v = Math.min(a.v + 60 * dt, 28);
        a.s += a.v * dt;
        if (a.s >= a.ray.length + a.L + 1) {
          a.state = 'gone';
          for (const c of a.path) owner.delete(ck(...c));
        }
      }
    }
    if (hintId >= 0 && (hintT -= dt) <= 0) hintId = -1;
    if (!over && !anyMoving && G.arrows.every(a => a.state === 'gone')) {
      over = true;
      store.set(mode, level + 1);
      showMsg('Level cleared!', 'Nice work.', 'Next level', () => start(mode, level + 1));
    }
  }

  function tap(id) {
    const a = G.arrows[id];
    if (over || a.state !== 'idle') return;
    let hard = false, soft = false;
    for (const c of a.ray) {
      const o = owner.get(ck(...c));
      if (o === undefined) continue;
      if (G.arrows[o].state === 'idle') { hard = true; break; }
      soft = true;
    }
    if (hard || soft) {
      a.bump = 0;
      if (hard) {
        a.flash = 0.4; lives--; updateHud();
        if (lives <= 0) { over = true; showMsg('Out of lives', 'Give it another go.', 'Retry', () => start(mode, level)); }
      }
      return;
    }
    a.state = 'moving'; a.v = 5;
    if (hintId === id) hintId = -1;
  }

  function hint() {
    if (!G || over) return;
    const free = G.arrows.filter(a => a.state === 'idle' && a.ray.every(c => owner.get(ck(...c)) === undefined));
    if (free.length) { hintId = free[Math.floor(Math.random() * free.length)].id; hintT = 3; }
  }

  function inPoly(poly, x, y) {
    let r = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) r = !r;
    }
    return r;
  }

  function pick(x, y) {
    for (let i = faces.length - 1; i >= 0; i--) if (inPoly(faces[i].poly, x, y)) return faces[i].id;
    let best = -1, bd = 0.4 * scale;
    for (const s of samples) { const d = Math.hypot(s.x - x, s.y - y); if (d < bd) { bd = d; best = s.id; } }
    return best;
  }

  // ---------- input ----------
  let down = null;
  canvas.addEventListener('pointerdown', e => {
    canvas.setPointerCapture(e.pointerId);
    down = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, drag: false };
  });
  canvas.addEventListener('pointermove', e => {
    if (!down) return;
    if (!down.drag && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) down.drag = true;
    if (down.drag && mode === '3d') {
      yaw += (e.clientX - down.lx) * 0.01;
      pitch = Math.max(-1.5, Math.min(1.5, pitch + (e.clientY - down.ly) * 0.01));
    }
    down.lx = e.clientX; down.ly = e.clientY;
  });
  canvas.addEventListener('pointerup', e => {
    if (down && !down.drag && G) {
      const r = canvas.getBoundingClientRect();
      const id = pick(e.clientX - r.left, e.clientY - r.top);
      if (id >= 0) tap(id);
    }
    down = null;
  });
  canvas.addEventListener('pointercancel', () => { down = null; });

  function showMenu() {
    const p = store.get();
    $('lv2d').textContent = 'Level ' + p['2d']; $('lv3d').textContent = 'Level ' + p['3d'];
    $('menu').classList.remove('hide'); $('overlay').classList.add('hide');
  }
  $('play2d').onclick = () => start('2d', store.get()['2d']);
  $('play3d').onclick = () => start('3d', store.get()['3d']);
  $('back').onclick = showMenu;
  $('restart').onclick = () => start(mode, level);
  $('hint').onclick = hint;
  window.addEventListener('resize', resize);

  let last = performance.now();
  function frame(t) {
    const dt = Math.min(0.05, (t - last) / 1000); last = t;
    update(dt); render();
    requestAnimationFrame(frame);
  }
  showMenu(); resize();
  requestAnimationFrame(frame);
  window.__game = { start, get G() { return G; }, tap, pick };
})();
