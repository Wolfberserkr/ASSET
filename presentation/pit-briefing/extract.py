"""Extract per-slide geometry + computed type styles, and render text-free background plates."""
import json, pathlib
from playwright.sync_api import sync_playwright

HERE = pathlib.Path(__file__).parent
BG   = HERE/"bg";  BG.mkdir(exist_ok=True)
CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"

# Kept baked into the background plate (gradient-clipped text / pure decoration).
SKIP = ".divider .num"

JS_EXTRACT = r"""
(skipSel) => {
  const slides = [...document.querySelectorAll('section.slide')];
  const hasDirectText = el =>
    [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length);

  return slides.map(slide => {
    const sr = slide.getBoundingClientRect();
    const rel = r => ({x: r.left - sr.left, y: r.top - sr.top, w: r.width, h: r.height});

    // ---- images ----
    const images = [...slide.querySelectorAll('img')].map(im => ({
      src: im.getAttribute('src'), ...rel(im.getBoundingClientRect())
    }));

    // ---- text blocks ----
    const skip = new Set([...slide.querySelectorAll(skipSel)]);
    const blocks = [];
    const chosen = [];   // outermost text blocks only — inline descendants become runs
    slide.querySelectorAll('*').forEach(el => {
      if (el.closest('svg')) return;
      if (skip.has(el) || [...skip].some(s => s.contains(el))) return;
      if (chosen.some(c => c.contains(el))) return;
      if (!hasDirectText(el)) return;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const cs = getComputedStyle(el);

      // inline runs, carrying bold + colour from the nearest styled ancestor
      const runs = [];
      (function walk(node){
        for (const n of node.childNodes) {
          if (n.nodeType === 3) {
            const t = n.textContent.replace(/\s+/g,' ');
            if (!t.trim() && !runs.length) continue;
            const pcs = getComputedStyle(n.parentElement);
            runs.push({
              text: t,
              bold: parseInt(pcs.fontWeight,10) >= 600,
              italic: pcs.fontStyle === 'italic',
              color: pcs.color,
              family: pcs.fontFamily,
            });
          } else if (n.nodeType === 1) {
            if (n.tagName === 'BR') { runs.push({br: true}); continue; }
            if (getComputedStyle(n).display !== 'inline') continue;  // block child = its own box
            walk(n);
          }
        }
      })(el);
      if (!runs.length) return;
      chosen.push(el);

      blocks.push({
        ...rel(r),
        padL: parseFloat(cs.paddingLeft)||0, padR: parseFloat(cs.paddingRight)||0,
        padT: parseFloat(cs.paddingTop)||0,  padB: parseFloat(cs.paddingBottom)||0,
        tag: el.tagName.toLowerCase(),
        cls: el.className ? String(el.className) : '',
        fontSize: parseFloat(cs.fontSize),
        lineHeight: cs.lineHeight === 'normal' ? parseFloat(cs.fontSize)*1.2 : parseFloat(cs.lineHeight),
        letterSpacing: cs.letterSpacing === 'normal' ? 0 : parseFloat(cs.letterSpacing),
        align: cs.textAlign,
        transform: cs.textTransform,
        family: cs.fontFamily,
        runs,
      });
    });
    return {id: slide.id, blocks, images};
  });
}
"""

with sync_playwright() as p:
    b  = p.chromium.launch(executable_path=CHROME,
                           args=["--force-color-profile=srgb","--font-render-hinting=none"])
    pg = b.new_page(viewport={"width":1920,"height":1080}, device_scale_factor=2)
    pg.goto((HERE/"slides.html").as_uri())
    pg.wait_for_timeout(2500)

    data = pg.evaluate(JS_EXTRACT, SKIP)
    (HERE/"layout.json").write_text(json.dumps(data, indent=1))
    print("slides:", len(data),
          "| text blocks:", sum(len(s["blocks"]) for s in data),
          "| images:", sum(len(s["images"]) for s in data))

    # ---- background plates: text transparent, screenshots hidden ----
    pg.add_style_tag(content="""
      section.slide *:not(.divider .num){ color: transparent !important; }
      section.slide .divider .num, section.slide .num{ color: transparent !important; }
      section.slide img{ visibility: hidden !important; }
    """)
    pg.wait_for_timeout(600)
    for s in data:
        pg.locator(f"#{s['id']}").screenshot(path=str(BG/f"{s['id']}.png"))
    print("background plates ->", BG)
    b.close()
