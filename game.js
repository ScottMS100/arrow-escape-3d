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
      W: Math.min(12 + level, 22),
      H: Math.min(14 + level, 26), D: 1,
      dens: 1,
      maxLen: Math.min(10 + level, 24),
    };
  }
  if (mode === '3dout') {
    // finer lattice: arrows sit PITCH (~51% of the original) apart on the same-sized cube
    const n = Math.round(Math.min(6 + Math.floor(level / 6), 12) / PITCH);
    return {
      W: n, H: n, D: n, dens: Math.min(0.65 + level * 0.005, 0.8),
      maxLen: Math.round(Math.min(5 + Math.floor(level / 4), 14) / PITCH),
    };
  }
  const n = Math.min(5 + Math.floor(level / 4), 12);
  return { W: n, H: n, D: n, dens: Math.min(0.6 + level * 0.005, 0.8), maxLen: Math.min(6 + Math.floor(level / 3), 16) };
}

const PITCH = 0.4875; // outside mode: lattice spacing relative to the original
const SEEDS = { '2d': 1, '3d': 13, '3dout': 29 };

// 2D: cover the board with winding paths first, then give each a head end and
// repair any circular blocking (flip the head, else drop the arrow) so that
// the board is dense and still always solvable.
function gen2d(P, R) {
  const { W, H, maxLen } = P;
  const own = new Array(W * H).fill(-1);
  const D4 = DIRS.slice(0, 4);
  const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? -2 : own[y * W + x];
  const free = (x, y) => at(x, y) === -1;
  const deg = (x, y) => D4.filter(d => free(x + d[0], y + d[1])).length;
  let arrows = [];
  const claim = (path, id) => path.forEach(c => { own[c[1] * W + c[0]] = id; });

  // cover every empty cell with winding paths (single cells stay empty)
  function fill() {
    const used = new Set();
    for (;;) {
      let best = null, bd = 9, n = 0;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (!free(x, y) || used.has(y * W + x)) continue;
        const d = deg(x, y);
        if (d < bd) { bd = d; best = [x, y]; n = 1; } else if (d === bd && R() < 1 / ++n) best = [x, y];
      }
      if (!best) break;
      const path = [best], id = arrows.length;
      own[best[1] * W + best[0]] = id;
      const len = 3 + Math.floor(R() * (maxLen - 2));
      for (let end = 0; end < 2; end++) {
        while (path.length < len) {
          const h = end ? path[0] : path[path.length - 1];
          const opts = D4.filter(d => free(h[0] + d[0], h[1] + d[1]));
          if (!opts.length) break;
          let d;
          if (R() < 0.3) d = opts[Math.floor(R() * opts.length)];
          else {
            let m = 9, c = [];
            for (const o of opts) { const k = deg(h[0] + o[0], h[1] + o[1]); if (k < m) { m = k; c = [o]; } else if (k === m) c.push(o); }
            d = c[Math.floor(R() * c.length)];
          }
          const q = [h[0] + d[0], h[1] + d[1]];
          own[q[1] * W + q[0]] = id;
          if (end) path.unshift(q); else path.push(q);
        }
      }
      if (path.length < 2) { own[best[1] * W + best[0]] = -1; used.add(best[1] * W + best[0]); continue; }
      if (R() < 0.5) path.reverse();
      arrows.push({ path });
    }
  }
  const dirOf = p => { const a = p[p.length - 2], b = p[p.length - 1]; return [b[0] - a[0], b[1] - a[1], 0]; };
  const rayOf = p => {
    const d = dirOf(p), b = p[p.length - 1], ray = [];
    let x = b[0] + d[0], y = b[1] + d[1];
    while (x >= 0 && y >= 0 && x < W && y < H) { ray.push([x, y, 0]); x += d[0]; y += d[1]; }
    return ray;
  };

  // peel off arrows that can leave; when only loops remain, flip a head or drop an arrow
  function resolve() {
    const alive = new Set(arrows.map((_, i) => i));
    const blockers = path => {
      const s = new Set();
      for (const r of rayOf(path)) { const o = own[r[1] * W + r[0]]; if (o >= 0 && alive.has(o)) s.add(o); }
      return s;
    };
    const order = [];
    while (alive.size) {
      let moved = true;
      while (moved) {
        moved = false;
        for (const i of [...alive]) if (!blockers(arrows[i].path).size) { alive.delete(i); order.push(i); moved = true; }
      }
      if (!alive.size) break;
      let cur = [...alive][Math.floor(R() * alive.size)];
      const seen = [];
      while (!seen.includes(cur)) { seen.push(cur); cur = [...blockers(arrows[cur].path)][0]; }
      const cyc = seen.slice(seen.indexOf(cur));
      const v = cyc[Math.floor(R() * cyc.length)];
      const a = arrows[v], rev = a.path.slice().reverse();
      if (blockers(rev).size < blockers(a.path).size) a.path = rev;
      else { alive.delete(v); claim(a.path, -1); a.dead = true; }
    }
    return order;
  }

  let order;
  fill();
  for (let pass = 0; pass < 6; pass++) {
    order = resolve();
    // drop dead arrows, renumber, and try to cover the holes they left
    arrows = order.map(i => arrows[i]);
    arrows.forEach((a, i) => claim(a.path, i));
    order = arrows.map((_, i) => i);
    if (pass < 5) fill();
  }

  const res = [];
  order.forEach(i => {
    const a = arrows[i];
    const L = a.path.length, d = dirOf(a.path), ray = rayOf(a.path);
    const ext = a.path.map(c => [c[0], c[1], 0]).concat(ray);
    let e = ray.length ? ray[ray.length - 1] : [a.path[L - 1][0], a.path[L - 1][1], 0];
    for (let k = 0; k < L + 2; k++) { e = [e[0] + d[0], e[1] + d[1], 0]; ext.push(e); }
    res.push({
      path: a.path.map(c => [c[0], c[1], 0]), dir: d, ray, ext, L,
      state: 'idle', s: 0, v: 5, bump: -1, flash: 0,
    });
  });
  res.reverse().forEach((a, i) => { a.id = i; a.hue = (i * 47 + 190) % 360; });
  return { P, arrows: res };
}

// Arrows are placed one at a time; a new arrow's exit ray may not cross any
// earlier arrow. Removing them in reverse placement order is then always
// possible, so every level is solvable.
function generate(mode, level) {
  const P = params(mode, level);
  const R = rng(level * 7919 + SEEDS[mode]);
  if (mode === '2d') return gen2d(P, R);
  const { W, H, D } = P;
  const occ = new Set();
  const inb = (x, y, z) => x >= 0 && y >= 0 && z >= 0 && x < W && y < H && z < D;
  // outside mode: arrows lie flat on the cube's surface, so every cell they
  // occupy or sweep through must be a surface cell
  const out = mode === '3dout';
  const shell = (x, y, z) => x === 0 || y === 0 || z === 0 || x === W - 1 || y === H - 1 || z === D - 1;
  // outside mode: a step along `d` from p runs along a cube edge if both other
  // coordinates sit on the boundary; arrows may cross an edge but not follow one
  const alongEdge = (p, d) => {
    let k = 0;
    for (let ax = 0; ax < 3; ax++) if (!d[ax] && (p[ax] === 0 || p[ax] === (ax ? (ax === 1 ? H : D) : W) - 1)) k++;
    return k >= 2;
  };
  const onEdge = c => c.filter((v, ax) => v === 0 || v === (ax ? (ax === 1 ? H : D) : W) - 1).length >= 2;
  const dirs = mode === '2d' ? DIRS.slice(0, 4) : DIRS;
  const target = Math.floor((out ? W * H * D - (W - 2) * (H - 2) * (D - 2) : W * H * D) * P.dens);
  // Harder levels compare more candidates per arrow and keep the one that
  // blocks the most earlier arrows' exits, which builds deeper dependency chains.
  const pickN = mode === '2d' ? Math.min(40 + level * 2, 120) : Math.min(8 + Math.floor(level * 0.75), 40);
  const blockedBy = new Map(); // cell -> number of earlier arrows whose exit ray crosses it
  const arrows = [];
  let cells = 0, budget = Math.max(5000, W * H * D * (mode === '2d' ? 60 : 12));

  // random arrow whose exit ray crosses no existing arrow, or null
  function build() {
    const len = 2 + Math.floor(R() * (P.maxLen - 1));
    let p = [Math.floor(R() * W), Math.floor(R() * H), Math.floor(R() * D)];
    if (occ.has(ck(...p)) || (out && !shell(...p))) return null;
    const path = [p];
    const mine = new Set([ck(...p)]);
    let lastd = null;
    while (path.length < len) {
      const opts = dirs.filter(d => {
        const q = [p[0] + d[0], p[1] + d[1], p[2] + d[2]];
        return inb(...q) && (!out || (shell(...q) && !alongEdge(p, d))) && !occ.has(ck(...q)) && !mine.has(ck(...q));
      });
      if (!opts.length) break;
      const d = (lastd && opts.includes(lastd) && R() < 0.5) ? lastd : opts[Math.floor(R() * opts.length)];
      p = [p[0] + d[0], p[1] + d[1], p[2] + d[2]];
      path.push(p); mine.add(ck(...p)); lastd = d;
    }
    if (path.length < 2) return null;
    // outside mode: an arrow may bend over an edge but never starts or ends on one
    if (out && (onEdge(path[0]) || onEdge(path[path.length - 1]))) return null;
    const tries = R() < 0.5 ? [path, path.slice().reverse()] : [path.slice().reverse(), path];
    for (const cand of tries) {
      const a = cand[cand.length - 2], b = cand[cand.length - 1];
      const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const ray = [];
      let q = [b[0] + d[0], b[1] + d[1], b[2] + d[2]];
      let ok = true;
      while (inb(...q)) {
        if (occ.has(ck(...q)) || mine.has(ck(...q)) || (out && !shell(...q))) { ok = false; break; }
        ray.push(q);
        q = [q[0] + d[0], q[1] + d[1], q[2] + d[2]];
      }
      if (!ok || (out && (!ray.length || alongEdge(b, d)))) continue;
      return { cand, ray, d };
    }
    return null;
  }

  while (cells < target && budget > 0) {
    let best = null, bs = -1, found = 0;
    while (budget-- > 0 && found < pickN) {
      const c = build();
      if (!c) continue;
      found++;
      let sc = R() * 0.5;
      for (const q of c.cand) sc += blockedBy.get(ck(...q)) || 0;
      if (sc > bs) { bs = sc; best = c; }
    }
    if (!best) break;
    const { cand, ray, d } = best, L = cand.length, b = cand[L - 1];
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
    for (const c of ray) blockedBy.set(ck(...c), (blockedBy.get(ck(...c)) || 0) + 1);
    cells += L;
  }
  return { P, arrows };
}

if (typeof module !== 'undefined') module.exports = { generate, params, ck, PITCH };

if (typeof document !== 'undefined') (function () {
  const $ = id => document.getElementById(id);
  const canvas = $('c'), ctx = canvas.getContext('2d');
  const LIGHT = (() => { const v = [-0.35, 0.65, 0.7], l = Math.hypot(...v); return v.map(x => x / l); })();

  let mode = '2d', level = 1, G = null, owner = null;
  let lives = 3, over = false, hintId = -1, hintT = 0;
  let selId = -1, selT = 0;            // double-tap mode: armed arrow and seconds left
  const SEL_SECS = 4;
  const settings = { doubleTap: false };
  try { Object.assign(settings, JSON.parse(localStorage.getItem('ae_settings'))); } catch (e) { }
  let yaw = -0.7, pitch = 0.5;
  let faces = [], samples = [], solid = [], scale = 1, ox = 0, oy = 0, cw = 0, ch = 0;
  let baseScale = 1, zoom = 1, panX = 0, panY = 0;
  let cY, sY, cP, sP, off = [0, 0, 0];

  const store = {
    get() {
      const d = { '2d': 1, '3d': 1, '3dout': 1 };
      try { return Object.assign(d, JSON.parse(localStorage.getItem('ae_progress'))); } catch (e) { return d; }
    },
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
    if (mode === '2d') baseScale = Math.min(cw / (W + 0.6), ch / (H + 0.6));
    else baseScale = Math.min(cw, ch) / (Math.hypot(W, H, D) + 0.8);
  }

  function start(m, l) {
    mode = m; level = l;
    G = generate(m, l);
    owner = new Map();
    for (const a of G.arrows) for (const c of a.path) owner.set(ck(...c), a.id);
    lives = 3; over = false; hintId = -1; selId = -1; zoom = 1; panX = panY = 0;
    if (m === '2d') { yaw = 0; pitch = 0; } else { yaw = -0.7; pitch = 0.5; }
    $('menu').classList.add('hide'); $('overlay').classList.add('hide');
    $('title').textContent = { '2d': '2D', '3d': '3D Inside', '3dout': '3D Outside' }[m] + ' · Level ' + l;
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

  // is a camera-space point hidden behind the opaque cube (outside mode)?
  function occluded(cx, cy, cz) {
    const sx = ox + cx * scale, sy = oy - cy * scale;
    for (const f of solid) {
      if (!inPoly(f.poly, sx, sy)) continue;
      if (cz < (f.pd - f.n[0] * cx - f.n[1] * cy) / f.n[2] - 0.005) return true;
    }
    return false;
  }

  function emit(pts, center, hue, sat, light, id, dest) {
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
    let cx = 0, cy = 0, cz = 0;
    for (const q of P) { cx += q[0]; cy += q[1]; cz += q[2]; }
    cx /= P.length; cy /= P.length; cz /= P.length;
    if (!dest && solid.length && occluded(cx, cy, cz)) return;
    (dest || faces).push({
      poly: P.map(q => [ox + q[0] * scale, oy - q[1] * scale]), z: cz, fill, id,
      n, pd: n[0] * P[0][0] + n[1] * P[0][1] + n[2] * P[0][2],
    });
  }

  const BOXF = [[0, 2, 6, 4], [1, 3, 7, 5], [0, 1, 5, 4], [2, 3, 7, 6], [0, 1, 3, 2], [4, 5, 7, 6]];
  function box(lo, hi, hue, sat, light, id, dest) {
    const c = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2];
    const k = i => [i & 1 ? hi[0] : lo[0], i & 2 ? hi[1] : lo[1], i & 4 ? hi[2] : lo[2]];
    for (const f of BOXF) emit(f.map(k), c, hue, sat, light, id, dest);
  }

  // z (towards the viewer) of the unit vector along `axis` with sign `sg`
  function nzOf(axis, sg) {
    const u = [0, 0, 0]; u[axis] = sg;
    return u[1] * sP + (-u[0] * sY + u[2] * cY) * cP;
  }

  // Outside mode: arrows are flat ribbons lying on the cube's surface.
  function drawFlat(a, clean, head, hue, sat, light) {
    const N = G.P.W - 1, w = 0.035 / PITCH, lift = 0.012, th = 0.006;
    const near = (v, t) => Math.abs(v - t) < 1e-6;
    const faceOf = (cands, ref) => {
      let best = null, bz = -9;
      for (const b of cands) {
        const sg = ref[b] < N / 2 ? -1 : 1, z = nzOf(b, sg);
        if (z > bz) { bz = z; best = { b, sg }; }
      }
      return best;
    };
    const clamp = (v, orig) => (orig >= 0 && orig <= N) ? Math.max(0, Math.min(N, v)) : v;
    for (let j = 0; j + 1 < clean.length; j++) {
      const A = clean[j], B = clean[j + 1];
      let sa = 0;
      for (let k = 1; k < 3; k++) if (Math.abs(B[k] - A[k]) > Math.abs(B[sa] - A[sa])) sa = k;
      const nb = faceOf([0, 1, 2].filter(b => b !== sa && near(A[b], B[b]) && (near(A[b], 0) || near(A[b], N))), A);
      if (!nb) continue;
      const lat = 3 - sa - nb.b, sg = Math.sign(B[sa] - A[sa]) || 1;
      const s0 = A[sa] - sg * w, s1 = B[sa] + (j + 2 === clean.length ? 0 : sg * w);
      const e0 = clamp(s0, A[sa]), e1 = clamp(s1, B[sa]);
      const lo = [0, 0, 0], hi = [0, 0, 0], plane = A[nb.b] + nb.sg * lift;
      lo[sa] = Math.min(e0, e1); hi[sa] = Math.max(e0, e1);
      lo[lat] = A[lat] - w; hi[lat] = A[lat] + w;
      lo[nb.b] = plane - th; hi[nb.b] = plane + th;
      box(lo, hi, hue, sat, light, a.id);
    }
    const da = a.dir[0] ? 0 : a.dir[1] ? 1 : 2;
    const nb = faceOf([0, 1, 2].filter(b => b !== da && (near(head[b], 0) || near(head[b], N))), head);
    if (!nb) return;
    const lat = 3 - da - nb.b, sg = a.dir[da];
    const at = (t, p) => { const r = head.slice(); r[da] += sg * t; r[lat] += p; r[nb.b] += nb.sg * lift; return r; };
    const ctr = head.slice(); ctr[nb.b] -= nb.sg * 0.1;
    emit([at(-0.05 + 0.7 * (0.5 / PITCH + 0.05), 0), at(-0.05, -0.098 / PITCH), at(-0.05, 0.098 / PITCH)], ctr, hue, sat, Math.min(75, light + 8), a.id);
  }

  function pyramid(c, d, hue, sat, light, id) {
    const ax = d[0] ? 0 : d[1] ? 1 : 2, a1 = (ax + 1) % 3, a2 = (ax + 2) % 3, sg = d[ax];
    const at = (t, p, q) => { const r = c.slice(); r[ax] += sg * t; r[a1] += p; r[a2] += q; return r; };
    const tip = at(0.335, 0, 0), B = 0.07;
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
    else if (a.id === selId) { sat = 40; light = 82 + 12 * Math.sin(performance.now() / 90); }
    else if (a.id === hintId) { sat = 90; light = 58 + 14 * Math.sin(performance.now() / 120); }
    const H = 0.03;
    if (mode === '3dout') drawFlat(a, clean, head, hue, sat, light);
    else for (let j = 0; j + 1 < clean.length; j++) {
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
    if (mode !== '3dout') pyramid(head, a.dir, hue, sat, Math.min(75, light + 8), a.id);
    for (let t = 0; t <= a.L - 1; t += 0.5) {
      const q = cam(pointAt(a, s + t));
      if (solid.length && occluded(q[0], q[1], q[2])) continue;
      samples.push({ id: a.id, x: ox + q[0] * scale, y: oy - q[1] * scale, z: q[2] });
    }
  }

  function render() {
    ctx.clearRect(0, 0, cw, ch);
    if (!G) return;
    cY = Math.cos(yaw); sY = Math.sin(yaw); cP = Math.cos(pitch); sP = Math.sin(pitch);
    faces = []; samples = []; solid = [];
    scale = baseScale * zoom; ox = cw / 2 + panX; oy = ch / 2 + panY;
    const { W, H, D } = G.P;

    ctx.fillStyle = 'rgba(255,255,255,.14)';
    if (mode === '2d') {
      for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) {
        const q = cam([x, y, 0]);
        ctx.beginPath(); ctx.arc(ox + q[0] * scale, oy - q[1] * scale, 2, 0, 6.3); ctx.fill();
      }
    } else if (mode === '3dout') {
      const N = W - 1;
      solid = [];
      box([0, 0, 0], [N, N, N], 222, 22, 30, -1, solid);
      for (const f of solid) {
        ctx.fillStyle = f.fill; ctx.strokeStyle = 'rgba(255,255,255,.14)';
        ctx.beginPath();
        f.poly.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
        ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      ctx.fillStyle = 'rgba(255,255,255,.2)';
      for (let x = 0; x <= N; x++) for (let y = 0; y <= N; y++) for (let z = 0; z <= N; z++) {
        const c = [x, y, z];
        for (let ax = 0; ax < 3; ax++) {
          if (c[ax] !== 0 && c[ax] !== N) continue;
          if (nzOf(ax, c[ax] ? 1 : -1) <= 0.02) continue;
          const q = cam(c);
          ctx.beginPath(); ctx.arc(ox + q[0] * scale, oy - q[1] * scale, 2, 0, 6.3); ctx.fill();
        }
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
    if (selId >= 0 && ((selT -= dt) <= 0 || G.arrows[selId].state !== 'idle')) selId = -1;
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

  // Double-tap mode: the first tap arms an arrow, a second tap on it within
  // SEL_SECS launches it. Tapping another arrow re-arms; tapping empty space disarms.
  function onTap(id) {
    if (id < 0) { selId = -1; return; }
    if (!settings.doubleTap) return tap(id);
    if (id === selId && selT > 0) { selId = -1; return tap(id); }
    if (over || G.arrows[id].state !== 'idle') { selId = -1; return; }
    selId = id; selT = SEL_SECS;
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
  const ZMIN = 0.5, ZMAX = 4;
  const pointers = new Map();
  let down = null, pinch = null;

  // zoom to `z`, keeping the point under (cx, cy) fixed on screen
  function zoomAt(z, cx, cy) {
    z = Math.max(ZMIN, Math.min(ZMAX, z));
    const k = z / zoom;
    panX = (cx - cw / 2) - (cx - cw / 2 - panX) * k;
    panY = (cy - ch / 2) - (cy - ch / 2 - panY) * k;
    zoom = z;
  }
  const rel = e => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };

  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const [x, y] = rel(e);
    zoomAt(zoom * Math.exp(-e.deltaY * (e.deltaMode ? 0.05 : 0.0015)), x, y);
  }, { passive: false });

  canvas.addEventListener('pointerdown', e => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, rel(e));
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, z: zoom, mx: (a[0] + b[0]) / 2, my: (a[1] + b[1]) / 2 };
      down = null;
    } else if (pointers.size === 1) {
      down = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, drag: false };
    }
  });
  canvas.addEventListener('pointermove', e => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, rel(e));
    if (pinch && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      panX += mx - pinch.mx; panY += my - pinch.my;
      pinch.mx = mx; pinch.my = my;
      zoomAt(pinch.z * Math.hypot(a[0] - b[0], a[1] - b[1]) / pinch.d, mx, my);
      return;
    }
    if (!down) return;
    if (!down.drag && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) down.drag = true;
    if (down.drag) {
      if (mode !== '2d') {
        // pitch wraps freely; when the cube is upside down, flip horizontal drag so it still follows the finger
        yaw += (e.clientX - down.lx) * 0.01 * (Math.cos(pitch) < 0 ? -1 : 1);
        pitch = (pitch + (e.clientY - down.ly) * 0.01) % (2 * Math.PI);
      } else if (zoom > 1) {
        panX += e.clientX - down.lx; panY += e.clientY - down.ly;
      }
    }
    down.lx = e.clientX; down.ly = e.clientY;
  });
  function release(e, canTap) {
    if (canTap && down && !down.drag && G) {
      const [x, y] = rel(e);
      const id = pick(x, y);
      onTap(id);
    }
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    down = null; // fingers left after a pinch don't trigger taps
  }
  canvas.addEventListener('pointerup', e => release(e, true));
  canvas.addEventListener('pointercancel', e => release(e, false));

  function showMenu() {
    const p = store.get();
    $('lv2d').textContent = 'Level ' + p['2d']; $('lv3d').textContent = 'Level ' + p['3d'];
    $('lv3dout').textContent = 'Level ' + p['3dout'];
    $('menu').classList.remove('hide'); $('overlay').classList.add('hide');
  }
  $('play2d').onclick = () => start('2d', store.get()['2d']);
  $('play3d').onclick = () => start('3d', store.get()['3d']);
  $('play3dout').onclick = () => start('3dout', store.get()['3dout']);
  $('back').onclick = showMenu;
  $('restart').onclick = () => start(mode, level);
  $('hint').onclick = hint;
  $('optDouble').checked = settings.doubleTap;
  $('optDouble').onchange = e => {
    settings.doubleTap = e.target.checked; selId = -1;
    try { localStorage.setItem('ae_settings', JSON.stringify(settings)); } catch (err) { }
  };
  window.addEventListener('resize', resize);

  let last = performance.now();
  function frame(t) {
    const dt = Math.min(0.05, (t - last) / 1000); last = t;
    update(dt); render();
    requestAnimationFrame(frame);
  }
  showMenu(); resize();
  requestAnimationFrame(frame);
  window.__game = { start, get G() { return G; }, tap, pick, onTap, get selId() { return selId; }, settings };
})();
