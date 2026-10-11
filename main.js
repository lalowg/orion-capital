/* =========================================================
   ORION CAPITAL — main.js
   Planner, story chart, purpose atlas, motion, navigation, form.
   ========================================================= */
import { ScenarioChart, model, crossover, goalReached, usd, usdR, usdCompact, pct, yearsTxt, isReduced } from './chart.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const mqMobile = window.matchMedia('(max-width: 719px)');
const NS = 'http://www.w3.org/2000/svg';

function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function svgEl(tag, attrs, parent) {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(n);
  return n;
}

/* ---------- header height → CSS var ---------- */
const header = $('[data-header]');
function syncHeader() {
  if (header) document.documentElement.style.setProperty('--header-h', `${Math.round(header.getBoundingClientRect().height)}px`);
}
syncHeader();
if (header && 'ResizeObserver' in window) new ResizeObserver(syncHeader).observe(header);

/* =========================================================
   Purposes (illustrative examples)
   ========================================================= */
const PURPOSES = {
  independence: {
    no: '01', name: 'Independence', goal: 900000, years: 25,
    line: 'The freedom to work because you choose to, not because you must. Usually the largest purpose, with the longest horizon.',
    qs: ['What would a year of ordinary life cost, in today\'s dollars?', 'From which date would you like that choice to begin?', 'What other income might arrive by then?'],
  },
  education: {
    no: '02', name: 'Education', goal: 150000, years: 18,
    line: 'A fund for someone else\'s future: tuition, books and somewhere to live, on a date that will not move.',
    qs: ['How old is the student today?', 'Which costs should the fund cover, and which should it not?', 'Who else may contribute along the way?'],
  },
  home: {
    no: '03', name: 'A home', goal: 120000, years: 8,
    line: 'A deposit, and a cushion behind it. A shorter horizon, where caution matters more than growth.',
    qs: ['What deposit would the home you have in mind require today?', 'How large a cushion would let you sleep well after the move?', 'How firm is the date?'],
  },
  legacy: {
    no: '04', name: 'Legacy', goal: 500000, years: 30,
    line: 'Giving that outlives you, to people or to causes. Planned alongside independence, never instead of it.',
    qs: ['Who or what would you like to support?', 'Would you rather give during your lifetime, after it, or both?', 'Which of your other purposes must come first?'],
  },
};

/* =========================================================
   1 · PLANNER
   ========================================================= */
const DEFAULT_A = { initial: 20000, monthly: 600, years: 18, rate: 5, inflation: 2.5, goal: 150000 };
const DEFAULT_PURPOSE = 'education';
const FIELD_FMT = {
  initial: (v) => usd(v),
  monthly: (v) => usd(v),
  years: (v) => yearsTxt(v),
  rate: (v) => pct(v),
  inflation: (v) => pct(v),
  goal: (v) => (v > 0 ? usd(v) : 'No target'),
};
const FIELD_TEXT = {
  initial: (v) => `${usd(v)} starting amount`,
  monthly: (v) => `${usd(v)} a month`,
  years: (v) => `horizon of ${yearsTxt(v)}`,
  rate: (v) => `hypothetical return of ${pct(v)} a year`,
  inflation: (v) => `assumed inflation of ${pct(v)} a year`,
  goal: (v) => (v > 0 ? `purpose target of ${usd(v)} in today's dollars` : 'no purpose target'),
};
const PRESETS = {
  later: (a) => ({ ...a, years: Math.max(1, a.years - 5), offset: 5 }),
  more: (a) => ({ ...a, monthly: Math.min(5000, a.monthly + 250) }),
  rate: (a) => ({ ...a, rate: Math.max(0, a.rate - 2) }),
  inflation: (a) => ({ ...a, inflation: 4 }),
};
const PRESET_TEXT = {
  later: 'starting five years later and stopping on the same date',
  more: 'adding $250 a month',
  rate: 'with a return two points lower',
  inflation: 'with inflation at 4%',
};

let planner = null;

function initPlanner() {
  const root = $('[data-chart="main"]');
  if (!root) return;
  const controls = $('[data-controls]');
  const panel = $('[data-chart-panel]');
  const inputs = $$('[data-field]', controls);
  const reading = $('[data-reading]');
  const cursorLive = $('[data-cursor-live]');
  const tableWrap = $('[data-table]');
  const compareBtn = $('[data-compare]');
  const editBtns = $$('[data-edit-btn]');
  const presetBtns = $$('[data-preset]');
  const purposeRadios = $$('input[name="purpose"]', controls);
  const purposeNote = $('[data-purpose-note]');
  const purposeRead = $('[data-purpose-read]');
  const purposeSub = $('[data-purpose-sub]');

  const state = { a: { ...DEFAULT_A }, b: null, compare: false, edit: 'a', preset: null, purpose: DEFAULT_PURPOSE };

  let liveTimer = 0;
  const chart = new ScenarioChart(root, {
    annotate: true,
    labels: true,
    onCursor: (year, v) => {
      clearTimeout(liveTimer);
      liveTimer = setTimeout(() => {
        let txt = `Year ${year}. Scenario A: projected ${usdR(v.a.nominal)}, ${usdR(v.a.real)} in today's dollars, ${usdR(v.a.contrib)} contributed.`;
        if (v.b && v.b.state !== 'before') txt += ` Scenario B: projected ${usdR(v.b.nominal)}, ${usdR(v.b.real)} in today's dollars.`;
        cursorLive.textContent = txt;
      }, 250);
    },
  });

  const fill = (input) => {
    const min = +input.min, max = +input.max;
    input.style.setProperty('--p', `${((+input.value - min) / (max - min)) * 100}%`);
  };

  function syncInputs() {
    const p = state[state.edit];
    for (const input of inputs) {
      const key = input.dataset.field;
      input.value = p[key];
      fill(input);
      $(`[data-out-field="${key}"]`, controls).textContent = FIELD_FMT[key](p[key]);
      input.setAttribute('aria-valuetext', FIELD_TEXT[key](p[key]));
    }
    controls.dataset.edit = state.edit;
    editBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.editBtn === state.edit)));
    compareBtn.setAttribute('aria-pressed', String(state.compare));
    panel.classList.toggle('is-compare', state.compare);
    presetBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.preset === state.preset && state.compare)));
    purposeRadios.forEach((r) => { r.checked = r.value === state.purpose; });
  }

  /* readouts with counting tween */
  const readEls = {};
  for (const key of ['contrib', 'nominal', 'real']) {
    readEls[key] = { val: $(`[data-readout="${key}"]`, panel), b: $(`[data-readout-b="${key}"]`, panel), cur: 0 };
  }
  const fmtRead = (v) => usdCompact(v, mqMobile.matches ? 1e6 : 1e7);
  let countRaf = 0;
  function setReadouts(endA, endB, animate) {
    const target = { contrib: endA.contrib, nominal: endA.nominal, real: endA.real };
    const targetB = endB ? { contrib: endB.contrib, nominal: endB.nominal, real: endB.real } : null;
    for (const key in readEls) readEls[key].b.textContent = targetB ? `B · ${fmtRead(targetB[key])}` : '';
    cancelAnimationFrame(countRaf);
    const from = {};
    for (const key in readEls) from[key] = readEls[key].cur;
    const done = () => { for (const key in readEls) { readEls[key].cur = target[key]; readEls[key].val.textContent = fmtRead(target[key]); } };
    if (!animate || isReduced()) { done(); return; }
    const t0 = performance.now(), dur = 700;
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      for (const key in readEls) {
        const v = from[key] + (target[key] - from[key]) * e;
        readEls[key].cur = v;
        readEls[key].val.textContent = fmtRead(v);
      }
      if (p < 1) countRaf = requestAnimationFrame(tick); else done();
    };
    countRaf = requestAnimationFrame(tick);
  }

  function goalText(p) {
    if (!(p.goal > 0)) return null;
    const t = goalReached(p);
    if (t != null) return { reached: true, year: Math.max(1, Math.ceil(t)) };
    return { reached: false, gap: p.goal - model(p)(p.years).real };
  }

  function setPurposeRead() {
    const ga = goalText(state.a);
    if (!ga) {
      purposeRead.textContent = 'No target';
      purposeSub.textContent = 'Choose a purpose to set one';
      panel.dataset.goal = 'none';
      return;
    }
    if (ga.reached) {
      purposeRead.textContent = `Year ${ga.year}`;
      purposeSub.textContent = 'target reached, in today\'s dollars';
      panel.dataset.goal = 'reached';
    } else {
      purposeRead.textContent = `${fmtRead(ga.gap)} short`;
      purposeSub.textContent = `at year ${state.a.years}, in today's dollars`;
      panel.dataset.goal = 'short';
    }
    if (state.compare && state.b) {
      const gb = goalText({ ...state.b, goal: state.a.goal });
      if (gb) purposeSub.textContent = gb.reached ? `B · year ${gb.year + (state.b.offset || 0)}` : `B · ${fmtRead(gb.gap)} short`;
    }
  }

  function sentence(p, end) {
    let lead;
    if (p.initial === 0 && p.monthly === 0) return 'With nothing put in there is nothing to grow. Move the starting amount or the monthly contribution to begin.';
    if (p.initial === 0) lead = `Starting from nothing and adding ${usd(p.monthly)} a month`;
    else if (p.monthly === 0) lead = `With ${usd(p.initial)} to start and no monthly contributions`;
    else lead = `With ${usd(p.initial)} to start and ${usd(p.monthly)} a month`;
    let s = `${lead} for ${yearsTxt(p.years)}, at a hypothetical ${pct(p.rate)} a year, the projected value would be about ${usdR(end.nominal)}: roughly ${usdR(end.real)} in today's dollars if inflation averaged ${pct(p.inflation)}.`;
    const c = crossover(p);
    if (c != null) s += ` From year ${Math.ceil(c)}, growth would overtake the money put in.`;
    else if (p.rate > 0) s += ' Within this horizon, growth would not yet overtake the money put in.';
    const g = goalText(p);
    const name = state.purpose !== 'none' && PURPOSES[state.purpose] ? `${PURPOSES[state.purpose].name} target` : 'purpose target';
    if (g) s += g.reached ? ` The ${name} of ${usd(p.goal)} in today's dollars would be reached in year ${g.year}.` : ` The ${name} of ${usd(p.goal)} in today's dollars would remain about ${usdR(g.gap)} short.`;
    return s;
  }

  let readingTimer = 0;
  function updateText(endA, endB) {
    clearTimeout(readingTimer);
    readingTimer = setTimeout(() => {
      let s = sentence(state.a, endA);
      if (endB) {
        const diff = endB.real - endA.real;
        const how = state.preset ? PRESET_TEXT[state.preset] : 'with its own assumptions';
        s += ` Scenario B, ${how}, would end near ${usdR(endB.real)} in today's dollars: ${usdR(Math.abs(diff))} ${diff >= 0 ? 'more' : 'less'} than A.`;
      }
      reading.textContent = s;
    }, 380);
  }

  function renderTable() {
    const rows = [];
    const showB = state.compare && state.b;
    const T = Math.max(state.a.years, showB ? (state.b.offset || 0) + state.b.years : 0);
    for (let y = 0; y <= T; y += 5) rows.push(y);
    if (rows[rows.length - 1] !== T) rows.push(T);
    const ma = model(state.a), mb = showB ? model(state.b) : null;
    const cell = (v) => `<td>${usdR(v)}</td>`;
    let html = `<table><caption>Hypothetical values at the end of each year${mb ? ', scenarios A and B' : ''}</caption><thead><tr><th scope="col">Year</th><th scope="col">Contributed A</th><th scope="col">Projected A</th><th scope="col">Today's $ A</th>`;
    if (mb) html += '<th scope="col">Projected B</th><th scope="col">Today\'s $ B</th>';
    html += '</tr></thead><tbody>';
    for (const y of rows) {
      html += `<tr><th scope="row">${y}</th>`;
      html += y <= state.a.years ? (() => { const v = ma(y); return cell(v.contrib) + cell(v.nominal) + cell(v.real); })() : '<td>—</td><td>—</td><td>—</td>';
      if (mb) {
        const off = state.b.offset || 0;
        const t = y - off;
        if (t >= 0 && t <= state.b.years) { const v = mb(t); html += cell(v.nominal) + cell(v.real); } else html += '<td>—</td><td>—</td>';
      }
      html += '</tr>';
    }
    html += '</tbody></table>';
    tableWrap.innerHTML = html;
  }

  let pending = 0;
  function update({ animate = true, duration = 520 } = {}) {
    if (state.b) state.b.goal = state.a.goal;
    const endA = model(state.a)(state.a.years);
    const showB = state.compare && state.b;
    const endB = showB ? model(state.b)(state.b.years) : null;
    chart.set({ a: { ...state.a }, b: showB ? { ...state.b } : null, show: { real: true, goal: true } }, { animate, duration });
    if (chart.cursor != null) chart.setCursor(Math.min(chart.cursor, chart.T));
    setReadouts(endA, endB, animate);
    setPurposeRead();
    updateText(endA, endB);
    renderTable();
  }
  const scheduleUpdate = () => {
    cancelAnimationFrame(pending);
    pending = requestAnimationFrame(() => update({ animate: true, duration: 420 }));
  };

  for (const input of inputs) {
    input.addEventListener('input', () => {
      const key = input.dataset.field;
      const v = +input.value;
      if (key === 'goal') {
        state.a.goal = v;
        if (state.b) state.b.goal = v;
        if (v === 0) state.purpose = 'none';
        purposeRadios.forEach((r) => { r.checked = r.value === state.purpose; });
      } else {
        state[state.edit][key] = v;
        if (state.edit === 'b') state.preset = null;
        else if (state.preset && state.b) state.b = PRESETS[state.preset](state.a);
      }
      fill(input);
      $(`[data-out-field="${key}"]`, controls).textContent = FIELD_FMT[key](v);
      input.setAttribute('aria-valuetext', FIELD_TEXT[key](v));
      presetBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.preset === state.preset && state.compare)));
      scheduleUpdate();
    });
  }

  const ensureB = () => { if (!state.b) { state.preset = 'later'; state.b = PRESETS.later(state.a); } };

  editBtns.forEach((btn) => btn.addEventListener('click', () => {
    const k = btn.dataset.editBtn;
    if (k === 'b') { ensureB(); state.compare = true; }
    state.edit = k;
    syncInputs();
    update();
  }));

  compareBtn.addEventListener('click', () => {
    state.compare = !state.compare;
    if (state.compare) ensureB();
    else state.edit = 'a';
    syncInputs();
    update({ duration: 800 });
  });

  presetBtns.forEach((btn) => btn.addEventListener('click', () => {
    state.preset = btn.dataset.preset;
    state.b = PRESETS[state.preset](state.a);
    state.compare = true;
    state.edit = 'a';
    syncInputs();
    update({ duration: 800 });
  }));

  function setPurpose(key, { animate = true } = {}) {
    state.purpose = key;
    const P = PURPOSES[key];
    if (P) {
      state.a.goal = P.goal;
      state.a.years = P.years;
      purposeNote.textContent = `Illustrative example loaded: ${usd(P.goal)} in today's dollars over ${yearsTxt(P.years)}. Change either freely.`;
    } else {
      state.a.goal = 0;
      purposeNote.textContent = 'No purpose target. The chart shows the curves alone.';
    }
    if (state.b) state.b = state.preset ? PRESETS[state.preset](state.a) : { ...state.b, goal: state.a.goal };
    syncInputs();
    update({ animate, duration: 900 });
  }
  purposeRadios.forEach((r) => r.addEventListener('change', () => { if (r.checked) setPurpose(r.value); }));

  $('[data-reset]').addEventListener('click', () => {
    state.a = { ...DEFAULT_A }; state.b = null; state.compare = false; state.edit = 'a'; state.preset = null; state.purpose = DEFAULT_PURPOSE;
    purposeNote.textContent = 'Choosing a purpose loads an illustrative example target and horizon. You can change both.';
    syncInputs();
    update({ duration: 800 });
  });

  mqMobile.addEventListener?.('change', () => update({ animate: false }));

  syncInputs();
  // opening gesture: the curves rise from the baseline and the milestones light up
  update({ animate: true, duration: 1600 });

  planner = { setPurpose, chart, root };
}

/* =========================================================
   2 · PRINCIPLES — figures computed by the same model
   ========================================================= */
function initFigures() {
  const p = { initial: 0, monthly: 500, years: 30, rate: 5, inflation: 2.5 };
  const end = model(p)(p.years);
  const vals = { monthly: usd(p.monthly), years: yearsTxt(p.years), rate: pct(p.rate), contrib: usdR(end.contrib), nominal: usdR(end.nominal) };
  $$('[data-fig]').forEach((n) => { n.textContent = vals[n.dataset.fig]; });
}

/* =========================================================
   3 · FOUR MOVEMENTS — sticky story chart
   ========================================================= */
function initStory() {
  const root = $('[data-chart="story"]');
  if (!root) return;
  const base = { initial: 0, monthly: 400, years: 35, rate: 5, inflation: 2.5, offset: 0, goal: 0 };
  const late = { ...base, years: 25, offset: 10 };
  const STEPS = {
    1: { a: { ...base, rate: 0, inflation: 0 }, b: null, show: { real: false, goal: false }, label: 'Contribute' },
    2: { a: base, b: null, show: { real: false, goal: false }, label: 'Wait' },
    3: { a: base, b: null, show: { real: true, goal: false }, label: 'Discount' },
    4: { a: base, b: late, show: { real: true, goal: false }, label: 'Begin later' },
  };
  const eA = model(base)(base.years), eB = model(late)(late.years);
  const share = (eA.nominal - eA.contrib) / eA.nominal;
  const vals = {
    monthly: usd(base.monthly),
    years: yearsTxt(base.years),
    rate: pct(base.rate),
    inflation: pct(base.inflation),
    contrib: usdR(eA.contrib),
    nominal: usdR(eA.nominal),
    share: new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 0 }).format(share),
    real: usdR(eA.real),
    contribDiff: usdR(eA.contrib - eB.contrib),
    realDiff: usdR(eA.real - eB.real),
  };
  $$('[data-story-val]').forEach((n) => { n.textContent = vals[n.dataset.storyVal]; });

  const chart = new ScenarioChart(root, { annotate: false, labels: true });
  const caption = $('[data-story-caption]');
  const frame = root.closest('.story__frame');
  const navBtns = $$('[data-goto]');
  const steps = $$('.step[data-step]');
  let current = 0;

  function go(n, animate = true) {
    if (n === current) return;
    current = n;
    const s = STEPS[n];
    chart.set({ a: s.a, b: s.b, show: s.show }, { animate, duration: 1100 });
    caption.textContent = `Step ${n} of 4 · ${s.label}`;
    frame.classList.toggle('is-compare', !!s.b);
    frame.classList.toggle('is-real', !!s.show.real);
    navBtns.forEach((b) => (b.dataset.goto === String(n) ? b.setAttribute('aria-current', 'step') : b.removeAttribute('aria-current')));
    steps.forEach((st) => st.classList.toggle('is-active', st.dataset.step === String(n)));
  }
  go(1, false);

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) go(+e.target.dataset.step);
    }, { rootMargin: '-55% 0px -40% 0px', threshold: 0 });
    steps.forEach((s) => io.observe(s));
  }

  navBtns.forEach((b) => b.addEventListener('click', () => {
    const n = +b.dataset.goto;
    const target = $(`#step-${n}`);
    go(n);
    if (target) {
      const r = target.getBoundingClientRect();
      const y = window.scrollY + r.top - window.innerHeight * 0.58 + Math.min(r.height, 200) / 2;
      window.scrollTo({ top: Math.max(0, y), behavior: isReduced() ? 'auto' : 'smooth' });
    }
  }));
}

/* =========================================================
   Hero starfield with the Orion figure
   ========================================================= */
function initStarfield() {
  const svg = $('[data-starfield]');
  if (!svg) return;
  const r = rng(1530);
  const n = window.innerWidth < 720 ? 90 : 170;
  const g = svgEl('g', { class: 'sf-stars' }, svg);
  for (let i = 0; i < n; i++) {
    const c = svgEl('circle', { cx: (r() * 1600).toFixed(1), cy: (r() * 1000).toFixed(1), r: (r() < 0.08 ? 1.7 : 0.5 + r() * 0.8).toFixed(2) }, g);
    c.style.opacity = (0.25 + r() * 0.6).toFixed(2);
    if (i % 9 === 0) { c.classList.add('tw'); c.style.animationDelay = `${(r() * 7).toFixed(2)}s`; }
  }
  // Orion: shoulders, belt, feet (and a faint head)
  const P = [[1220, 120], [1440, 150], [1300, 330], [1340, 318], [1380, 306], [1240, 520], [1450, 500], [1330, 70]];
  const E = [[0, 2], [1, 4], [2, 3], [3, 4], [2, 5], [4, 6], [0, 7], [7, 1]];
  const cg = svgEl('g', { class: 'sf-orion' }, svg);
  E.forEach(([a, b], i) => {
    const l = svgEl('line', { x1: P[a][0], y1: P[a][1], x2: P[b][0], y2: P[b][1], pathLength: 1 }, cg);
    l.style.setProperty('--i', i);
  });
  P.forEach(([x, y], i) => {
    const big = i === 0 || i === 6;
    svgEl('circle', { cx: x, cy: y, r: big ? 22 : 14, class: 'sf-glow' }, cg);
    svgEl('circle', { cx: x, cy: y, r: big ? 3.2 : i === 7 ? 1.6 : 2.4, class: 'sf-star' }, cg);
  });
  const hero = $('.hero');
  if (hero && 'IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => svg.classList.toggle('is-paused', !e.isIntersecting)).observe(hero);
  }
}

/* =========================================================
   4 · PURPOSE ATLAS
   ========================================================= */
const CONST = {
  independence: { p: [[160, 80], [300, 96], [205, 200], [232, 192], [259, 184], [170, 300], [312, 288], [228, 40]], e: [[0, 2], [1, 4], [2, 3], [3, 4], [2, 5], [4, 6], [0, 7], [7, 1]] },
  education: { p: [[720, 110], [720, 230], [600, 132], [612, 244], [840, 132], [828, 244]], e: [[0, 1], [0, 2], [2, 3], [3, 1], [1, 5], [5, 4], [4, 0]] },
  home: { p: [[190, 548], [190, 458], [270, 388], [350, 458], [350, 548], [270, 548], [270, 493]], e: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0], [5, 6]] },
  legacy: { p: [[740, 556], [740, 470], [680, 410], [650, 355], [800, 400], [842, 348], [705, 345], [790, 332], [745, 310]], e: [[0, 1], [1, 2], [2, 3], [1, 4], [4, 5], [2, 6], [4, 7], [1, 8]] },
};

function initAtlas() {
  const svg = $('[data-atlas]');
  if (!svg) return;
  const r = rng(77);
  // engraved celestial grid
  const grid = svgEl('g', { class: 'at-grid' }, svg);
  for (let i = 1; i <= 6; i++) svgEl('circle', { cx: 500, cy: 1180, r: 420 + i * 120 }, grid);
  for (let i = -5; i <= 5; i++) {
    const a = (-90 + i * 9) * Math.PI / 180;
    svgEl('line', { x1: 500, y1: 1180, x2: (500 + Math.cos(a) * 1400).toFixed(1), y2: (1180 + Math.sin(a) * 1400).toFixed(1) }, grid);
  }
  const bg = svgEl('g', { class: 'at-stars' }, svg);
  const n = window.innerWidth < 720 ? 110 : 220;
  for (let i = 0; i < n; i++) {
    const c = svgEl('circle', { cx: (r() * 1000).toFixed(1), cy: (r() * 640).toFixed(1), r: (r() < 0.07 ? 1.5 : 0.4 + r() * 0.7).toFixed(2) }, bg);
    c.style.opacity = (0.2 + r() * 0.5).toFixed(2);
  }
  const groups = {};
  for (const key in CONST) {
    const { p, e } = CONST[key];
    const g = svgEl('g', { class: 'cst', 'data-k': key }, svg);
    e.forEach(([a, b], i) => {
      const l = svgEl('line', { x1: p[a][0], y1: p[a][1], x2: p[b][0], y2: p[b][1], pathLength: 1 }, g);
      l.style.setProperty('--i', i);
    });
    p.forEach(([x, y], i) => {
      svgEl('circle', { cx: x, cy: y, r: 16, class: 'cst__glow' }, g);
      svgEl('circle', { cx: x, cy: y, r: i === 0 ? 3.4 : 2.4, class: 'cst__star' }, g);
    });
    groups[key] = g;
  }

  const btns = $$('[data-purpose-btn]');
  const detail = $('[data-purpose-detail]');
  const pd = (k) => $(`[data-pd="${k}"]`, detail);
  let active = 'independence';
  function select(key) {
    active = key;
    const P = PURPOSES[key];
    btns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.purposeBtn === key)));
    for (const k in groups) groups[k].classList.toggle('is-active', k === key);
    svg.dataset.active = key;
    pd('k').textContent = `Purpose ${P.no}`;
    pd('name').textContent = P.name;
    pd('line').textContent = P.line;
    pd('target').textContent = `${usd(P.goal)} in today's dollars`;
    pd('years').textContent = yearsTxt(P.years);
    const ul = pd('qs');
    ul.replaceChildren(...P.qs.map((q) => Object.assign(document.createElement('li'), { textContent: q })));
    if (!isReduced()) { detail.classList.remove('is-new'); void detail.offsetWidth; detail.classList.add('is-new'); }
  }
  btns.forEach((b) => b.addEventListener('click', () => select(b.dataset.purposeBtn)));
  for (const k in groups) groups[k].addEventListener('click', () => select(k));
  select('independence');

  $('[data-load-purpose]').addEventListener('click', () => {
    if (!planner) return;
    planner.setPurpose(active);
    const target = $('#planner');
    target.scrollIntoView({ behavior: isReduced() ? 'auto' : 'smooth', block: 'start' });
    planner.root.focus({ preventScroll: true });
  });
}

/* =========================================================
   Reveals, timeline, active nav
   ========================================================= */
function initReveals() {
  const els = $$('[data-reveal]');
  if (isReduced() || !('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('is-in')); return; }
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.15 });
  els.forEach((e) => io.observe(e));
}

function initTimeline() {
  const tl = $('[data-timeline]');
  if (!tl) return;
  const steps = $$('.tl-step', tl);
  const vertical = window.matchMedia('(max-width: 859px)');
  let ticking = false;
  function measure() {
    ticking = false;
    const r = tl.getBoundingClientRect();
    const vh = window.innerHeight;
    let p = (vh * 0.8 - r.top) / (r.height + vh * 0.3);
    p = Math.max(0, Math.min(1, p));
    if (isReduced()) p = r.top < vh ? 1 : 0;
    tl.style.setProperty('--tl', p.toFixed(3));
    steps.forEach((s, i) => {
      const at = vertical.matches ? (s.offsetTop + 8) / tl.offsetHeight : i / steps.length;
      s.classList.toggle('is-on', p >= at - 0.001 && p > 0);
    });
  }
  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(measure); } };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  measure();
}

function initActiveNav() {
  const links = $$('.nav__list a');
  const map = new Map(links.map((a) => [a.getAttribute('href').slice(1), a]));
  if (!('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      links.forEach((l) => l.removeAttribute('aria-current'));
      const a = map.get(e.target.id);
      if (a) a.setAttribute('aria-current', 'true');
    }
  }, { rootMargin: '-45% 0px -50% 0px' });
  $$('main > section[id]').forEach((s) => io.observe(s));
}

/* =========================================================
   Navigation (mobile) + ledger deep links
   ========================================================= */
function initNav() {
  const toggle = $('[data-nav-toggle]');
  const nav = $('[data-nav]');
  if (!toggle || !nav) return;
  const set = (open) => {
    header.classList.toggle('is-open', open);
    document.documentElement.classList.toggle('menu-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.querySelector('.nav-toggle__label').textContent = open ? 'Close' : 'Menu';
  };
  toggle.addEventListener('click', () => set(toggle.getAttribute('aria-expanded') !== 'true'));
  nav.addEventListener('click', (e) => { if (e.target.closest('a')) set(false); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && header.classList.contains('is-open')) { set(false); toggle.focus(); }
  });
  window.matchMedia('(min-width: 1100px)').addEventListener?.('change', (e) => { if (e.matches) set(false); });
}

function openTerm(id, focus = true) {
  const t = document.getElementById(id);
  if (t && t.tagName === 'DETAILS') {
    t.open = true;
    if (focus) requestAnimationFrame(() => t.querySelector('summary').focus({ preventScroll: true }));
    return true;
  }
  return false;
}
function openTermFromHash() {
  const id = decodeURIComponent(location.hash.slice(1));
  if (id) openTerm(id);
}
function initTermLinks() {
  $$('a[href^="#term-"]').forEach((a) => a.addEventListener('click', () => openTerm(a.getAttribute('href').slice(1))));
}

/* =========================================================
   Form — client-side validation, honest demo success
   ========================================================= */
function initForm() {
  const form = $('[data-form]');
  if (!form) return;
  const done = $('[data-form-done]');
  const status = $('[data-form-status]');
  const count = $('[data-count]');
  const MAX = 600;
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  const rules = {
    fullname: (f) => (f.value.trim().length < 2 ? 'Please enter your full name.' : ''),
    email: (f) => (!f.value.trim() ? 'Please enter your email address.' : !emailRe.test(f.value.trim()) ? 'Please check the email format, for example name@example.com.' : ''),
    purpose: (f) => (!f.value ? 'Please choose the purpose closest to yours.' : ''),
    time: () => ($('input[name="time"]:checked', form) ? '' : 'Please choose a preferred time of day.'),
    message: (f) => (f.value.length > MAX ? `Please keep the message under ${MAX} characters.` : ''),
    agree: (f) => (!f.checked ? 'Please confirm you understand this is a demo.' : ''),
  };
  const fieldOf = (name) => (name === 'time' ? $('#c-time') : form.elements[name]);
  const focusOf = (name) => (name === 'time' ? $('#c-time-first') : form.elements[name]);
  const touched = new Set();

  function check(name) {
    const field = fieldOf(name);
    const msg = rules[name](field);
    const err = $(`[data-error-for="${name}"]`, form);
    err.textContent = msg;
    if (name === 'time') $$('input[name="time"]', form).forEach((r) => (msg ? r.setAttribute('aria-invalid', 'true') : r.removeAttribute('aria-invalid')));
    else if (msg) field.setAttribute('aria-invalid', 'true'); else field.removeAttribute('aria-invalid');
    return !msg;
  }

  for (const name of Object.keys(rules)) {
    if (name === 'time') {
      $$('input[name="time"]', form).forEach((r) => r.addEventListener('change', () => { if (touched.has('time')) check('time'); }));
      continue;
    }
    const field = form.elements[name];
    const evt = field.type === 'checkbox' || field.tagName === 'SELECT' ? 'change' : 'input';
    field.addEventListener(evt, () => { if (touched.has(name)) check(name); });
    field.addEventListener('blur', () => { if (field.value || field.type === 'checkbox') { touched.add(name); check(name); } });
  }

  const msg = form.elements.message;
  const updateCount = () => {
    count.textContent = `${msg.value.length} / ${MAX}`;
    count.classList.toggle('is-over', msg.value.length > MAX);
  };
  msg.addEventListener('input', updateCount);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    let firstBad = null, bad = 0;
    for (const name of Object.keys(rules)) {
      touched.add(name);
      if (!check(name)) { bad++; if (!firstBad) firstBad = focusOf(name); }
    }
    if (firstBad) {
      status.textContent = bad === 1 ? 'One field needs attention.' : `${bad} fields need attention.`;
      firstBad.focus();
      return;
    }
    status.textContent = '';
    $('[data-done-name]', done).textContent = form.elements.fullname.value.trim().split(/\s+/)[0];
    form.hidden = true;
    done.hidden = false;
    done.focus();
  });

  $('[data-form-again]').addEventListener('click', () => {
    form.reset();
    touched.clear();
    $$('[aria-invalid]', form).forEach((n) => n.removeAttribute('aria-invalid'));
    $$('.f-error', form).forEach((n) => { n.textContent = ''; });
    status.textContent = '';
    updateCount();
    done.hidden = true;
    form.hidden = false;
    form.elements.fullname.focus();
  });
}

/* ---------- boot ---------- */
initStarfield();
initPlanner();
initFigures();
initStory();
initAtlas();
initReveals();
initTimeline();
initActiveNav();
initNav();
initTermLinks();
initForm();
openTermFromHash();
window.addEventListener('hashchange', openTermFromHash);
window.orionReady = true;
