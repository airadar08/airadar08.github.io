"""AI Radar repo card (1080x1350, same brand as the notes/cheatsheet cards).
Usage: python3 render_repo.py repo.json out.png   -> out.png, out.jpg, out.baked.html (script-free, for posting)
repo.json: {"slot": 0-7, "repo": "owner/name", "tagline": "one line, what it is",
  "stats": [{"big": "12.4k", "label": "GitHub stars"}, ... up to 4],
  "what": ["what it does", ...3], "good_for": ["use case", ...2-3],
  "try": "pip install x   (optional, one short command)", "read": "honest one-line verdict"}"""
import json, sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from render_cheatsheet import THEMES, RADAR, fmt, bake


def build(d):
    # Fixed dark "terminal" theme for every repo card (distinct from cheatsheets and the colour-rotating news cards).
    name, bg, acc, lbl, hl, line, muted = "Repo", "#121417", "#34c98a", "#6fdcaa", "#1f5a43", "#2a2e33", "#9a9d9f"
    surface, ink = "#1b1e22", "#f1efe8"
    owner, _, repo = d["repo"].partition("/")
    stats = "".join(f'<div class="st"><b>{fmt(s["big"])}</b><span>{fmt(s["label"])}</span></div>' for s in d.get("stats", [])[:4])
    def sec(title, items):
        if not items: return ""
        return f'<h2>{fmt(title)}</h2>' + "".join(f'<div class="li"><i>•</i><div>{fmt(x)}</div></div>' for x in items[:3])
    tryit = f'<h2>Try it</h2><div class="cmd">{fmt(d["try"])}</div>' if d.get("try") else ""
    read = f'<div class="read"><span>Our read:</span> {fmt(d["read"])}</div>' if d.get("read") else ""
    return f"""<html><head><meta charset="utf-8"><style>
*{{box-sizing:border-box;margin:0;padding:0}}
html{{font-size:10px}}
html,body{{width:1080px;height:1350px;font-family:"Inter",sans-serif;-webkit-font-smoothing:antialiased;overflow:hidden}}
body{{background:{bg};color:{ink};position:relative}}
.bar{{height:104px;display:flex;align-items:center;justify-content:space-between;padding:0 64px;border-bottom:1px solid {line}}}
.back{{color:{acc};font-size:32px;font-weight:600}}
.wrap{{position:absolute;top:104px;left:0;right:0;bottom:96px;padding:4rem 6.8rem 0;overflow:hidden}}
.kick{{margin-bottom:1.6rem}}.pill{{display:inline-block;border:1px solid {acc};color:{lbl};font-size:1.9rem;font-weight:700;letter-spacing:.16rem;text-transform:uppercase;padding:.7rem 1.4rem;border-radius:999px;font-family:"JetBrains Mono",ui-monospace,Menlo,monospace}}
.own{{font-size:2.8rem;color:{muted};font-weight:600;margin-bottom:.2rem}}
h1{{font-size:6.2rem;line-height:1.02;font-weight:800;letter-spacing:-.15rem;margin-bottom:1.4rem;word-break:break-word}}
.tag{{font-size:2.9rem;line-height:1.3;margin-bottom:2.8rem;color:{ink}}}
.grid{{display:grid;grid-template-columns:1fr 1fr;gap:1.6rem;margin-bottom:2.8rem}}
.st{{background:{surface};border:1px solid {line};border-radius:2.2rem;padding:1.8rem 2.4rem}}
.st b{{display:block;font-size:4.4rem;font-weight:800;letter-spacing:-.1rem}}
.st span{{font-size:2.2rem;color:{muted};line-height:1.3}}
h2{{font-size:2.3rem;font-weight:700;color:{lbl};letter-spacing:.1rem;text-transform:uppercase;margin:.4rem 0 1.1rem}}
.li{{display:flex;gap:1.6rem;font-size:2.7rem;line-height:1.35;margin-bottom:.9rem}}.li i{{font-style:normal;color:{acc};font-weight:800}}
.li + h2{{margin-top:2rem}}
.cmd{{font-family:"JetBrains Mono",ui-monospace,Menlo,monospace;font-size:2.5rem;background:#0b0c0e;color:{acc};border:1px solid {line};border-radius:1.6rem;padding:1.6rem 2.2rem;margin-bottom:.6rem;word-break:break-all}}
.read{{margin-top:2.4rem;font-size:2.9rem;font-weight:600;line-height:1.35}}.read span{{color:{acc}}}
.foot{{position:absolute;bottom:0;left:0;right:0;height:96px;border-top:1px solid {line};display:flex;align-items:center;justify-content:space-between;padding:0 68px;color:{muted};font-size:22px}}
.brand{{display:flex;align-items:center;gap:12px;color:{ink};font-weight:700;font-size:26px}}
.url{{display:flex;align-items:center;gap:10px;color:{ink};font-weight:600}}
</style></head><body>
<div class="bar"><div class="back">‹ AI Radar Repos</div>{RADAR.format(w=72)}</div>
<div class="wrap" id="w"><div class="kick"><span class="pill">★ Trending on GitHub</span></div>
<div class="own">{fmt(owner)} /</div><h1>{fmt(repo)}</h1><div class="tag">{fmt(d.get("tagline",""))}</div>
<div class="grid">{stats}</div>{sec("What it does", d.get("what"))}{sec("Good for", d.get("good_for"))}{tryit}{read}</div>
<div class="foot"><div class="brand">{RADAR.format(w=54)} @ai_radar_</div><div class="url">github.com/{fmt(d["repo"])}</div></div>
<script>
const w=document.getElementById('w');let s=10;
while(w.scrollHeight>w.clientHeight && s>6.5){{s-=0.25;document.documentElement.style.fontSize=s+'px';}}
</script></body></html>""", name

def render(d, out):
    from playwright.sync_api import sync_playwright
    page_html, name = build(d)
    tmp = pathlib.Path(out).with_suffix(".html"); tmp.write_text(page_html, encoding="utf-8")
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_page(viewport={"width": 1080, "height": 1350})
        pg.goto(tmp.resolve().as_uri()); pg.wait_for_timeout(500); pg.screenshot(path=out)
        fs = float(pg.evaluate("parseFloat(getComputedStyle(document.documentElement).fontSize)")); b.close()
    pathlib.Path(out).with_suffix(".baked.html").write_text(bake(page_html, fs), encoding="utf-8")
    from PIL import Image
    Image.open(out).convert("RGB").save(pathlib.Path(out).with_suffix(".jpg"), quality=88, optimize=True)
    return name, fs

if __name__ == "__main__":
    print("theme, font:", render(json.loads(pathlib.Path(sys.argv[1]).read_text(encoding="utf-8")), sys.argv[2]))
