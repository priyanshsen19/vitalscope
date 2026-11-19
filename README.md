# Vitalscope — Personal Health Intelligence

> Understand your body beyond the numbers.

A working product demo (Next.js App Router · React · TypeScript · Tailwind · Recharts · Framer Motion).
**All measurements are synthetic.** Nothing is read from a real Apple Watch or Temple device, and no
integration is claimed. BrainFlow Index and Entropy are labelled *Simulated Temple-compatible* everywhere.

## Run

```bash
npm install
npm run dev        # http://localhost:3000
npm run build && npm start   # production
npm run typecheck
```

No API keys, backend or network access are required. All analytics are deterministic and run in the browser.

## Modules

| Route | What it does |
|---|---|
| `/overview` | Four summary cards, important changes, discovered patterns, active experiments, 30-day timeline |
| `/health-drift` | Personal-baseline drift detection (z-score, rolling average, ≥3-day persistence, multi-signal patterns), configurable thresholds and baseline window, “How was this detected?” |
| `/experiments` | Create / edit / start / pause / resume / complete / delete; adherence calendar; before-after analysis; confidence factors; Markdown report export |
| `/movement` | Six mobility metrics, baseline & 30-day comparison, period comparison, mobility-profile radar, schematic gait animation, generated observations |
| `/brain-body` | Three simulated workouts, synchronised multi-signal timeline (dual axes / normalised), session comparison, cross-signal observations |
| `/insights` | Every generated insight with an expandable evidence panel |
| `/data-sources` | Source coverage table, demo-mode status, integration roadmap (no fake connect buttons) |
| `/settings` | Profile, units, date format, theme, reduced motion, data source, reset / regenerate / export |

## How it works and accuracy checks

The **How it works** page (`/how-it-works`) explains the methodology for reviewers:
- **Where the data comes from:** a seeded synthetic generator. Nothing comes from a real person or device.
- **No forecasting or machine learning:** every result is descriptive statistics against a personal baseline.
- **The exact formulas** for all eight analysis engines (baseline, drift, readiness, plain-language status, experiments, movement, correlations and brain-body), each with why it was chosen and its limits.
- **Live accuracy checks:** the generator plants known events (a strain period, a 2-night travel disruption, morning walks, a mobility dip and a stair-speed decline). The page re-runs the real analytics and confirms each one is found. It also checks that the quiet first month raises no false alarms and that the same seed always gives the same data. These 7 checks pass on the default seed and on seeds 1, 42, 777, 2025 and 99999.

## Simple view and Detailed view

Vitalscope opens in **Simple view**, which is made for everyday users. You can switch views at any time with the Simple / Detailed toggle in the top bar.

| | Simple view | Detailed view |
|---|---|---|
| Navigation | Today · My Body · Habits | All modules (Health Drift, Experiments, Movement, Brain-Body, Insights, Data Sources) |
| Language | Everyday words ("Heart recovery", "Sleep quality", "A bit lower than usual") | Analytical terms (HRV, SD, z-score, effect size, confidence factors) |
| Today | Readiness dial with a plain headline, three tiles (Recovery, Sleep, Movement), "Worth a look", "Going well" and a one-tap habit check-in | Readiness hero, focus card, vitals strip, trend explorer and module cards |
| Controls | No date-range or data-source pickers | Range, source and drift threshold controls |

- **My Body** (`/my-body`) lists every measurement grouped by body area. Each card shows this week's value, your usual value and a bar that marks where you are against your usual range. Tap a card to open a panel with "What is it?", "Why it matters", "What may help", a 30-day chart with your usual range marked, and a link to the detailed analysis. You can also link straight to a measurement, for example `/my-body?m=restingHr`.
- **Plain-language layer** (`src/lib/plain.ts`): friendly names and explanations for every measurement. A reading counts as "Normal for you" within 1.5× your typical day-to-day spread, "A bit higher/lower" up to 2.5×, and "Much higher/lower" beyond that. Whether a change is a good sign or worth a look depends on which direction is healthier for that measurement.
- **Habits**: in Simple view, results are written as sentences ("Before you started, your time asleep was usually 6h 49m. While doing this habit it averaged 7h 34m."), together with a plain confidence line and a reminder that the habit may not be the cause.
- **Original visuals**: the readiness dial (a 240° arc of separate ticks), the 10-block level meters and the usual-range bars were designed for Vitalscope. They are not copied from any existing wearable app.

## Experience design

- **Today screen**: a greeting, a readiness dial with Recovery, Sleep and Move rows you can click, a "Today's focus" card based on current drift, a scrollable strip of vitals and a trend explorer with a gradient chart.
- **Readiness score** (`src/lib/analytics/readiness.ts`): 75 means typical for you. Each favourable standard deviation in HRV, resting HR (inverted), sleep efficiency and sleep duration over the last 3 days, compared with your first 30 days, adds 12 points. It is a transparent demo index, not a clinical score.
- **Phone layout**: an app-style bottom tab bar for the five main modules. The drawer still holds everything else.
- **Visual system**: dark glass cards, gradient headers with an icon and accent colour for each module, pill-shaped controls and soft colour glows. Turning on reduced motion in Settings switches off all entrance and ring animations.
- **UI components**: the primitives in `src/components/ui` are hand-written in the shadcn/ui style (Tailwind and CSS variables). There is no shadcn CLI step, so `npm install` is all you need.

## Structure

```
src/
  app/                    routes (overview, health-drift, experiments, movement, brain-body, insights, data-sources, settings)
  components/
    ui/                   button, card, badge, form controls, dialog, tabs (Segmented), progress, skeleton
    layout/               sidebar (collapsible + mobile drawer), topbar, help dialog, app shell
    charts/               TimeSeriesChart (dual-axis, bands, pinning), Sparkline
    shared/ dashboard/ drift/ experiments/ movement/ insights/
  lib/
    data/                 seed.ts (PRNG + scripted events), generator.ts, selectors.ts, persistence.ts (zod + localStorage)
    analytics/            baseline.ts, drift-detection.ts, experiments.ts, movement.ts, brain-body.ts, insights.ts
    store/                app-context.tsx (state + persistence), use-analysis.ts
    metrics.ts            metric definitions, units, formatting
  types/                  health.ts, experiment.ts, insights.ts
```

## How the data works

* 90 days (2026-08-21 → 2026-11-18) generated from a seeded PRNG (`mulberry32`); the same seed always gives the same data.
* Scripted events: a two-week morning-walk intervention, a 12-day multi-signal drift that is still ongoing, a walking-speed dip with a lasting stair-descent decline, a 2-day travel blip (not counted as drift because it doesn’t persist), and three workouts with different BrainFlow/Entropy responses.
* A few sleep/Temple readings are intentionally missing so completeness is real.
* Experiments, adherence, settings and the seed persist in `localStorage` (`vitalscope:v1`). *Settings → Reset demo data* clears it.

## Real public data (LifeSnaps)

Switch **Demo data → Real data** in the top bar to run every module on genuine wearable recordings.

* **Source:** LifeSnaps, a 4-month study of 71 volunteers wearing a Fitbit Sense. Yfantidou, S. et al. (2022), Zenodo, DOI [10.5281/zenodo.7229547](https://zenodo.org/records/7229547), licence **CC BY 4.0**.
* **What's bundled:** `src/data/real/lifesnaps.json` holds 90 days for one anonymised participant (`621e2f91`, 21 Oct 2021 → 18 Jan 2022, 19 KB). It has 10 measurements: resting HR, HRV (RMSSD), average HR, VO2 Max, breathing rate, sleep time, sleep efficiency, steps, distance and active minutes.
* **How the participant was picked:** a fixed rule, the participant and 90-day window with the most days where resting HR, HRV, sleep and steps are all present (87/90). It never looks at the results.
* **What was changed:** unit conversions only. There is no smoothing and no gap-filling, and demographics are dropped.
* **Not in the data:** gait/stairs, sleep stages, daylight/noise, Temple signals and workouts. Those screens say "Not recorded in the real data", and Brain-Body is demo-only.
* **Reproduce:** download `rais_anonymized.zip` from Zenodo, extract `rais_anonymized/csv_rais_anonymized/daily_fitbit_sema_df_unprocessed.csv`, then run:
  ```bash
  node scripts/import-lifesnaps.mjs path/to/daily_fitbit_sema_df_unprocessed.csv
  ```
* **Validation:** real data has no answer key, so *How it works* runs data-quality checks on it: plausible ranges, one row per day, coverage, usable baselines, and the expected negative resting-HR/HRV link (r = −0.72). The ground-truth accuracy checks always run on the demo data.

## Limitations

* UI primitives are hand-written in the shadcn/ui style (Radix is not installed). Select is the native element.
* Real data is one public participant from 2021–22, not the viewer’s own data. BrainFlow/Entropy are always illustrative signals, not Temple’s real metrics.
* Experiments started “today” have no measurements yet; pick a past start date to analyse them against the demo data.
* Pausing keeps the original calendar; paused days are not excluded from analysis.
* Imperial units are applied to display values and tables; chart axes in some compact charts keep 2 decimals.
