"""News card (the "AI Radar Notes" style): python3 tools/render_news.py news.json card.png
Writes card.png, card.jpg and card.baked.html (the baked file is what tools/post_x.js posts).
news.json: {"kicker": "AI agents · Coding", "title": "<max ~60 chars>",
  "stats": [4 x {"big": "Oct 23", "label": "Computer Use announced"}],
  "sections": [2 x {"heading": "How it works", "items": [2-3 short lines]}],
  "read": "<one-line takeaway>", "sources": "Cursor, Flavio Copes"}
"""
import json, sys, html, re, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from render_cheatsheet import THEMES, RADAR, bake
def fmt(t): return re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", html.escape(str(t)))
def build(c):
    name, bg, acc, lbl, hl, line, muted = "Resources", "#fbf8f1", "#13a36b", "#0b7a4f", "#b9f2d6", "#e9e3d4", "#6b6a63"  # fixed AI Radar house look (same as cheatsheets)
    stats = "".join(f'<div class="st"><b>{fmt(s["big"])}</b><span>{fmt(s["label"])}</span></div>' for s in c["stats"])
    secs = "".join(f'<h2>{fmt(s["heading"])}</h2>' + "".join(f'<div class="li"><i>•</i><div>{fmt(x)}</div></div>' for x in s["items"]) for s in c["sections"])
    return f"""<html><head><meta charset="utf-8"><style>
*{{box-sizing:border-box;margin:0;padding:0}}
html{{font-size:10px}}
html,body{{width:1080px;height:1350px;font-family:"Inter",sans-serif;-webkit-font-smoothing:antialiased;overflow:hidden}}
body{{background:{bg};color:#1d1d1f;position:relative}}
.bar{{height:104px;display:flex;align-items:center;justify-content:space-between;padding:0 64px;border-bottom:1px solid {line}}}
.back{{color:{acc};font-size:32px;font-weight:600}}
.wrap{{position:absolute;top:104px;left:0;right:0;bottom:96px;padding:4rem 6.4rem 0;overflow:hidden}}
.kick{{margin-bottom:1.8rem}}.kick em{{display:inline-block;font-style:normal;background:{acc};color:#fff;font-size:2.1rem;font-weight:800;letter-spacing:.2rem;text-transform:uppercase;padding:.8rem 1.6rem;border-radius:1.1rem}}
h1{{font-size:6.4rem;line-height:1.06;font-weight:900;letter-spacing:-.2rem;margin-bottom:3.2rem}}
.grid{{display:grid;grid-template-columns:1fr 1fr;gap:2rem;margin-bottom:3.2rem}}
.st{{background:#fff;border:1px solid {line};border-radius:2rem;padding:2.2rem 2.8rem}}
.st b{{display:block;font-size:4.4rem;font-weight:800;letter-spacing:-.1rem;line-height:1.1}}
.st span{{display:block;font-size:2.1rem;color:{muted};margin-top:.4rem}}
h2{{font-size:2.1rem;font-weight:800;color:{lbl};letter-spacing:.2rem;text-transform:uppercase;margin:1rem 0 1.2rem}}
.li{{display:flex;gap:1.6rem;font-size:2.7rem;line-height:1.35;margin-bottom:.8rem}}
.li i{{font-style:normal;color:{acc};font-weight:800}}
.read{{margin-top:2.4rem;font-size:2.9rem;font-weight:600;line-height:1.35;background:#1d1d1f;color:#fff;border-radius:2rem;padding:2rem 2.6rem}}.read span{{color:{acc};font-weight:800;margin-right:.4rem}}
.foot{{position:absolute;bottom:0;left:0;right:0;height:96px;border-top:1px solid {line};display:flex;align-items:center;justify-content:space-between;padding:0 68px;color:#8e8a80;font-size:24px}}
.brand{{display:flex;align-items:center;gap:12px;color:#1d1d1f;font-weight:700;font-size:28px}}
</style></head><body>
<div class="bar"><div class="back">‹ AI Radar Notes</div>{RADAR.format(w=72)}</div>
<div class="wrap" id="w"><div class="kick"><em>{fmt(c["kicker"])}</em></div><h1>{fmt(c["title"])}</h1>
<div class="grid">{stats}</div>{secs}<div class="read"><span>Our read:</span> {fmt(c["read"])}</div></div>
<div class="foot"><div class="brand">{RADAR.format(w=54)} @ai_radar_</div><div>Sources: {fmt(c["sources"])}</div></div>
<script>
const w=document.getElementById('w');let s=10;document.documentElement.style.fontSize=s+'px';
while(w.scrollHeight>w.clientHeight && s>6){{s-=0.25;document.documentElement.style.fontSize=s+'px';}}
</script></body></html>"""
def render(c, out):
    from playwright.sync_api import sync_playwright
    page = build(c); tmp = pathlib.Path(out).with_suffix(".html"); tmp.write_text(page, encoding="utf-8")
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_page(viewport={"width":1080,"height":1350})
        pg.goto(tmp.resolve().as_uri()); pg.wait_for_timeout(500); pg.screenshot(path=out)
        fs = float(pg.evaluate("parseFloat(getComputedStyle(document.documentElement).fontSize)")); b.close()
    pathlib.Path(out).with_suffix(".baked.html").write_text(bake(page, fs), encoding="utf-8")
    from PIL import Image
    Image.open(out).convert("RGB").save(pathlib.Path(out).with_suffix(".jpg"), quality=88, optimize=True)
    print(out, "font", fs)
if __name__ == "__main__":
    render(json.loads(pathlib.Path(sys.argv[1]).read_text()), sys.argv[2])
