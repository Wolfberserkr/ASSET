# A.S.S.E.T. — Pit Operations Briefing

A 24-slide executive briefing on A.S.S.E.T., aimed at the Head of Pit Operations.
Informational: it requests no budget, headcount, or sign-off.

**Deliverable:** `ASSET-Pit-Operations-Briefing.pptx` — 16:9 (13.333in × 7.5in),
speaker notes on all 24 slides.

> The PPTX is **not tracked in git** — see `.gitignore`. Git stores binaries
> whole, so committing each rebuild would add another full ~19 MB to the repo
> permanently. Run the two commands under [Rebuild](#rebuild) to produce it.

## How it is built

Slides are hand-authored HTML rendered to PNG through headless Chromium, then
assembled into a PPTX with each slide as a full-bleed image. This buys exact
control over the brand palette and screenshot placement that a template engine
does not give.

| File | Role |
|---|---|
| `slides.html` | All 24 slides, one `<section class="slide">` each |
| `style.css` | Design system — brand tokens, type scale, slide layouts |
| `render.py` | Renders each slide to `png/slide-NN.png` at 3840×2160, and audits layout |
| `build_pptx.py` | Downscales to 2560×1440, assembles the PPTX, attaches speaker notes |
| `img/` | Screenshots extracted from the User Manual PDF (`*_c.png` = content-cropped) |
| `fonts/` | Inter + Space Mono, copied from `src/assets/fonts/` |

### Rebuild

```bash
pip install playwright python-pptx pillow numpy
python3 render.py      # -> png/slide-01.png … slide-24.png
python3 build_pptx.py  # -> ASSET-Pit-Operations-Briefing.pptx
```

`render.py` expects Chromium at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`.
Change `CHROME` at the top of the file for a different machine, or run
`playwright install chromium` and drop the `executable_path` argument.

### The layout audit

`render.py` fails loudly rather than silently shipping a broken slide. After
rendering it reports:

- **Overflow** — any element whose box escapes the 1920×1080 frame
- **Footer collision** — any content overlapping the footer band

Both must print clean. They caught a real bug during authoring: `.row` did not
set `flex-direction`, so `.grow`'s `column` won on every `class="row grow"`
slide and stacked figures on top of their text.

## Design notes

Brand tokens are taken from `src/index.css` (the `@theme` block), not sampled
from screenshots, so the deck matches the running application exactly:

| Token | Use |
|---|---|
| `#10172e` | Slide ground |
| `#151d38` / `#223052` | Card fill / border |
| `#4fa8ff` | Eyebrows, keys, primary accent |
| `#38d6c4` | Positive figures |
| `#d4a843` | Callouts, and "practice-only / built-but-unused" flags |
| `#ff7a70` | Negative figures |
| `#2e6bff → #7a4dff` | Section numbers, bullets, pool bars |

Headings are the highest-contrast element on the slide (`#f4f7fb`), above body
text — the reverse washes out under projector light.

## Caveats for whoever presents this

1. **The figures are from User Manual v1.0 (July 2026)** — 693 active questions,
   the per-game pool on slide 23, and 10 + 10 drill-takers. Pool counts move as
   questions are added or retired. Check Question Stats and the live roster
   before presenting.

2. **This argues capability, not measured outcomes.** Nothing in the deck claims
   an accuracy or readiness improvement, because pre/post-training comparison
   reporting is not built (slide 23 says so outright). If asked "what did it
   actually do for Surveillance?", that is the honest answer.

3. **Screenshots use demonstration data** — fictional names, seeded sessions.
   Slide 12 carries this disclaimer on-slide.
