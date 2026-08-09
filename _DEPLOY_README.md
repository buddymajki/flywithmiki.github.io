# topublish — deployable FLYwithMIKI website

Generated 2026-08-07 from `website/`. This folder is **exactly** what should go live —
nothing here is unused, nothing needed is missing.

**Delete this file before/after deploying** (it is internal notes, not site content).

## What is in here

92 files, ~64 MB. 50 MB of that is the two full promo videos
(`video/promo_16x9.mp4`, `video/promo_9x16.mp4`) referenced by the home pages.

| Group | Files |
|---|---|
| Public HTML pages | 18 (EN) + 3 (DE) |
| Hidden pages (noindex, direct URL only) | `flightdeck.html`, `shv-calc.html`, `startleiter.html` |
| Images (`Images_v2/`) | 46 — only those actually referenced |
| Video | 6 |
| Icons / manifest | `favicon.ico`, `favicon-16x16.png`, `favicon-32x32.png`, `apple-touch-icon.png`, `android-chrome-192x192.png`, `android-chrome-512x512.png`, `site.webmanifest` |
| Meteo assets | `meteo.css`, `meteo-core.js` |
| Infra | `CNAME`, `_config.yml`, `.gitignore`, `robots.txt`, `sitemap.xml`, `llms.txt`, `dyq6v8m67v5rcyweuwfe72z4q4vfdv5p.txt` (domain-verification file — do not delete) |

## Deliberately NOT copied

- `admin.html` — publicly readable admin dashboard that pulls **all student data** from a
  hardcoded Google Apps Script URL. Left offline on purpose. Put it behind auth before it goes live again.
- `pure.html` — empty test file.
- `PXL_20260509_091754277.MP.jpg` — 7.4 MB stray photo at site root.
- `meteoinfo.md`, `meteoAI.md` — internal specs, not fetched at runtime.
- 47 unreferenced images/CSS in `Images_v2/` (~15 MB), incl. local `w3.css` / `app_min.css`
  copies (the site loads w3.css from the w3schools CDN instead).

All of these still exist untouched in `website/` — nothing was deleted.

## Note

`Images_v2/winter2024.webp` is copied because `school.html` still contains the
commented-out winter-discount banner. Keep it if you plan to re-enable that banner.
