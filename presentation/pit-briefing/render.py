import os, sys, pathlib
from playwright.sync_api import sync_playwright

HERE = pathlib.Path(__file__).parent
OUT  = HERE / "png"
OUT.mkdir(exist_ok=True)
CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, args=["--force-color-profile=srgb","--font-render-hinting=none"])
    pg = b.new_page(viewport={"width":1920,"height":1080}, device_scale_factor=2)
    pg.goto((HERE/"slides.html").as_uri())
    pg.wait_for_timeout(2500)

    pg.evaluate(pathlib.Path(HERE/'decorate.js').read_text())
    pg.wait_for_timeout(300)
    ids = pg.eval_on_selector_all("section.slide", "els => els.map(e => e.id)")
    print(f"slides: {len(ids)}")

    # overflow audit — content escaping the 1920x1080 frame
    report = pg.evaluate("""() => {
      const out = [];
      document.querySelectorAll('section.slide').forEach(s => {
        const sr = s.getBoundingClientRect();
        const issues = [];
        if (s.scrollHeight > s.clientHeight + 2) issues.push(`scrollH ${s.scrollHeight}>${s.clientHeight}`);
        if (s.scrollWidth  > s.clientWidth  + 2) issues.push(`scrollW ${s.scrollWidth}>${s.clientWidth}`);
        s.querySelectorAll('*').forEach(el => {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) return;
          const relB = r.bottom - sr.top, relR = r.right - sr.left;
          if (relB > 1081) issues.push(`${el.tagName}.${el.className||''} bottom ${Math.round(relB)}`);
          if (relR > 1921) issues.push(`${el.tagName}.${el.className||''} right ${Math.round(relR)}`);
        });
        if (issues.length) out.push({id: s.id, issues: [...new Set(issues)].slice(0,6)});
      });
      return out;
    }""")
    if report:
        print("\n!! OVERFLOW:")
        for r in report: print(" ", r["id"], r["issues"])
    else:
        print("no overflow detected")

    # footer collision check: does any content sit under the footer band?
    coll = pg.evaluate("""() => {
      const out=[];
      document.querySelectorAll('section.slide').forEach(s=>{
        const f=s.querySelector('.foot'); if(!f) return;
        const sr=s.getBoundingClientRect(), fr=f.getBoundingClientRect();
        const ftop=fr.top-sr.top-14;
        s.querySelectorAll('.grow *, .head *, .callout, .card, table, .fig').forEach(el=>{
          const r=el.getBoundingClientRect(); if(!r.height) return;
          if (r.bottom-sr.top > ftop) out.push(`${s.id}: ${el.tagName}.${(el.className||'').toString().slice(0,24)}`);
        });
      });
      return [...new Set(out)];
    }""")
    if coll:
        print("\n!! FOOTER COLLISION:"); [print("  ", c) for c in coll[:24]]
    else:
        print("no footer collisions")

    for i, sid in enumerate(ids, 1):
        pg.locator(f"#{sid}").screenshot(path=str(OUT/f"slide-{i:02d}.png"))
    print(f"\nrendered {len(ids)} -> {OUT}")
    b.close()
