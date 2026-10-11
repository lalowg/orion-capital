/* =========================================================
   ORION CAPITAL — chart.js
   Educational planning model + tweened SVG scenario chart
   with purpose targets and constellation milestones.
   Hypothetical figures only. Not a forecast, not advice.
   ========================================================= */

const SVGNS = 'http://www.w3.org/2000/svg';
const RM = window.matchMedia('(prefers-reduced-motion: reduce)');
export const isReduced = () => RM.matches;

/* ---------- formatting (en-US, USD) ---------- */
const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const N1 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
const N2 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const P2 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
export const round100 = (v) => Math.round(v / 100) * 100;
export const usd = (v) => USD.format(v);
export const usdR = (v) => USD.format(round100(v));
export const pct = (v) => `${P2.format(v)}%`;
export const yearsTxt = (n) => `${n} ${n === 1 ? 'year' : 'years'}`;
export const usdCompact = (v, threshold = 1e7) =>
  Math.abs(v) >= threshold ? `$${N2.format(v / 1e6)}M` : usdR(v);
function usdAxis(v) {
  if (v === 0) return '$0';
  if (v >= 1e6) return `$${N1.format(v / 1e6)}M`;
  if (v >= 1e3) return `$${N1.format(v / 1e3)}k`;
  return USD.format(v);
}

/* ---------- model ----------
   Monthly compounding of an annual hypothetical rate; contributions at month end.
   real = nominal deflated to today's dollars over (offset + t) years. */
export function model(p) {
  const i = Math.pow(1 + p.rate / 100, 1 / 12) - 1;
  const inf = 1 + p.inflation / 100;
  const off = p.offset || 0;
  return (t) => {
    const m = t * 12;
    const contrib = p.initial + p.monthly * m;
    let nominal = contrib;
    if (i > 1e-12) {
      const g = Math.pow(1 + i, m);
      nominal = p.initial * g + (p.monthly * (g - 1)) / i;
    }
    return { contrib, nominal, real: nominal / Math.pow(inf, off + t) };
  };
}

/** First moment (years, monthly resolution) where accumulated growth >= contributions. */
export function crossover(p) {
  if (p.rate <= 0 || p.initial + p.monthly <= 0) return null;
  const at = model(p);
  for (let m = 1; m <= p.years * 12; m++) {
    const v = at(m / 12);
    if (v.nominal - v.contrib >= v.contrib) return m / 12;
  }
  return null;
}

/** First moment where the value in today's dollars reaches the purpose target. */
export function goalReached(p) {
  if (!(p.goal > 0)) return null;
  const at = model(p);
  if (at(0).real >= p.goal) return 0;
  for (let m = 1; m <= p.years * 12; m++) {
    if (at(m / 12).real >= p.goal) return m / 12;
  }
  return null;
}

function nice(max, count = 4) {
  if (!(max > 0)) return { top: 1000, step: 250 };
  const raw = max / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  let step = mag * 10;
  for (const m of [1, 2, 2.5, 5, 10]) { if (m * mag >= raw) { step = m * mag; break; } }
  return { top: Math.ceil(max / step) * step, step };
}

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function el(tag, attrs, parent) {
  const n = document.createElementNS(SVGNS, tag);
  if (attrs) for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(n);
  return n;
}

/** Four-point star path centred on (x, y). */
function starPath(x, y, r) {
  const k = r * 0.28;
  return `M${x} ${y - r}C${x + k * 0.3} ${y - k} ${x + k} ${y - k * 0.3} ${x + r} ${y}C${x + k} ${y + k * 0.3} ${x + k * 0.3} ${y + k} ${x} ${y + r}C${x - k * 0.3} ${y + k} ${x - k} ${y + k * 0.3} ${x - r} ${y}C${x - k} ${y - k * 0.3} ${x - k * 0.3} ${y - k} ${x} ${y - r}Z`;
}

const KEYS = ['c', 'r', 'n']; // contributed, today's dollars, projected

/* =========================================================
   ScenarioChart
   ========================================================= */
let uidCounter = 0;

export class ScenarioChart {
  constructor(root, opts = {}) {
    this.root = root;
    this.svg = root.querySelector('svg');
    this.tip = root.querySelector('.chart__tip');
    this.o = Object.assign({ N: 160, annotate: false, labels: true, onCursor: null }, opts);
    this.N = this.o.N;
    this.uid = `orc${++uidCounter}`;
    this.scen = { a: null, b: null };
    this.models = { a: null, b: null };
    this.disp = { a: null, b: null };
    this.show = { real: true, goal: true };
    this.cursor = null;
    this.hover = false;
    this.raf = 0;
    this.w = 0; this.h = 0;
    this._build();
    this._measure();
    if ('ResizeObserver' in window) {
      this.ro = new ResizeObserver(() => { if (this._measure() && this.scen.a) this._relayout(); });
      this.ro.observe(this.root);
    }
    this._bind();
  }

  _build() {
    const s = this.svg;
    const defs = el('defs', null, s);
    const pat = el('pattern', { id: `${this.uid}-h`, width: 7, height: 7, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, defs);
    el('line', { x1: 0, y1: 0, x2: 0, y2: 7, class: 'hatch-line' }, pat);
    const gr = el('linearGradient', { id: `${this.uid}-g`, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    el('stop', { offset: '0%', class: 'grad-a' }, gr);
    el('stop', { offset: '100%', class: 'grad-b' }, gr);

    this.gGrid = el('g', { class: 'c-grid' }, s);
    this.gGoal = el('g', { class: 'c-goal' }, s);
    this.series = {};
    for (const k of ['b', 'a']) {
      const g = el('g', { class: `c-series c-series--${k}` }, s);
      const o = { g };
      if (k === 'a') {
        o.areaC = el('path', { class: 'c-area-contrib', fill: `url(#${this.uid}-h)` }, g);
        o.areaI = el('path', { class: 'c-area-interest', fill: `url(#${this.uid}-g)` }, g);
      }
      o.c = el('path', { class: 'c-line c-line--contrib' }, g);
      o.r = el('path', { class: 'c-line c-line--real' }, g);
      o.n = el('path', { class: 'c-line c-line--nominal' }, g);
      this.series[k] = o;
    }
    this.gAnn = el('g', { class: 'c-annot' }, s);
    this.gLab = el('g', { class: 'c-labels' }, s);
    this.gCur = el('g', { class: 'c-cursor' }, s);
    this.cLine = el('line', { class: 'c-cursor__line' }, this.gCur);
    this.dots = {};
    for (const k of ['b', 'a']) {
      this.dots[k] = {};
      for (const s2 of KEYS) {
        if (k === 'b' && s2 === 'c') continue;
        this.dots[k][s2] = el('circle', { r: 4, class: `c-dot c-dot--${s2}${s2 === 'r' ? ' c-dot--real' : ''}${k === 'b' ? ' c-dot--b' : ''}` }, this.gCur);
      }
    }
  }

  _measure() {
    const r = this.svg.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width));
    const h = Math.max(1, Math.round(r.height));
    if (w === this.w && h === this.h) return false;
    this.w = w; this.h = h;
    this.svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    this.compact = w < 560;
    return true;
  }

  /* ---------- public API ---------- */
  set({ a, b, show }, { animate = true, duration = 700 } = {}) {
    if (a) this.scen.a = a;
    if (b !== undefined) this.scen.b = b && b.visible !== false ? b : null;
    if (show) Object.assign(this.show, show);
    this.models.a = model(this.scen.a);
    this.models.b = this.scen.b ? model(this.scen.b) : null;
    this.svg.classList.toggle('hide-real', !this.show.real);
    this.svg.classList.toggle('hide-b', !this.scen.b);

    this._scales();
    this._axes();
    this._goal();
    const to = this._targets();
    const from = {};
    for (const k of ['a', 'b']) {
      if (!to[k]) continue;
      if (this.disp[k]) from[k] = this._clone(this.disp[k]);
      else if (k === 'b' && this.disp.a) from[k] = this._clone(this.disp.a);
      else from[k] = this._collapsed(to[k]);
    }
    if (!to.b) this.disp.b = null;

    cancelAnimationFrame(this.raf);
    this.animating = false;
    this.root.classList.remove('is-settled');
    this.gAnn.textContent = '';
    if (!animate || isReduced()) {
      this.disp.a = to.a; this.disp.b = to.b || null;
      this._render();
      this._settle();
      return;
    }
    this._anim = { from, to, start: performance.now(), duration };
    this.animating = true;
    const step = (now) => {
      const A = this._anim;
      const p = Math.min(1, (now - A.start) / A.duration);
      const e = ease(p);
      for (const k of ['a', 'b']) if (A.to[k]) this.disp[k] = this._lerp(A.from[k], A.to[k], e);
      this._render();
      if (p < 1) this.raf = requestAnimationFrame(step);
      else { this.animating = false; this._settle(); }
    };
    this.raf = requestAnimationFrame(step);
  }

  setCursor(year) {
    if (year == null) { this.cursor = null; this._cursor(); return; }
    this.cursor = Math.max(0, Math.min(this.T, Math.round(year)));
    this._cursor();
    if (this.o.onCursor) this.o.onCursor(this.cursor, this.valuesAt(this.cursor));
  }

  valuesAt(year) {
    const out = {};
    for (const k of ['a', 'b']) {
      const sc = this.scen[k];
      if (!sc) continue;
      const off = sc.offset || 0;
      const t = year - off;
      const state = t < 0 ? 'before' : t > sc.years ? 'after' : 'during';
      const v = this.models[k](Math.max(0, Math.min(sc.years, t)));
      out[k] = { ...v, state };
    }
    return out;
  }

  /* ---------- geometry ---------- */
  _scales() {
    const w = this.w, h = this.h;
    const labels = this.o.labels && !this.compact;
    this.pad = { t: 30, r: labels ? 124 : 10, b: 30, l: 2 };
    let T = 0, ymax = 0;
    for (const k of ['a', 'b']) {
      const sc = this.scen[k];
      if (!sc) continue;
      T = Math.max(T, (sc.offset || 0) + sc.years);
      const end = this.models[k](sc.years);
      ymax = Math.max(ymax, end.nominal, end.contrib);
    }
    const g = this.scen.a.goal;
    this.goalOn = this.show.goal && this.show.real && g > 0;
    this.goalOff = false;
    if (this.goalOn) {
      if (g <= ymax * 2.6 || ymax <= 0) ymax = Math.max(ymax, g * 1.06);
      else this.goalOff = true;
    }
    this.T = Math.max(1, T);
    const n = nice(ymax * 1.04, h < 260 ? 3 : 4);
    this.yTop = n.top; this.yStep = n.step;
    this.pr = w - this.pad.r;
    this.sx = (t) => this.pad.l + (t / this.T) * (this.pr - this.pad.l);
    this.sy = (v) => h - this.pad.b - (v / this.yTop) * (h - this.pad.t - this.pad.b);
    this.ix = (x) => ((x - this.pad.l) / (this.pr - this.pad.l)) * this.T;
  }

  _targets() {
    const out = {};
    for (const k of ['a', 'b']) {
      const sc = this.scen[k];
      if (!sc) continue;
      const N = this.N, at = this.models[k], off = sc.offset || 0;
      const d = { x: new Float64Array(N + 1), c: new Float64Array(N + 1), r: new Float64Array(N + 1), n: new Float64Array(N + 1) };
      for (let i = 0; i <= N; i++) {
        const t = (sc.years * i) / N;
        const v = at(t);
        d.x[i] = this.sx(off + t);
        d.c[i] = this.sy(v.contrib);
        d.n[i] = this.sy(v.nominal);
        // hidden "today's dollars" rests on the projected curve, so revealing it reads as inflation pulling it down
        d.r[i] = this.show.real ? this.sy(v.real) : d.n[i];
      }
      out[k] = d;
    }
    return out;
  }

  _collapsed(d) {
    const base = this.h - this.pad.b;
    const c = this._clone(d);
    c.c.fill(base); c.r.fill(base); c.n.fill(base);
    return c;
  }
  _clone(d) { return { x: d.x.slice(), c: d.c.slice(), r: d.r.slice(), n: d.n.slice() }; }
  _lerp(a, b, e) {
    const N = b.x.length, o = { x: new Float64Array(N), c: new Float64Array(N), r: new Float64Array(N), n: new Float64Array(N) };
    for (const key of ['x', 'c', 'r', 'n']) {
      const A = a[key], B = b[key], O = o[key];
      for (let i = 0; i < N; i++) O[i] = A[i] + (B[i] - A[i]) * e;
    }
    return o;
  }

  _relayout() {
    this._scales();
    this._axes(false);
    this._goal();
    const to = this._targets();
    if (this.animating && this._anim) { this._anim.to = to; return; }
    cancelAnimationFrame(this.raf);
    this.disp.a = to.a; this.disp.b = to.b || null;
    this._render();
    this._settle();
  }

  /* ---------- drawing ---------- */
  _axes(fresh = true) {
    const g = this.gGrid;
    g.textContent = '';
    const { w, h, pad } = this;
    const cls = fresh ? 'c-tick c-fresh' : 'c-tick';
    for (let v = 0; v <= this.yTop + 1e-6; v += this.yStep) {
      const y = Math.round(this.sy(v)) + 0.5;
      el('line', { x1: 0, x2: w, y1: y, y2: y, class: v === 0 ? 'c-base' : '' }, g);
      if (v > 0) {
        const t = el('text', { x: pad.l, y: y - 7, class: cls }, g);
        t.textContent = usdAxis(v);
      }
    }
    const T = this.T;
    let step = T <= 8 ? 1 : T <= 16 ? 2 : T <= 40 ? 5 : 10;
    if (this.compact && T > 20) step = 10;
    const ticks = [];
    for (let y = 0; y <= T; y += step) ticks.push(y);
    if (ticks[ticks.length - 1] !== T) {
      if (T - ticks[ticks.length - 1] < step * 0.6) ticks.pop();
      ticks.push(T);
    }
    ticks.forEach((yr, i) => {
      const x = this.sx(yr);
      const last = i === ticks.length - 1;
      const t = el('text', { x, y: h - pad.b + 20, class: cls, 'text-anchor': i === 0 ? 'start' : last ? 'end' : 'middle' }, g);
      t.textContent = last ? `Year ${yr}` : String(yr);
    });
  }

  _goal() {
    const g = this.gGoal;
    g.textContent = '';
    if (!this.goalOn) return;
    const goal = this.scen.a.goal;
    const x0 = this.pad.l, x1 = this.pr;
    if (this.goalOff) {
      const t = el('text', { x: x1 - 4, y: this.pad.t - 12, 'text-anchor': 'end', class: 'c-goal__lab' }, g);
      t.textContent = `Purpose target ${usdCompact(goal, 1e6)} · above this chart`;
      return;
    }
    const y = Math.round(this.sy(goal)) + 0.5;
    el('line', { x1: x0, x2: x1, y1: y, y2: y, class: 'c-goal__line' }, g);
    const t = el('text', { x: x0 + 4, y: y - 8, class: 'c-goal__lab' }, g);
    t.textContent = `Purpose target · ${usdCompact(goal, 1e6)} in today's dollars`;
  }

  _path(xs, ys) {
    let d = `M${xs[0].toFixed(1)} ${ys[0].toFixed(1)}`;
    for (let i = 1; i < xs.length; i++) d += `L${xs[i].toFixed(1)} ${ys[i].toFixed(1)}`;
    return d;
  }

  _render() {
    const base = (this.h - this.pad.b).toFixed(1);
    for (const k of ['a', 'b']) {
      const d = this.disp[k], s = this.series[k];
      if (!d) {
        s.c.setAttribute('d', ''); s.r.setAttribute('d', ''); s.n.setAttribute('d', '');
        if (s.areaC) { s.areaC.setAttribute('d', ''); s.areaI.setAttribute('d', ''); }
        continue;
      }
      const lc = this._path(d.x, d.c), ln = this._path(d.x, d.n);
      s.c.setAttribute('d', lc);
      s.n.setAttribute('d', ln);
      s.r.setAttribute('d', this._path(d.x, d.r));
      if (s.areaC) {
        const N = d.x.length - 1;
        const x0 = d.x[0].toFixed(1), xN = d.x[N].toFixed(1);
        s.areaC.setAttribute('d', `${lc}L${xN} ${base}L${x0} ${base}Z`);
        let back = '';
        for (let i = N; i >= 0; i--) back += `L${d.x[i].toFixed(1)} ${d.c[i].toFixed(1)}`;
        s.areaI.setAttribute('d', `${ln}${back}Z`);
      }
    }
    this._labels();
    this._cursor();
  }

  _labels() {
    const g = this.gLab;
    g.textContent = '';
    if (!this.o.labels || this.compact) return;
    const N = this.N, items = [];
    const add = (k, key, cap) => {
      const d = this.disp[k], sc = this.scen[k];
      if (!d || !sc) return;
      const end = this.models[k](sc.years);
      const val = key === 'n' ? end.nominal : key === 'r' ? end.real : end.contrib;
      items.push({ k, key, cap, x: d.x[N], y: d[key][N], val });
    };
    add('a', 'n', 'Projected');
    if (this.show.real) add('a', 'r', "Today's dollars");
    add('a', 'c', 'Contributed');
    if (this.scen.b) {
      add('b', 'n', 'B · projected');
      if (this.show.real) add('b', 'r', "B · today's $");
    }
    items.sort((p, q) => p.y - q.y);
    const gap = 32, top = this.pad.t + 6, bottom = this.h - this.pad.b - 14;
    let prev = -Infinity;
    for (const it of items) { it.ly = Math.max(it.y, prev + gap, top); prev = it.ly; }
    for (let i = items.length - 1; i >= 0; i--) {
      const limit = i === items.length - 1 ? bottom : items[i + 1].ly - gap;
      if (items[i].ly > limit) items[i].ly = limit;
    }
    const lx = this.pr + 14;
    for (const it of items) {
      const lg = el('g', { class: `c-lab c-lab--${it.key}${it.k === 'b' ? ' c-lab--b' : ''}${it.key === 'r' ? ' c-dot--real' : ''}` }, g);
      if (it.x < this.pr - 2 || Math.abs(it.ly - it.y) > 3) {
        el('path', { class: 'c-leader', d: `M${(it.x + 4).toFixed(1)} ${it.y.toFixed(1)}L${(lx - 4).toFixed(1)} ${it.ly.toFixed(1)}` }, lg);
      }
      const v = el('text', { x: lx, y: (it.ly + 2).toFixed(1), class: 'c-lab__val' }, lg);
      v.textContent = usdCompact(it.val);
      const c = el('text', { x: lx, y: (it.ly + 15).toFixed(1), class: 'c-lab__cap' }, lg);
      c.textContent = it.cap;
    }
  }

  _settle() {
    this.root.classList.add('is-settled');
    this._annotate();
  }

  /* Constellation milestones: start → growth overtakes contributions → purpose reached → horizon */
  _annotate() {
    const g = this.gAnn;
    g.textContent = '';
    if (!this.o.annotate || !this.scen.a) return;
    const sc = this.scen.a, at = this.models.a, off = sc.offset || 0;
    const pts = [];
    const v0 = at(0);
    pts.push({ x: this.sx(off), y: this.sy(v0.nominal), r: 4, kind: 'start' });
    const c = crossover(sc);
    if (c != null) {
      const v = at(c);
      pts.push({ x: this.sx(off + c), y: this.sy(v.nominal), r: 7, kind: 'cross', t: c });
    }
    const gr = this.goalOn && !this.goalOff ? goalReached(sc) : null;
    if (gr != null && gr > 0) {
      const v = at(gr);
      pts.push({ x: this.sx(off + gr), y: this.sy(v.real), r: 9, kind: 'goal', t: gr });
    }
    const vE = at(sc.years);
    pts.push({ x: this.sx(off + sc.years), y: this.sy(vE.nominal), r: 5, kind: 'end' });
    pts.sort((p, q) => p.x - q.x);

    const lines = el('g', { class: 'c-const__lines' }, g);
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i - 1], q = pts[i];
      el('line', { x1: p.x.toFixed(1), y1: (p.y - 16).toFixed(1), x2: q.x.toFixed(1), y2: (q.y - 16).toFixed(1), style: `--i:${i}` }, lines);
    }
    pts.forEach((p, i) => {
      const s = el('g', { class: `c-star c-star--${p.kind}`, style: `--i:${i}` }, g);
      el('line', { x1: p.x.toFixed(1), x2: p.x.toFixed(1), y1: p.y.toFixed(1), y2: (p.y - 16 + p.r).toFixed(1), class: 'c-star__stem' }, s);
      el('path', { d: starPath(+p.x.toFixed(1), +(p.y - 16).toFixed(1), p.r) }, s);
    });

    const label = (p, l1, l2) => {
      const leftSide = p.x > this.w * 0.5;
      const tx = leftSide ? p.x - 14 : p.x + 14;
      const anchor = leftSide ? 'end' : 'start';
      const ty = Math.max(this.pad.t + 12, p.y - 34);
      const t1 = el('text', { x: tx.toFixed(1), y: ty.toFixed(1), 'text-anchor': anchor, class: 'c-annot__t1' }, g);
      t1.textContent = l1;
      const t2 = el('text', { x: tx.toFixed(1), y: (ty + 15).toFixed(1), 'text-anchor': anchor, class: 'c-annot__t2' }, g);
      t2.textContent = l2;
    };
    const cross = pts.find((p) => p.kind === 'cross');
    const goal = pts.find((p) => p.kind === 'goal');
    if (goal) label(goal, `Year ${Math.ceil(goal.t)}`, this.compact ? 'purpose reached' : "purpose reached, in today's dollars");
    if (cross && (!goal || Math.abs(goal.x - cross.x) > 150 || this.compact === false && Math.abs(goal.y - cross.y) > 46)) {
      label(cross, `Year ${Math.ceil(cross.t)}`, this.compact ? 'growth overtakes savings' : 'growth overtakes what you put in');
    }
  }

  _interp(arr, idx) {
    const i0 = Math.floor(idx), i1 = Math.min(arr.length - 1, i0 + 1), f = idx - i0;
    return arr[i0] + (arr[i1] - arr[i0]) * f;
  }

  _cursor() {
    const on = this.cursor != null && this.scen.a;
    this.gCur.classList.toggle('is-on', !!on);
    if (this.tip) this.tip.classList.toggle('is-on', !!on);
    if (!on) return;
    const year = this.cursor;
    const x = this.sx(year);
    this.cLine.setAttribute('x1', x); this.cLine.setAttribute('x2', x);
    this.cLine.setAttribute('y1', this.pad.t - 8); this.cLine.setAttribute('y2', this.h - this.pad.b);
    for (const k of ['a', 'b']) {
      const d = this.disp[k], sc = this.scen[k];
      for (const key in this.dots[k]) {
        const dot = this.dots[k][key];
        if (!d || !sc) { dot.setAttribute('visibility', 'hidden'); continue; }
        const idx = ((year - (sc.offset || 0)) / sc.years) * this.N;
        if (idx < -1e-6 || idx > this.N + 1e-6) { dot.setAttribute('visibility', 'hidden'); continue; }
        dot.setAttribute('visibility', 'visible');
        dot.setAttribute('cx', this._interp(d.x, Math.max(0, Math.min(this.N, idx))).toFixed(1));
        dot.setAttribute('cy', this._interp(d[key], Math.max(0, Math.min(this.N, idx))).toFixed(1));
      }
    }
    this._tip(year, x);
  }

  _tip(year, x) {
    if (!this.tip) return;
    const vals = this.valuesAt(year);
    const row = (label, v, cls = '') => `<div class="tip__row ${cls}"><span>${label}</span><span>${usdR(v)}</span></div>`;
    let html = `<p class="tip__year">Year ${year}</p>`;
    const a = vals.a;
    if (a) {
      html += row('Projected', a.nominal, 'tip__row--n');
      if (this.show.real) html += row("Today's dollars", a.real, 'tip__row--r');
      html += row('Contributed', a.contrib, 'tip__row--c');
    }
    const b = vals.b;
    if (b) {
      html += `<div class="tip__b"><p class="tip__b-title">Scenario B${b.state === 'before' ? ' · not started yet' : b.state === 'after' ? ' · finished' : ''}</p>`;
      if (b.state !== 'before') {
        html += row('Projected', b.nominal);
        if (this.show.real) html += row("Today's dollars", b.real);
      }
      html += '</div>';
    }
    this.tip.innerHTML = html;
    const tw = this.tip.offsetWidth, gap = 14;
    let left = x + gap;
    if (left + tw > this.w - 2) left = x - gap - tw;
    left = Math.max(0, left);
    this.tip.style.transform = `translate(${Math.round(left)}px, ${Math.round(this.pad.t - 6)}px)`;
  }

  /* ---------- input ---------- */
  _bind() {
    const r = this.root;
    const fromEvent = (e) => {
      const rect = this.svg.getBoundingClientRect();
      return this.ix(e.clientX - rect.left);
    };
    r.addEventListener('pointermove', (e) => {
      if (!this.scen.a) return;
      if (e.pointerType === 'mouse' || e.buttons || e.pointerType === 'pen') { this.hover = true; this.setCursor(fromEvent(e)); }
    });
    r.addEventListener('pointerdown', (e) => { if (this.scen.a) { this.hover = true; this.setCursor(fromEvent(e)); } });
    r.addEventListener('pointerleave', (e) => {
      if (e.pointerType !== 'mouse') return;
      this.hover = false;
      if (document.activeElement !== r) this.setCursor(null);
    });
    r.addEventListener('focus', () => { if (this.cursor == null && this.scen.a) this.setCursor(this.T); });
    r.addEventListener('blur', () => { if (!this.hover) this.setCursor(null); });
    r.addEventListener('keydown', (e) => {
      if (!this.scen.a) return;
      const cur = this.cursor == null ? this.T : this.cursor;
      let next = null;
      switch (e.key) {
        case 'ArrowLeft': case 'ArrowDown': next = cur - 1; break;
        case 'ArrowRight': case 'ArrowUp': next = cur + 1; break;
        case 'PageDown': next = cur - 5; break;
        case 'PageUp': next = cur + 5; break;
        case 'Home': next = 0; break;
        case 'End': next = this.T; break;
        case 'Escape': this.setCursor(null); return;
        default: return;
      }
      e.preventDefault();
      this.setCursor(next);
    });
  }
}
