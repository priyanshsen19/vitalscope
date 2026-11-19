# Vitalscope — Personal Health Intelligence

> Understand your body beyond the numbers.

## Overview

Vitalscope is a web app that turns everyday wearable readings (heart rate, HRV, sleep, steps, breathing, movement) into plain answers. For example: *What is normal for me? Has something changed? Is this new habit actually helping?*

- **Personal baselines, not population averages.** Every reading is compared with *your own* usual range.
- **Health Drift.** Flags when several body signals shift together for several days in a row, a pattern published research has linked to oncoming illness, strain and poor recovery.
- **Habit experiments.** Before-and-after tests on yourself, such as "no caffeine after 2pm → better sleep?", with effect size and confidence.
- **Two views.** *Simple* uses everyday words and *Detailed* shows the full analysis.
- **Two data modes.** *Demo data* is synthetic, with known planted events so the analysis can be checked against an answer key. *Real data* is 90 days of genuine Fitbit recordings from a published research study (LifeSnaps, CC BY 4.0).

Built with Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, Recharts, Framer Motion and Zod. Everything runs in the browser: no backend, no API keys, no tracking.

> **Not a medical device.** Vitalscope describes changes; it does not diagnose. No real Apple Watch or Temple device is connected. BrainFlow Index and Entropy are labelled *Simulated Temple-compatible* everywhere.

## Run

```bash
npm install
npm run dev                  # http://localhost:3000
npm run build && npm start   # production
npm run typecheck
```

## Testing and verification

Everything below was run against this code. The live checks can be re-run at any time on the **How it works** page (`/how-it-works`).

### 1. Accuracy checks on demo data — 7 / 7 pass

The synthetic generator plants known events. The app's real analysis code is then run on the data, and each check confirms the event is found (or correctly ignored).

| Planted in the data | Expected | What Vitalscope found | Result |
|---|---|---|---|
| Strain period: resting HR ↑, HRV ↓, breathing ↑, sleep quality ↓ from Nov 3 | A multi-signal drift episode soon after | Episode from Nov 7, 12 days, 4 signals | ✅ Pass |
| 2-night travel disruption (Oct 15–16) | One-off outliers, **not** a sustained drift | No episode; outliers in resting HR and sleep efficiency | ✅ Pass |
| Nothing unusual in the first 30 days | Zero drift episodes (false-alarm check) | 0 episodes | ✅ Pass |
| Morning walks for 12 of 14 days improve sleep | Experiment reports sleep "improved" | Improved, effect 1.78 SD, confidence High | ✅ Pass |
| Temporary mobility dip (Oct 10–24) | Walking speed well below baseline (z ≤ −1.5) | z = −3.5 | ✅ Pass |
| Slow decline in stair-descent speed | Marked "worth monitoring" | Monitor, −3.1 SD vs baseline | ✅ Pass |
| Same seed regenerated | Identical data (reproducible) | Identical | ✅ Pass |

All 7 checks also pass on seeds 1, 42, 777, 2025 and 99999, not just the default seed 20240917.

### 2. Data-quality checks on real data — 5 / 5 pass

Real data has no answer key, so these checks confirm the data was imported correctly and behaves like a real body.

| What we checked | Expected | Result |
|---|---|---|
| 877 readings across 10 measurements | Every value in a plausible human range (catches unit/parsing bugs) | All within range ✅ |
| 90 calendar days | One row per day, no duplicates, no skipped dates | One row per day, in order ✅ |
| Missing days left as gaps (not filled) | ≥ 85% of days present for core measurements | Lowest 87 / 90 (97%) ✅ |
| Baseline month (first 30 days) | Every measurement varies enough to build a personal range | 10 / 10 ✅ |
| Known physiology: higher resting HR ↔ lower HRV | Negative relationship | r = −0.72 over 87 days ✅ |

**What the analysis found on the real volunteer:**
- No multi-signal drift episodes. It did not invent alarms from normal day-to-day noise.
- Readiness 83 ("Primed") on the last day.
- 3 one-off unusual days, seen but correctly not raised as alerts.
- In Simple view, 9 of 10 measurements were "normal for you" and VO2 Max was "a bit lower".

### 3. Build and app checks

| Check | Result |
|---|---|
| `npm run typecheck` (TypeScript strict) | No errors |
| `npm run build` (production) | Succeeds; all 12 routes prerendered as static pages |
| Every route (`/`, `/overview`, `/health-drift`, `/experiments`, `/movement`, `/brain-body`, `/insights`, `/data-sources`, `/settings`, `/my-body`, `/how-it-works`) | HTTP 200 on the production server |
| All routes in both Demo and Real data modes, Simple and Detailed views | Load with no console errors |
| Real-data mode on screens with no Fitbit equivalent (gait, stairs, sleep stages, Brain-Body) | Shows "Not recorded in the real data" instead of invented values; no crashes |
| Phone width (375 px) | No horizontal scrolling on any page |
| Experiments: create, edit, start, pause, resume, complete, delete, Markdown export | Work end-to-end; saved to `localStorage` and restored on reload |
| Settings: theme, units, date format, reduced motion, reset, regenerate, export | Applied across the app |
| Info / help pop-up | Opens, scrolls and closes correctly on desktop and phone |

## Modules

| Route | What it does |
|---|---|
| `/overview` | Today: readiness dial, focus card, vitals strip, trend explorer, important changes, active experiments |
| `/my-body` | Every measurement grouped by body area, with your usual range and plain explanations (Simple view) |
| `/health-drift` | Personal-baseline drift detection (z-score, rolling average, ≥3-day persistence, multi-signal), configurable thresholds, "How was this detected?" |
| `/experiments` | Create / run / complete habit experiments; adherence calendar; before-after analysis; confidence factors; Markdown report |
| `/movement` | Six mobility metrics, baseline comparison, mobility-profile radar, observations |
| `/brain-body` | Three simulated workouts, synchronised multi-signal timeline (demo only) |
| `/insights` | Every generated insight with an expandable evidence panel |
| `/data-sources` | Where each measurement comes from, real-data provenance and citation, roadmap |
| `/how-it-works` | Formulas for all eight analysis engines, their limits, and the live checks above |
| `/settings` | Profile, units, date format, theme, reduced motion, data source, reset / export |

## How the analysis works

There is no machine learning or forecasting. Everything is transparent descriptive statistics against a personal baseline (full formulas on `/how-it-works`).

- **Baseline:** your mean and spread over the first 30 days.
- **Health Drift:** a 5-day rolling average. A signal "drifts" when it stays at z ≥ 1.5 from your baseline for 3 or more days, and an episode needs at least 2 signals drifting together.
- **Readiness (0–100):** 75 means typical for you. Each favourable standard deviation in HRV, resting HR (inverted), sleep efficiency and sleep duration over the last 3 days adds 12 points. It is a transparent index, not a clinical score.
- **Plain status:** "Normal for you" within 1.5× your typical spread, "A bit higher/lower" up to 2.5×, "Much higher/lower" beyond.
- **Experiments:** the trial period is compared with the equal-length period before it, giving mean change, effect size (in standard deviations) and a confidence score from five factors: sample size, data completeness, consistency, confounders and duration covered.

## Data

### Demo data (synthetic)
* 90 days generated from a seeded PRNG (`mulberry32`); the same seed always gives the same data.
* Planted events: a morning-walk intervention, a 12-day multi-signal drift, a mobility dip with a lasting stair decline, a 2-day travel blip, and three workouts with different BrainFlow/Entropy responses.
* A few readings are intentionally missing so gaps are handled for real.

### Real data (LifeSnaps)
Switch **Demo data → Real data** in the top bar.

* **Source:** LifeSnaps, a 4-month study of 71 volunteers wearing a Fitbit Sense. Yfantidou, S. et al. (2022), Zenodo, DOI [10.5281/zenodo.7229547](https://zenodo.org/records/7229547), licence **CC BY 4.0**.
* **Bundled:** `src/data/real/lifesnaps.json` holds 90 days from one anonymised participant (`621e2f91`, 21 Oct 2021 → 18 Jan 2022). It has 10 measurements: resting HR, HRV (RMSSD), average HR, VO2 Max, breathing rate, sleep time, sleep efficiency, steps, distance and active minutes.
* **Selection:** a fixed rule picks the participant and 90-day window with the most complete days (87 / 90). It never looks at the results.
* **Changes:** unit conversions only. There is no smoothing or gap-filling, and demographics are dropped.
* **Reproduce:** download `rais_anonymized.zip` from Zenodo, extract `rais_anonymized/csv_rais_anonymized/daily_fitbit_sema_df_unprocessed.csv`, then run:
  ```bash
  node scripts/import-lifesnaps.mjs path/to/daily_fitbit_sema_df_unprocessed.csv
  ```

Experiments, settings and the seed persist in `localStorage` (`vitalscope:v1`).

## Structure

```
scripts/import-lifesnaps.mjs   converts the LifeSnaps CSV into the bundled JSON
src/
  app/                         one folder per route (see Modules)
  components/                  ui/, layout/, charts/, simple/, dashboard/, data/, drift/, experiments/, movement/, brain-body/, insights/, shared/
  data/real/lifesnaps.json     real public data (CC BY 4.0)
  lib/
    data/                      seed.ts, generator.ts, real.ts, selectors.ts, persistence.ts
    analytics/                 baseline, drift-detection, readiness, experiments, movement, brain-body, insights
    store/                     app-context.tsx (state + persistence)
    metrics.ts, plain.ts       metric definitions and plain-language layer
  types/                       health.ts, experiment.ts, insights.ts
```

## Limitations

* The drift thresholds (z 1.5, 3 days, 2 signals) are reasoned defaults, not tuned on illness-labelled data, and the app is not clinically validated.
* Real data is one public participant from 2021–22, not the viewer's own data.
* BrainFlow and Entropy are illustrative signals, not Temple's real metrics.
* Alcohol, travel, hard training or new medication can also cause drift.

## Licence

**Copyright © 2026 Priyansh Sen. All rights reserved.** The source code is published for viewing only. You may not copy, modify, distribute or use it without written permission. See [LICENSE](LICENSE).

The bundled LifeSnaps data (`src/data/real/lifesnaps.json`) is **not** covered by this notice. It remains under its original [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) licence, © Yfantidou et al. (2022).
