import json, sys, html, re, pathlib
THEMES = [  # name, paper, accent, label, highlighter, line, muted
    ("Sunflower", "#fbf8f1", "#d9a400", "#b58900", "#ffe27a", "#ece6d8", "#6e6a60"),
    ("Mint",      "#f2f9f5", "#13a36b", "#0d8a59", "#b9f2d6", "#d7ebe0", "#5c6e66"),
    ("Sky",       "#f3f7fd", "#2f7ae5", "#1f63c6", "#cfe2ff", "#dde6f4", "#5d6a7e"),
    ("Lavender",  "#f7f4fd", "#7c5ce0", "#6644cc", "#e2d8ff", "#e6def7", "#685f7c"),
    ("Coral",     "#fdf5f2", "#e8613c", "#cc4b28", "#ffd6c8", "#f2e0d9", "#7a645d"),
    ("Graphite",  "#f4f4f2", "#ff7a1a", "#e0650a", "#ffd9b8", "#e2e2de", "#62625e"),
    ("Teal",      "#f0f8f9", "#0e9aa7", "#0a7f8a", "#bfeef2", "#d6eaec", "#5a6d70"),
    ("Rose",      "#fdf3f6", "#e0457b", "#c43466", "#ffd1e0", "#f3dde5", "#7a6068"),
]
RADAR = '<svg viewBox="0 0 400 400" width="{w}" height="{w}"><circle cx="200" cy="200" r="194" fill="#13a36b" stroke="#0f8a5a" stroke-width="8"/><g transform="translate(189 195) scale(0.74) translate(-224 -166)"><text x="182" y="285" text-anchor="middle" font-family="Inter,Helvetica,Arial,sans-serif" font-weight="900" font-size="230" letter-spacing="-10" fill="#ffffff">a</text><rect x="268" y="160" width="40" height="125" rx="6" fill="#ffffff"/><circle cx="288" cy="112" r="24" fill="#1d1d1f"/><path d="M299.4 69.5 A44 44 0 0 1 330.5 100.6" stroke="#1d1d1f" stroke-width="7" fill="none" stroke-linecap="round" opacity="0.85"/><path d="M305.1 48.2 A66 66 0 0 1 351.8 94.9" stroke="#1d1d1f" stroke-width="7" fill="none" stroke-linecap="round" opacity="0.55"/></g></svg>'
def fmt(t):
    t = html.escape(str(t))
    return re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", t)
def block(b, acc, lbl, line, muted):
    h = f'<h2>{fmt(b["heading"])}</h2>'
    t = b.get("type", "list")
    if t == "table":
        head = "".join(f"<th>{fmt(c)}</th>" for c in b["cols"])
        rows = "".join("<tr>" + "".join(f"<td>{fmt(c)}</td>" for c in r) + "</tr>" for r in b["rows"])
        body = f'<table><tr>{head}</tr>{rows}</table>'
    elif t == "steps":
        body = "".join(f'<div class="li"><i class="n">{n}</i><div>{fmt(x)}</div></div>' for n, x in enumerate(b["items"], 1))
    else:
        body = "".join(f'<div class="li"><i>•</i><div>{fmt(x)}</div></div>' for x in b["items"])
    return f'<section>{h}{body}</section>'


def build(sheet):
    # Fixed theme for every cheatsheet: same look as the "50 AI prompts" resource cover (cream, mint, dark callout).
    name, bg, acc, lbl, hl, line, muted = "Resources", "#fbf8f1", "#13a36b", "#0b7a4f", "#b9f2d6", "#e9e3d4", "#6b6a63"
    blocks = "".join(block(b, acc, lbl, line, muted) for b in sheet["blocks"])
    tip = f'<div class="tip"><span>Remember:</span> {fmt(sheet["tip"])}</div>' if sheet.get("tip") else ""
    sub = f'<div class="sub">{fmt(sheet["subtitle"])}</div>' if sheet.get("subtitle") else ""
    return f"""<html><head><meta charset="utf-8"><style>
*{{box-sizing:border-box;margin:0;padding:0}}
html{{font-size:10px}}
html,body{{width:1080px;height:1350px;font-family:"Inter",sans-serif;-webkit-font-smoothing:antialiased;overflow:hidden}}
body{{background:{bg};color:#1d1d1f;position:relative}}
.bar{{height:104px;display:flex;align-items:center;justify-content:space-between;padding:0 64px;border-bottom:1px solid {line}}}
.back{{color:{acc};font-size:32px;font-weight:600}}
.wrap{{position:absolute;top:104px;left:0;right:0;bottom:96px;padding:3.6rem 5.2rem 0;overflow:hidden}}
.kick{{margin-bottom:1.4rem}}.kick em{{display:inline-block;font-style:normal;background:{acc};color:#fff;font-size:1.9rem;font-weight:800;letter-spacing:.16rem;text-transform:uppercase;padding:.7rem 1.4rem;border-radius:1rem}}
h1{{font-size:5.8rem;line-height:1.02;font-weight:900;letter-spacing:-.2rem;margin-bottom:.8rem}}
.sub{{font-size:2.4rem;color:{muted};margin-bottom:2.4rem}}
.cols{{column-count:2;column-gap:2rem}}
section{{break-inside:avoid;background:#fff;border:1px solid {line};border-radius:2rem;padding:1.8rem 2.2rem;margin-bottom:1.8rem}}
h2{{font-size:2.1rem;font-weight:800;color:{lbl};letter-spacing:.1rem;text-transform:uppercase;margin-bottom:1rem}}
.li{{display:flex;gap:1.2rem;font-size:2.15rem;line-height:1.32;margin-bottom:.8rem}}
.li i{{font-style:normal;color:{acc};font-weight:800}}
.li i.n{{background:{acc};color:#fff;border-radius:50%;min-width:3rem;height:3rem;display:flex;align-items:center;justify-content:center;font-size:1.7rem;margin-top:.1rem}}
table{{width:100%;border-collapse:collapse;font-size:1.95rem;line-height:1.28}}
th{{text-align:left;color:{muted};font-weight:700;font-size:1.7rem;padding:.2rem .6rem .6rem 0;border-bottom:2px solid {line}}}
td{{padding:.7rem .6rem .7rem 0;border-bottom:1px solid {line};vertical-align:top}}
td:first-child{{font-weight:700}}
tr:last-child td{{border-bottom:none}}
.tip{{margin-top:1.4rem;font-size:2.4rem;font-weight:600;line-height:1.35;background:#1d1d1f;color:#fff;border-radius:2rem;padding:1.8rem 2.4rem}}.tip span{{color:{acc};font-weight:800;margin-right:.4rem}}
.foot{{position:absolute;bottom:0;left:0;right:0;height:96px;border-top:1px solid {line};display:flex;align-items:center;justify-content:space-between;padding:0 68px;color:#8e8a80;font-size:22px}}
.brand{{display:flex;align-items:center;gap:12px;color:#1d1d1f;font-weight:700;font-size:26px}}
</style></head><body>
<div class="bar"><div class="back">‹ AI Radar Cheatsheets</div>{RADAR.format(w=72)}</div>
<div class="wrap" id="w"><div class="kick"><em>{fmt(sheet.get("kicker", "AI cheatsheet"))}</em></div><h1>{fmt(sheet["title"])}</h1>{sub}
<div class="cols">{blocks}</div>{tip}</div>
<div class="foot"><div class="brand">{RADAR.format(w=54)} @ai_radar_</div><div>Save this 🔖 · Share it with a friend</div></div>
<script>
const w=document.getElementById('w');let s=13;document.documentElement.style.fontSize=s+'px';
while(w.scrollHeight>w.clientHeight && s>6){{s-=0.25;document.documentElement.style.fontSize=s+'px';}}
</script></body></html>""", name


def bake(page, fs):
    css = re.search(r'<style>(.*?)</style>', page, re.S).group(1)
    body = re.search(r'<body>(.*)</body>', page, re.S).group(1)
    body = re.sub(r'<script>.*?</script>', '', body, flags=re.S)
    css = re.sub(r'html\{font-size:[^}]*\}', '', css)
    css = css.replace('html,body{', '.sheet{').replace('body{background', '.sheet{background')
    css = re.sub(r'([\d.]+)rem', lambda m: f"{float(m.group(1))*fs:.2f}px", css)
    css = css.replace('.sheet{width:1080px', '.sheet{position:relative;width:1080px')
    out = f'<div xmlns="http://www.w3.org/1999/xhtml" class="sheet"><style>{css}</style>{body}</div>'
    return out.replace('<svg viewBox', '<svg xmlns="http://www.w3.org/2000/svg" viewBox')
def render(sheet, out):
    from playwright.sync_api import sync_playwright
    page_html, name = build(sheet)
    tmp = pathlib.Path(out).with_suffix(".html")
    tmp.write_text(page_html, encoding="utf-8")
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={"width": 1080, "height": 1350})
        pg.goto(tmp.resolve().as_uri())
        pg.wait_for_timeout(500)
        pg.screenshot(path=out)
        fs = float(pg.evaluate("parseFloat(getComputedStyle(document.documentElement).fontSize)"))
        b.close()
    pathlib.Path(out).with_suffix(".baked.html").write_text(bake(page_html, fs), encoding="utf-8")
    from PIL import Image
    Image.open(out).convert("RGB").save(pathlib.Path(out).with_suffix(".jpg"), quality=88, optimize=True)
    return name, fs
if __name__ == "__main__":
    print("theme, font:", render(json.loads(pathlib.Path(sys.argv[1]).read_text(encoding="utf-8")), sys.argv[2]))
