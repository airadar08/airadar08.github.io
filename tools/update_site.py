"""Add a newly posted cheatsheet or repo to the AI Radar website (run from anywhere).

  python3 tools/update_site.py cheatsheet <slug> <card.jpg> "<title>" "<subtitle>" "<tag, e.g. Agents>"
  python3 tools/update_site.py repo <card.jpg> <repo.json> [post_url]

cheatsheet: copies the image to cheatsheets/img/<slug>.jpg and inserts entries after the
            <!-- new-cheatsheet:page --> and <!-- new-cheatsheet:home --> markers (newest first).
repo:       copies the image to repos/img/<owner>-<name>.jpg and prepends an entry to data/repos.json
            (the Repos page and the home "Trending repos" strip render from that file).
Exits non-zero without changing anything if the entry already exists."""
import sys, json, shutil, html, datetime as dt, pathlib, re

ROOT = pathlib.Path(__file__).resolve().parent.parent
IST = dt.timezone(dt.timedelta(hours=5, minutes=30))
e = html.escape


def cheatsheet(slug, jpg, title, sub, tag):
    if not re.fullmatch(r"[a-z0-9-]+", slug): sys.exit("slug must be lowercase letters, digits and dashes")
    page = ROOT / "cheatsheets" / "index.html"; home = ROOT / "index.html"
    cs, hm = page.read_text(encoding="utf-8"), home.read_text(encoding="utf-8")
    if f'id="{slug}"' in cs: sys.exit("already on site: " + slug)
    shutil.copy(jpg, ROOT / "cheatsheets" / "img" / f"{slug}.jpg")
    art = (f'    <article class="sheet reveal" id="{slug}">\n'
           f'      <a class="img" href="img/{slug}.jpg"><img src="img/{slug}.jpg" alt="{e(title)} cheatsheet: {e(sub)}" loading="lazy" width="1080" height="1350"></a>\n'
           f'      <div class="meta"><span class="kind">{e(tag)}</span><b>{e(title)}</b><span class="desc">{e(sub)}</span><a class="link-arrow" href="img/{slug}.jpg">Open full size →</a></div>\n'
           f'    </article>\n')
    card = (f'        <a class="res reveal" href="cheatsheets/#{slug}"><div class="thumb"><img src="cheatsheets/img/{slug}.jpg" alt="{e(title)} cheatsheet" loading="lazy" width="1080" height="1350"></div>'
            f'<div class="body"><span class="kind">Cheatsheet</span><b>{e(title)}</b><span class="desc">{e(sub)}</span></div></a>\n')
    m1, m2 = "    <!-- new-cheatsheet:page -->\n", "        <!-- new-cheatsheet:home -->\n"
    assert m1 in cs and m2 in hm, "markers missing"
    page.write_text(cs.replace(m1, m1 + art, 1), encoding="utf-8")
    home.write_text(hm.replace(m2, m2 + card, 1), encoding="utf-8")
    print("cheatsheet added:", slug)


def repo(jpg, repo_json, post_url=""):
    d = json.loads(pathlib.Path(repo_json).read_text(encoding="utf-8"))
    full = d["repo"].strip("/")
    slug = re.sub(r"[^a-z0-9-]+", "-", full.lower().replace("/", "-")).strip("-")
    data = ROOT / "data" / "repos.json"
    items = json.loads(data.read_text(encoding="utf-8")) if data.exists() else []
    if any(i["repo"].lower() == full.lower() for i in items): sys.exit("already on site: " + full)
    (ROOT / "repos" / "img").mkdir(parents=True, exist_ok=True)
    shutil.copy(jpg, ROOT / "repos" / "img" / f"{slug}.jpg")
    stats = {s.get("label", "").lower(): s.get("big", "") for s in d.get("stats", [])}
    pick = lambda *keys: next((v for k, v in stats.items() if any(x in k for x in keys)), "")
    items.insert(0, {
        "slug": slug, "repo": full, "url": f"https://github.com/{full}",
        "tagline": d.get("tagline", ""),
        "stars": next((v for k, v in stats.items() if "star" in k and not any(x in k for x in ("week", "today", "day"))), ""),
        "trend": pick("this week", "today", "week"), "language": pick("language"), "license": pick("licen"),
        "what": d.get("what", [])[:3], "read": d.get("read", ""), "img": f"repos/img/{slug}.jpg",
        "date": dt.datetime.now(IST).strftime("%Y-%m-%d"), "post": post_url,
    })
    data.parent.mkdir(exist_ok=True)
    data.write_text(json.dumps(items, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print("repo added:", full)


if __name__ == "__main__":
    kind = sys.argv[1] if len(sys.argv) > 1 else ""
    if kind == "cheatsheet" and len(sys.argv) == 7: cheatsheet(*sys.argv[2:7])
    elif kind == "repo" and len(sys.argv) in (4, 5): repo(*sys.argv[2:])
    else: sys.exit(__doc__)
