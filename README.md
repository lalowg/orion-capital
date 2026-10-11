# ORION CAPITAL — Wealth With Purpose

A fictional private planning house, presented as a midnight, private-bank editorial site whose first viewport is an instrument: an **educational planning simulator**. You name what the money is for, move five assumptions, and watch tweened scenario curves redraw against a purpose target in today's dollars. Milestones light up along the curve like a constellation.

Production URL: `https://orion-capital-nine.vercel.app`

> Educational illustration. Hypothetical figures only. Not financial advice, not a forecast. ORION CAPITAL is a fictional concept brand built as a portfolio project.

---

## Concept

Most wealth sites open with a product or a promise of returns. ORION CAPITAL opens with a question: **what is it for?** Independence, a child's education, a home or a legacy. Each purpose becomes an amount and a date, priced in today's dollars. The planner then shows how time, contributions and inflation shape the path toward it.

The constellation motif carries the idea. A purpose is not one number but a pattern of dates and amounts, like stars that only make sense once they are connected. On the chart, the start, the year growth overtakes contributions, the year the purpose is reached and the horizon are drawn as stars joined by a dotted line.

## Brand & positioning

- **What it is (in this concept):** a planning house that teaches and plans around purposes before products. The site never names products, never claims returns and makes no regulatory claims.
- **Tone:** discreet, exact and unhurried. The copy is plain English with no hype, and it is honest about inflation and about the model's limits.
- **Logo:** an original mark showing the Orion figure (two shoulders, the three-star belt and two feet) joined in brass inside a thin platinum ring, with a widely tracked ORION CAPITAL wordmark. See `logo.svg`; `favicon.svg` is the mark on a midnight tile.

## Audience

Professionals and families (30–60) who want to understand a plan before they discuss one with anyone. Typically they are comparing "start now with less" against "start later with more", or checking whether a purpose is realistic.

## Art direction

- **Palette:** midnight `#0B1530`, platinum `#C9CED6`, brass `#B89B5E`, ivory `#F4F1EA`. Derived tones:
  - deep `#071026` for the atlas, header strip and footer
  - brass-hi `#D2B87E` for small text on dark
  - brass-ink `#7A6330` for accent text on ivory, meeting AA contrast
  - paper `#ECE7DC` for the ledger
- **Composition:** the sections alternate between night and paper, like a private-bank report:
  1. **Planner (midnight):** an editorial headline, then an instrument plate with brass corner marks. Readouts sit above the chart, and controls and the plain-English reading sit alongside.
  2. **Principles (ivory):** three ledger columns with Roman numerals and small line figures that draw themselves, plus a band of two large figures computed by the model.
  3. **Four movements (midnight):** a sticky story chart with four scroll-driven steps.
  4. **Planning by purpose (deep):** an engraved star atlas with four constellations (Independence, Education, A home, Legacy) and a detail panel.
  5. **Method (ivory):** a four-station timeline with a brass rail that fills as you scroll, and a pull statement.
  6. **Ledger (paper):** an A–Z glossary of `<details>` entries beside a sticky aside.
  7. **Conversation (midnight):** a validated request form.
  8. **Footer:** navigation, a framed credit and a full legal disclaimer.
- **Imagery:** everything is generated SVG. The hero starfield includes the Orion figure drawing itself in brass, and the atlas has a celestial grid. There are no photos and no external images.

## Typography

- **Spectral** (300/400/500, italics 300/400) for display, numerals and readouts, with lining tabular figures.
- **Onest** (400/500/600) for text, labels and interface. Small caps labels are tracked at 0.2em or more.
- Both fonts load from Google Fonts with `display=swap`, using only these weights.

## Motion language: "stars on a ledger"

- **Tweened paths (signature):** each curve is sampled at 161 points and tweened in pixel space with an in-out cubic ease. Changes to assumptions, horizon, scale and scenario all morph rather than jump.
  - On load, the curves rise from the baseline.
  - Scenario B splits out of A.
  - In the story, the today's-dollars line peels away from the projected line as inflation is applied.
- **Constellation milestones:** once a tween settles, the milestone stars appear one after another, scaling and rotating into place. Dotted connectors and their labels follow.
- **Counting readouts:** the readouts count to their new values.
- **Pen-stroke reveals** (deliberately not fade-ups): headings and blocks are revealed by a left-to-right clip, like ink drawn across a ledger. Headings also tighten their tracking as they land.
- **Other motion:**
  - In the atlas, the selected constellation redraws its lines and the detail panel wipes in.
  - The method rail fills in proportion to scroll.
  - Starfield twinkle pauses when the hero is off screen.

## Signature interaction: how to operate it

1. **Purpose:** choose *Independence*, *Education*, *A home*, *Legacy* or *No target*. Each purpose loads an illustrative example target (in today's dollars) and horizon. The default is Education: $150,000 over 18 years.
2. **Sliders:**
   - Starting amount: $0–$250,000
   - Monthly contribution: $0–$5,000
   - Horizon: 1–45 years
   - Hypothetical annual return: 0–10%
   - Assumed inflation: 0–8%
   - Purpose target: $0–$2,000,000 in today's dollars

   Every change redraws the chart, readouts, purpose status, a plain-English reading and an optional data table.
3. **Compare:** turn on *Compare scenarios* or pick a quick comparison: *Start five years later* (stopping on the same date), *Add $250 a month*, *Two points lower return* or *Inflation at 4%*.
   - Scenario B is drawn dashed.
   - While a preset is active, B follows any change you make to A.
   - Choosing *Scenario B* makes the sliders edit B directly.
4. **Scrub:** hover or drag across the chart (touch works too) to see a year-by-year tooltip. With keyboard focus on the chart, use ← → (±1 year), Page Up/Down (±5), Home/End and Esc. A polite live region announces the values.
5. **Milestones:** stars mark the start, the year growth overtakes contributions, the year the purpose is reached (measured against the today's-dollars line) and the horizon. If the target is far above the curves, the chart says so instead of flattening them.
6. **Story chart:** a second chart tells *Contribute → Wait → Discount → Begin later* as you scroll. Step buttons give keyboard and touch access.
7. **Atlas:** choose a constellation (button or click). Then *Load this example into the planner* sets that purpose, scrolls back and focuses the chart.

**Model:** the annual hypothetical rate is converted to an equivalent monthly rate, and contributions are added at the end of each month. Real value is deflated by the assumed inflation over the elapsed years; a late starter is measured on the same calendar. There are no taxes, fees, volatility or sequence risk. All narrative numbers in the story and principles sections are computed at runtime by the same model, so text and charts cannot disagree.

## Tech

- Static HTML, CSS and ES modules. No build step, no dependencies and no CDNs besides Google Fonts.
- Files (flat):
  - `index.html`
  - `style.css`
  - `chart.js`: model, goal and crossover maths, and the `ScenarioChart` class. Adapted from the earlier unshipped planning prototype and extended with purpose targets, off-chart handling, constellation milestones and English/USD formatting.
  - `main.js`: planner, story, atlas, starfield, reveals, timeline, navigation, glossary deep links and form
  - `logo.svg`
  - `favicon.svg`
- The chart's SVG `viewBox` tracks its pixel size through a `ResizeObserver`, so text stays crisp and never scales. If a relayout happens during a tween, the animation retargets.
- About 55 KB of hand-written JS (unminified).

## Local development

```bash
npx serve .
```

ES modules need http(s); `file://` will not load `main.js`.

## Accessibility

- `lang="en"`, a skip link, landmarks, one `<h1>`, a logical heading order and visible `:focus-visible` rings (brass on dark, midnight on paper).
- Sliders are native range inputs with `<output>` and spoken `aria-valuetext` (for example "$600 a month"). Toggles use `aria-pressed`, and purposes are a native radio group.
- The chart is a focusable group with a keyboard scrubber and a live text equivalent. The plain-English reading (`aria-live="polite"`) and an optional full data table mean no information is visual-only.
- Each glossary entry has its own deep link (for example `#term-inflation`). The "What is this?" links open the entry, and reloading with that hash restores it.
- The form uses inline errors linked through `aria-describedby` and `aria-invalid`, focus moves to the first invalid field, and a status line uses `role="alert"`. Success says plainly that this is a portfolio demo and nothing was sent or booked.
- The disclaimer "Educational illustration · Hypothetical figures · Not financial advice" stays visible in the fixed header at all times. It is repeated under the chart, in the atlas and in the footer.
- `prefers-reduced-motion: reduce` turns off path tweens, counting, reveals, twinkle and star animations. All states change instantly and everything stays operable.

## Performance

- No WebGL and no continuous render loop. Frames are drawn only while a tween runs, and slider input is coalesced to one update per animation frame.
- The starfield and atlas are generated once as SVG. Mobile gets fewer stars, and starfield animation pauses when the hero is off screen.
- Network requests: HTML, CSS, two JS modules, the favicon and Google Fonts.

## Mobile adaptation

- The plate (readouts and chart) becomes a sticky stage under the header, and the controls scroll beneath it, so the curves stay in view while you adjust them. This applies on screens at least 700px tall; shorter screens use normal flow.
- The story chart becomes a sticky top panel.
- Principles turn into numeral-plus-text rows, and the method timeline turns vertical.
- The atlas stacks above its detail panel.
- Navigation collapses into a full-width menu.

## Known limitations

- The model is deliberately simple: constant hypothetical return and inflation, with no taxes, fees, volatility or sequence risk. The footnote and the ledger say so.
- Very large values switch the readouts to a compact "$M" format (above $10M on desktop, $1M on mobile).
- Custom range styling targets Chromium/WebKit and Firefox. Other engines show native sliders.
- The form makes no network calls (by design).

---

Designed & built by Saad Bashir — https://www.linkedin.com/in/saadbashirmarketing/
