"""Build a new AI Radar prompt pack: website page + cover card + listing entry.

  python3 tools/make_pack.py pack.json [x_post_url]

pack.json:
{"slug": "ai-prompts-for-students",            # lowercase-dashes; page lives at /prompt-packs/<slug>/
 "title_plain": "40 AI prompts for", "title_em": "students",   # headline = plain + highlighted part
 "desc": "one sentence for the listing and meta description",
 "keyword": "STUDY",                              # word people comment on X to get the link
 "categories": [{"id": "notes", "name": "Notes & revision", "sub": "short line",
                 "items": [["Prompt title", "Prompt text with [fill-in] parts"], ...]}, ...]}

Writes: prompt-packs/<slug>/index.html, prompt-packs/<slug>/cover.png/.jpg/.baked.html,
        prepends data/packs.json, adds a card after <!-- new-pack:home --> in index.html.
The cover's *.baked.html is what gets posted to X. Re-running with the same slug only re-renders files
(no duplicate listing)."""
import sys, json, html, re, pathlib, datetime as dt

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
from render_cheatsheet import RADAR, bake  # noqa: E402

IST = dt.timezone(dt.timedelta(hours=5, minutes=30))
e = html.escape


def cover_html(p, total):
    rows = "".join(f'<div class="r"><span>{e(c["name"])}</span><b>{len(c["items"])}</b></div>' for c in p["categories"][:7])
    A = RADAR.format(w=72); B = RADAR.format(w=54)
    return f"""<html><head><style>
*{{box-sizing:border-box;margin:0;padding:0}}
html{{font-size:10px}}
html,body{{width:1080px;height:1350px;font-family:"Inter",sans-serif;-webkit-font-smoothing:antialiased;overflow:hidden}}
body{{background:#fbf8f1;color:#1d1d1f;position:relative}}
.bar{{height:104px;display:flex;align-items:center;justify-content:space-between;padding:0 64px;border-bottom:1px solid #e9e3d4}}
.back{{color:#13a36b;font-size:32px;font-weight:600}}
.wrap{{position:absolute;top:104px;left:0;right:0;bottom:96px;padding:5.2rem 6.8rem 0;overflow:hidden}}
.tag{{display:inline-block;background:#13a36b;color:#fff;font-size:2.4rem;font-weight:800;letter-spacing:.2rem;padding:1rem 2rem;border-radius:1.2rem;margin-bottom:2.6rem}}
h1{{font-size:8.6rem;line-height:1.0;font-weight:900;letter-spacing:-.3rem;margin-bottom:2.2rem}}
h1 em{{font-style:normal;color:#13a36b}}
.sub{{font-size:3rem;color:#6b6a63;line-height:1.35;margin-bottom:3.4rem}}
.list{{background:#fff;border:1px solid #e9e3d4;border-radius:2.4rem;padding:1.4rem 3rem;margin-bottom:3.4rem}}
.r{{display:flex;justify-content:space-between;align-items:center;padding:1.3rem 0;border-bottom:1px solid #f0ebdf;font-size:3rem}}
.r:last-child{{border-bottom:0}}
.r span{{font-weight:600}}
.r b{{font-size:2.4rem;font-weight:700;color:#0b7a4f;background:#dff3e9;border-radius:999px;padding:.4rem 1.6rem}}
.cta{{background:#1d1d1f;color:#fff;border-radius:2.4rem;padding:3rem 3.4rem;display:flex;justify-content:space-between;align-items:center;gap:2rem}}
.cta .t{{font-size:3.6rem;font-weight:800;line-height:1.2}}
.cta .t small{{display:block;font-size:2.4rem;font-weight:500;color:#b9b7ae;margin-top:.6rem}}
.cta .k{{background:#13a36b;color:#fff;font-size:3.4rem;font-weight:900;letter-spacing:.1rem;padding:1.4rem 2.4rem;border-radius:1.4rem;white-space:nowrap}}
.foot{{position:absolute;bottom:0;left:0;right:0;height:96px;border-top:1px solid #e9e3d4;display:flex;align-items:center;justify-content:space-between;padding:0 68px;color:#8e8a80;font-size:22px}}
.brand{{display:flex;align-items:center;gap:12px;color:#1d1d1f;font-weight:700;font-size:26px}}
</style></head><body>
<div class="bar"><div class="back">‹ AI Radar Resources</div>{A}</div>
<div class="wrap" id="w"><div class="tag">FREE PROMPT PACK</div><h1>{e(p["title_plain"])} <em>{e(p["title_em"])}</em></h1>
<div class="sub">Copy, fill the blanks, paste into ChatGPT, Claude or Gemini.</div>
<div class="list">{rows}</div>
<div class="cta"><div class="t">Follow + comment<small>and I'll reply with the link</small></div><div class="k">{e(p.get("keyword","PROMPTS").upper())}</div></div></div>
<div class="foot"><div class="brand">{B} @ai_radar_</div><div>100% free · {total} prompts</div></div>
<script>
const w=document.getElementById('w');let s=10;
while(w.scrollHeight>w.clientHeight && s>6.5){{s-=0.25;document.documentElement.style.fontSize=s+'px';}}
</script></body></html>"""


def render_cover(page_html, out):
    from playwright.sync_api import sync_playwright
    from PIL import Image
    tmp = out.with_suffix(".html"); tmp.write_text(page_html, encoding="utf-8")
    with sync_playwright() as pw:
        b = pw.chromium.launch(); pg = b.new_page(viewport={"width": 1080, "height": 1350})
        pg.goto(tmp.resolve().as_uri()); pg.wait_for_timeout(500); pg.screenshot(path=str(out))
        fs = float(pg.evaluate("parseFloat(getComputedStyle(document.documentElement).fontSize)")); b.close()
    tmp.unlink()
    out.with_suffix(".baked.html").write_text(bake(page_html, fs), encoding="utf-8")
    Image.open(out).convert("RGB").save(out.with_suffix(".jpg"), quality=86, optimize=True)


def main(path, post_url=""):
    p = json.loads(pathlib.Path(path).read_text(encoding="utf-8"))
    slug = p["slug"]
    if not re.fullmatch(r"[a-z0-9-]+", slug): sys.exit("slug must be lowercase letters, digits and dashes")
    cats = p["categories"]; total = sum(len(c["items"]) for c in cats)
    d = ROOT / "prompt-packs" / slug; d.mkdir(parents=True, exist_ok=True)
    # page
    t = (ROOT / "tools" / "pack_template.html").read_text(encoding="utf-8")
    title = f'{p["title_plain"]} {p["title_em"]}'
    pack = [{"id": c["id"], "name": c["name"], "sub": c.get("sub", ""), "items": c["items"]} for c in cats]
    how = f'<li>Works with any chat AI</li><li>One-tap copy</li><li>{len(cats)} categories · {total} prompts</li>'
    lede = ('Copy a prompt, fill the <mark>[highlighted]</mark> parts, and paste it into ChatGPT, Claude or Gemini. '
            'Each one tells the model who to be, what to produce and in what format.')
    page = (t.replace("{{R}}", "../../").replace("{{TITLE_TAG}}", e(f"{title} | AI Radar"))
             .replace("{{DESC}}", e(p.get("desc", title))).replace("{{H1}}", f'{e(p["title_plain"])} <em>{e(p["title_em"])}.</em>')
             .replace("{{LEDE}}", lede).replace("{{HOW}}", how)
             .replace("{{PACK}}", json.dumps(pack, ensure_ascii=False).replace("</", "<\\/")))
    assert "{{" not in page, "unfilled placeholder"
    (d / "index.html").write_text(page, encoding="utf-8")
    # cover
    render_cover(cover_html(p, total), d / "cover.png")
    # listing + home card (once)
    data = ROOT / "data" / "packs.json"
    items = json.loads(data.read_text(encoding="utf-8")) if data.exists() else []
    if not any(i["slug"] == slug for i in items):
        items.insert(0, {"slug": slug, "title": title, "desc": p.get("desc", ""), "count": total,
                         "url": f"prompt-packs/{slug}/", "cover": f"prompt-packs/{slug}/cover.jpg",
                         "keyword": p.get("keyword", "PROMPTS").upper(), "date": dt.datetime.now(IST).strftime("%Y-%m-%d"), "post": post_url})
        data.write_text(json.dumps(items, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        home = ROOT / "index.html"; h = home.read_text(encoding="utf-8")
        m = "        <!-- new-pack:home -->\n"; assert m in h, "home marker missing"
        card = (f'        <a class="res reveal" href="prompt-packs/{slug}/"><div class="thumb"><img src="prompt-packs/{slug}/cover.jpg" alt="{e(title)} cover" loading="lazy" width="1080" height="1350"></div>'
                f'<div class="body"><span class="kind">Prompt pack</span><b>{e(title)}</b><span class="desc">{e(p.get("desc",""))}</span></div></a>\n')
        home.write_text(h.replace(m, m + card, 1), encoding="utf-8")
    elif post_url:
        for i in items:
            if i["slug"] == slug and not i.get("post"): i["post"] = post_url
        data.write_text(json.dumps(items, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"pack ready: prompt-packs/{slug}/ ({total} prompts); cover: {d/'cover.png'}")


if __name__ == "__main__":
    if len(sys.argv) not in (2, 3): sys.exit(__doc__)
    main(*sys.argv[1:])
