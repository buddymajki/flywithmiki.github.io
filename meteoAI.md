# MeteoAI — the FLYwithMIKI flight-probability algorithm (v3)

**Status:** live on `meteoAI.html` · implemented in `meteo-core.js` (`assessSite` / v3 block inside `scoreDay`, `computeThermal`)
**Audience of this document:** us — **internal only, no public links to it from the site**. It is the specification we refine over time — every threshold below is a deliberate, editable decision, not a law of physics.
⚠️ Note: the file physically lives in the public GitHub Pages repo, so it is technically reachable by anyone who knows the path; if that matters, move it to a private location.

---

## 1. Philosophy

MeteoAI answers exactly one question:

> **"How likely is it that today's beginner course can fly?"**

It is *not* a weather report. `meteo.html` already shows the raw weather; MeteoAI is the instructor's gut feeling turned into a number — a **decision-support tool**, tuned for *beginner training operations* in Central Switzerland (Zugerberg, Brunni/Engelberg, Büelen/Wolfenschiessen, Niederbauen/Emmetten).

Design principles, in priority order:

1. **Explainability over accuracy.** A student must understand *why* the number is what it is in five seconds. We therefore show **only the deductions** — never a table of every parameter. A perfect day needs no explanation.
2. **Conservative by construction.** Every ambiguous signal costs points. External text warnings (MeteoSwiss bulletin keywords) can only *lower* the score, never raise it. Uncertainty itself is a deduction.
3. **Asymmetric penalties.** Heavy rain, föhn and thunderstorms are not "one bad category among five" — they end the day. A few clouds cost nothing. The penalty scale mirrors what actually cancels a course.
4. **Operational, not meteorological.** Rain at 18:30 is irrelevant; rain at 11:00 kills the core teaching block. Everything is weighted by *when* it hits the **course window 09:00–17:00** (9 possible flying hours).
5. **Site-aware.** The school can move. Each of the 4 launch sites gets its own score; the day's number is the **best usable site**.
6. **Transparent and tunable.** All constants live in one place in code, and in this document with their rationale.

What we deliberately did **not** build: a machine-learned model. With no labelled history of "did the course fly?", an opaque model cannot be debugged or trusted. v3 is a hand-crafted expert system; §8 describes how it can grow.

---

## 2. Data sources (unchanged from meteo.html)

v3 changes the *interpretation*, never the sources:

| Source | Used for |
|---|---|
| Open-Meteo **best match** (ICON blend) | wind at 10 m/120 m/925/850/800/700 hPa, T, RH, pressure, CAPE, precip probability, visibility, radiation |
| **ICON-CH1 + ICON-D2** (per launch site) | precipitation & thunderstorm cross-check — *model agreement is our confidence signal* |
| **MeteoSwiss text bulletin** (via our GitHub feed) | SHV "Alarmzeichen" keyword extraction (Kaltfront, Gewitter, Föhn, böig, …) |
| DWD front charts, profiwetter föhn/Bise/high-fog diagrams, XC-Therm wind map | shown raw on `meteo.html`; the numeric equivalents feed the score |
| Existing **föhn 4-signal diagnosis** (crest southerly · Δp Lugano–Zürich · shallow-föhn ΔT · valley breakthrough) | unchanged; v3 consumes its verdict |

---

## 3. The score: 100 − deductions

Each site starts at **100 %**. Every threat deducts points. Two situations bypass arithmetic entirely (**hard NO-GO → 0 %**):

* **Clear föhn** — modelled valley breakthrough in a föhn corridor, or a ≥30 km/h crest southerly backed by pressure (Δp ≥ 2 hPa) or the shallow-föhn ΔT signature.
* **Rain through most of the course day** — expected wet hours ≥ 6 of 9, or clear rain 08–15 h in *both* high-res models.

Why hard zeros? Because no combination of positives buys back a föhn breakthrough. An additive model without floors produced the old failure mode ("80 % despite rain in 6 of 9 hours").

### 3.1 Rain — the expected-lost-hours model

The core fix of v3. For every hour *h* in 09–17 we estimate **p(h) = probability the hour is unusable**:

* start from the best-match precipitation probability `pp/100`;
* if **both** ICON-CH1 and ICON-D2 paint rain that hour → `p ≥ 0.85` (two independent 1–2 km models agreeing is near-certainty);
* if exactly **one** does → `p ≥ 0.4`;
* if **both are dry** → cap `p ≤ 0.35` (the coarse blend is outvoted);
* `p < 0.15` → 0 (background drizzle-probability noise).

Then **E = Σ p(h)** = expected lost hours out of 9, and the penalty is

```
rain penalty = min(55, E×9 + core×3 + heavy×4)
```

where `core` is the same sum restricted to **10–15 h** (the teaching block counts extra) and `heavy` is the count of hours with ≥1.2 mm in both models (or ≥2 mm in the blend). Timing is verbalised for the student: *"mainly after 15:00"*, *"mainly in the morning, drying later"*, *"between 12:00 and 17:00"*, *"possible most of the day"*. The longest run of hours with p < 0.3 becomes the **"driest window"** shown in the header.

Calibration example (the complaint that triggered v3): 60 % probability across 11–17 h with one wet model → E ≈ 4.2 → **−47 %**, day lands at ~53 % "Uncertain — decision on site". The old engine said 80 %.

### 3.2 Thunderstorms — model agreement decides

| Signal (09–19 h, per site) | Deduction |
|---|---|
| Thunder weather-code in **both** CH1 and D2 | **−45** |
| Thunder in **one** model | −28 |
| CAPE ≥ 1200 J/kg | −18 (overdevelopment warning) |
| CAPE ≥ 700 J/kg | −8 |
| (beyond high-res range: blend thunder −30, CAPE ≥ 1000 −14) | |

Storms are a top-tier penalty because a beginner gaggle cannot outrun a cell, and because gust fronts arrive *before* the rain.

### 3.3 Föhn — the biggest single penalty

* Clear föhn → **NO-GO, 0 %** (see above).
* Any föhn tendency (crest southerly ≥ 15 km/h, Δp ≥ 2 hPa, breakthrough signs) → **−28**.
* Shallow-föhn signature (south side ≥ 2 °C colder at pass height with air moving over) → **−35**, because models systematically underestimate this regime — and it additionally cuts confidence (§5).

### 3.4 Wind

Nationwide (Wolfenschiessen valley vs Zürich reference, 10 m / 1500 m / 3000 m, 08/12/15 h):

* strong at flying height or to the ground → **−40**;
* moderate aloft → −12.

Regional, per launch site (08–16 h, with the gust-plausibility rule: model gusts only count when the base wind supports them):

| Condition at launch | Deduction |
|---|---|
| mean 10 m wind ≥ 25 km/h | −50 |
| 20–25 km/h | −26 |
| 15–20 km/h | −13 |
| supported gusts ≥ 35 (base ≥ 12) | −20 |
| supported gusts ≥ 30 | −10 |
| **wrong direction** for the launch, ≥ 15 km/h | −35 |
| wrong direction, 8–15 km/h | −15 |
| afternoon build-up trend | −6 |

Wrong-direction wind is punished almost like strong wind: a moderate tailwind launch is not a launch.

### 3.5 Fronts, fog, small stuff

* Front passage expected → −35 · front influence possible → −12 (the front verdict already includes the MeteoSwiss text bump).
* Launch in cloud at midday → −28 · morning fog that clears → **−6 only** (it delays, it doesn't cancel).
* Plain cloud cover: **0**. Cloudiness without rain, storm or fog implications does not move the number — that was a v2 noise source.

### 3.6 The MeteoSwiss text as a tripwire

If the official bulletin mentions storm/shower keywords for the day and the *numbers found nothing*, we still deduct (−20 strong / −12 normal); same for valley-wind keywords (−8). Human forecasters see synoptic context the point extraction misses. The text can never *add* points.

---

## 4. Verdict bands

| Score | Light | Label |
|---|---|---|
| ≥ 75 % | 🟢 GO | Good chance of flying. |
| 60–74 % | 🟡 | Probably flyable — with limits. |
| 40–59 % | 🟡 | Uncertain — decision on site. |
| 15–39 % | 🔴 | Cancellation likely. |
| < 15 % / NO-GO | 🔴 | No flying today. |

The headline sentence is generated from the **largest deduction** ("Main concern: …") plus the driest window when relevant.

---

## 5. Confidence

Confidence measures **how much the algorithm trusts its own inputs** — and, new in v3, it costs points, because an uncertain marginal day must be planned as a worse day.

Start at 100, subtract:

| Reason | Penalty to confidence |
|---|---|
| Lead time (day 3 / day 4) | −10 / −20 |
| Site beyond ICON-CH1/D2 range (blend fallback) | −15 |
| CH1 vs D2 disagree on rain hours (≥ 3 h apart) | −10 |
| Model gusts implausible vs base wind | −10 |
| Shallow-föhn regime | −10 |

**≥ 80 = High · 55–79 = Medium · < 55 = Low.** Medium subtracts **4 %** from the day score, Low subtracts **10 %**, shown as an explicit deduction row ("Reduced forecast confidence") so the student sees that uncertainty itself is a reason for caution.

---

## 6. Thermal forecast (Engelberg / Brunni — first site)

A deliberately simple **parcel model** on ICON pressure-level data, inspired by the clarity of Burnair/XCTherm presentations but built for beginners: quality word first, numbers second, one hour-strip, no tables.

Per hour (08–19 h):

1. **Lapse rate** = (T₈₅₀ − T₇₀₀) / (z₇₀₀ − z₈₅₀) — the engine of the day (≈1500→3000 m layer).
2. **Thermal top** — a valley parcel (T₂ₘ + 2 °C trigger excess) rises along the dry adiabat (−9.8 °C/km) until it meets the model temperature profile (piecewise linear through 850/800/700 hPa, extrapolated above).
3. **Cloudbase** — blended Espy: `0.3 × baseSurf + 0.7 × base850`, where `baseSurf = valley elev + 125 × (T₂ₘ − Td₂ₘ)` and `base850` uses the dewpoint at 850 hPa (Magnus from T/RH) against the parcel temperature at that level. Rationale: after rain the valley floor is wet-biased and surface Espy underestimates the base by ~1000 m; the mixed layer carries ≈1500 m air, so its moisture dominates. The remaining low bias (~300 m on humid days vs ICON-D2 cloud water) is accepted — a lower promised base is the conservative direction for students. If base sits > 150 m above the thermal top → **blue thermals** (no cumulus marking).
4. **Peak climb** (m/s) — the maximum of the vertical profile:
   `climb = 1.9 × sun × lapseFactor × depthFactor` (realistic ceiling ≈ 2.5 m/s)
   * `sun` = **lagged** shortwave radiation / 620 (capped 1): weighted mean of the last 3 model hours (0.35·h + 0.40·h−1 + 0.25·h−2). The lag models ground heat storage — thermals peak 1–2 h after solar noon, which instantaneous radiation misses (this was why v1 peaked at 13–14 h while ICON-D2/XCTherm peak 15–16 h). Radiation already includes cloud shading. All times are **local (LT)** — Open-Meteo is fetched with `timezone=auto`;
   * `lapseFactor` = (lapse − 4)/3.2, clamped 0…1.2 → 4 °C/km is dead air, ≥ 7.8 is strong;
   * `depthFactor` grows with thermal top above launch (1800 m), clamped 0.15…1.1 — shallow convection means weak, broken climbs;
   * ×0.65 if wind at 2000 m ≥ 25 km/h, ×0.35 if ≥ 35 (shear breaks the columns);
   * capped at 0.3 in rain hours.
5. **Vertical climb profile** (for the time × altitude matrix): `w(z) = climb × g(x)/0.62` with `x = (z − valley)/(top − valley)` and `g(x) = x^⅓ · (1 − x²)` — zero at the ground, peak at ≈ 40 % of the thermal depth, zero at the top. This is the standard convective boundary-layer shape, normalised so the peak equals the hourly climb value.

Aggregation: **thermal window** = hours with climb ≥ 0.4 · **best window** = longest run ≥ max(0.6, 70 % of the day's peak) · **usable height** = min(cloudbase, thermal top).

**Quality** (Poor / Fair / Good / Excellent): Excellent ≥ 2.0 m/s peak over ≥ 5 h · Good ≥ 1.3 · Fair ≥ 0.6 — then *downgraded* one step for strong wind aloft or shower risk, and capped at Fair under any föhn tendency. When the day score is < 20 % the card states plainly that thermal quality is academic.

**Confidence:** High for day 0–1, Medium day 2, Low from day 3 (or downgraded when day confidence is Low).

**Calibration reference (2026-07-19, vs XCTherm/ICON-D2 "Urner Alpen"):** rain until ~10:30 ✓, thermal start 11 h ✓, peak 1.8 m/s @13–14 h (XCTherm 1.4–1.5) ✓, tops ~2700 m (XCTherm ~2800) ✓, base 2200 m (XCTherm 2500–2800 — our known low bias, see blend above). Recheck against XCTherm after any retune.

Known simplifications (accepted for v1 of the feature): no CIN handling, no inversion-sniffing beyond the 3 pressure levels, fixed +2 °C trigger excess, cloudbase still ~300 m low on wet days. The emagram link on the card is the cross-check.

---

## 7. UI contract

* **One hero answer**: percentage + label + "Main concern: …" + confidence + driest window. (The best site is deliberately *not* in the hero — it lives in the site-comparison box; the hero answers only "can we fly?".)
* **Only negatives explained**: the deduction list *is* the reasoning. A clean day shows a single green line.
* **No parameter tables, no per-category cards.** Site comparison is a collapsed details element.
* Thermal card: quality pill, 4 stat tiles, and a **time × altitude matrix** (XCTherm-inspired, beginner-clean): rows = 200 m altitude bands from the valley (1000 m) up to the day's tops, ▲ marks the Brunni launch row, columns = hours 08–19 LT. Each cell prints the expected climb at that height from the vertical profile (single-hue ramp — information never by colour alone), ☁ cells above cloudbase, ☔ columns for rain hours, ⚡ in the top row for hours with CAPE ≥ 800 and precip probability ≥ 30 % (thunderstorm risk marker — the full storm assessment lives in the flyability score). Horizontal scroll on narrow screens.
* **Transparency**: the thermal card and the site-comparison box each carry an ⓘ info toggle stating the exact inputs and formulas, with the explicit guarantee that every number is computed from the current model run — nothing is hand-set or invented. This document itself is NOT linked from the public pages.
* **Disclaimers**: the hero card and the thermal card each carry an explicit disclaimer — experimental algorithm, work in progress, education/entertainment only, never a green light, no flight decision may be based on these numbers.
* Raw data remains one click away (`meteo.html`), same day pre-selected. The student workflow stays: *analyse raw first, then compare*.

---

## 8. Tuning & roadmap

**How to tune:** every constant in §3–§6 maps 1:1 to a literal in the v3 block of `meteo-core.js`. Change → reload → the deduction list shows the new behaviour immediately. The scenario harness used during development (clean day / rain-risk / steady rain / föhn / storm / windy / stable) is the reference set: any retune should keep A=100, C=D=0, and B in the 45–60 band.

**Planned refinements:**

1. **Verification loop** — log each day's predicted % and the actual "did we fly?" outcome (one boolean per day in a small JSON feed); after a season, recalibrate the penalty weights against reality.
2. **More thermal sites** — `THERM_PT` becomes an array (Zugerberg, Niederbauen, …); computation is already per-point. Site-specific trigger excess and launch heights.
3. **Per-hour flyability strip** for the day score (the rain/föhn hourly signals already exist) — "flyable 09–12, then deteriorating".
4. **Student-level switch** — the same deductions with stricter thresholds for first-flight students vs. licence candidates.
5. **Ensemble spread** as a confidence input (Open-Meteo ensemble API) instead of the CH1-vs-D2 proxy only.
6. **Bise handling** as an explicit deduction (currently folded into nationwide/regional wind and text keywords).

**Non-goals:** replacing pilot judgement, XC forecasting, and any presentation that needs a meteorology lecture to read.

---

*v3 · 2026-07 · FLYwithMIKI — decision support only. YOU are the pilot, YOU decide.*
