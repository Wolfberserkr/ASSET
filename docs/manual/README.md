# A.S.S.E.T. User Manual — source

`index.html` is the source of the printed manual. It is a single self-contained page
(styles inline, screenshots in `img/`) designed for A4 print via Chromium.

- **Output:** `../ASSET-User-Manual-v2.pdf` (55 pages)
- **Audit trail for this edition:** `AUDIT-NOTES.md`

## Editing

Edit `index.html` directly. Conventions:

- `h2.sec` starts a numbered section on a new page; add `cont` to keep it on the current page
  (used right after a part divider).
- Callouts: `.callout` (tip, blue), `.callout.note` (violet), `.callout.important` (amber),
  `.callout.fixed` (green — a correction to v1.0), `.callout.danger` (red).
- `.formula` is the dark "How it is calculated" box — use it whenever a number needs an exact rule.
- Figures use `<figure><div class="shot"><img …></div><figcaption>…</figcaption></figure>`.
  Screenshots are 1500 × 938 captures of the live app at 1× and are capped at 156 mm wide so two
  fit on a page.

## Re-rendering the PDF

Any Chromium print-to-PDF will work. With Playwright:

```js
// render.mjs — node render.mjs docs/manual/index.html docs/ASSET-User-Manual-v2.pdf
import { chromium } from 'playwright-core'
const [,, src, out] = process.argv
const browser = await chromium.launch()
const page = await browser.newPage()
await page.goto('file://' + src, { waitUntil: 'networkidle' })
await page.emulateMedia({ media: 'print' })
await page.pdf({
  path: out,
  format: 'A4',
  printBackground: true,
  displayHeaderFooter: true,
  headerTemplate: '<div></div>',
  footerTemplate: `<div style="width:100%;font-family:Arial,sans-serif;font-size:7pt;color:#8a93a3;
    padding:0 15mm;display:flex;justify-content:space-between;">
    <span>A.S.S.E.T. — User Manual &amp; Management Guide · v2.0 · July 2026</span>
    <span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
  margin: { top: '16mm', bottom: '18mm', left: '15mm', right: '15mm' },
})
await browser.close()
```

Or, without Playwright:

```sh
chromium --headless --no-pdf-header-footer --print-to-pdf=docs/ASSET-User-Manual-v2.pdf \
  file://$PWD/docs/manual/index.html
```

(the CLI route loses the page-number footer).

## Keeping it accurate

The manual states thresholds and formulas that live in code and in the database
(`recertification_rules`, `games.practice_only`, `sessionDraw.js`, `decayUtils.js`,
`Completion.jsx`, the reporting RPCs in `supabase/`). If any of those change, update §11 and §15
first — they are the single source of truth the rest of the document points at — then re-render.
