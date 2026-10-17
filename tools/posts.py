"""The AI Radar post archive: data/posts.json, one entry per post made on X (newest first).
The app's Posts tab and the chat's "find my old post" search read it.

Entry fields:
  id        unique, e.g. "2026-10-17-repo-debpalash-voicestudio"
  type      "News" | "Fact" | "Repo" | "Cheatsheet" | "Prompt pack"
  title     one line (the post's hook, without the leading emoji)
  summary   one or two plain sentences
  points    up to 4 short facts (the post's "→" lines)
  date      ISO time the post went out (IST)
  x_url     https://x.com/ai_radar_/status/<id>  (may be added later with `link`)
  link      the AI Radar card it points to, relative to the site root (e.g. "repos/#owner-name"), or ""
  source    the original source URL (article / GitHub / Wikipedia), or ""
  img       card image: a path in this repo (posts/img/<id>.jpg, repos/img/.., cheatsheets/img/..) or an https URL
  tags      optional topic tags; the app fills them in from the text when missing
"""
import json, re, pathlib, shutil, datetime as dt

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / "data" / "posts.json"
IMG_DIR = ROOT / "posts" / "img"
IST = dt.timezone(dt.timedelta(hours=5, minutes=30))
TYPES = ("News", "Fact", "Repo", "Cheatsheet", "Prompt pack")


def now_iso():
    return dt.datetime.now(IST).replace(microsecond=0).isoformat()


def load():
    return json.loads(DATA.read_text(encoding="utf-8")) if DATA.exists() else []


def save(items):
    items.sort(key=lambda i: i.get("date", ""), reverse=True)
    DATA.parent.mkdir(exist_ok=True)
    DATA.write_text(json.dumps(items, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


def slugify(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")[:60]


def copy_image(src, pid):
    """Copy a card image into posts/img/<id>.jpg (resized to 720px wide, JPEG) and return its repo path."""
    src = pathlib.Path(src)
    if not src.exists():
        return ""
    IMG_DIR.mkdir(parents=True, exist_ok=True)
    out = IMG_DIR / f"{pid}.jpg"
    try:
        from PIL import Image
        im = Image.open(src).convert("RGB")
        if im.width > 720:
            im = im.resize((720, round(im.height * 720 / im.width)))
        im.save(out, quality=82, optimize=True)
    except Exception:
        shutil.copy(src, out)
    return f"posts/img/{pid}.jpg"


def add(entry, image=None):
    """Add or update one post. Matching is by id, then by x_url, then by (type, link)."""
    e = {k: v for k, v in entry.items() if v not in (None,)}
    if e.get("type") not in TYPES:
        raise SystemExit(f"type must be one of {TYPES}")
    e.setdefault("date", now_iso())
    e.setdefault("id", f'{e["date"][:10]}-{slugify(e["type"])}-{slugify(e.get("title", "post"))}')
    for k in ("summary", "x_url", "link", "source", "img"):
        e.setdefault(k, "")
    e.setdefault("points", [])
    if image:
        e["img"] = copy_image(image, e["id"]) or e["img"]
    items = load()
    for i, old in enumerate(items):
        same = old["id"] == e["id"] or (e["x_url"] and old.get("x_url") == e["x_url"]) or \
               (e["link"] and old.get("link") == e["link"] and old.get("type") == e["type"])
        if same:
            merged = dict(old)
            merged.update({k: v for k, v in e.items() if v not in ("", [], None)})
            merged["id"] = old["id"]
            items[i] = merged
            save(items)
            return merged
    items.append(e)
    save(items)
    return e


def link(key, x_url):
    """Set the X link on the newest post whose id or site link matches `key` (or the newest post if key is 'latest')."""
    items = load()
    for i in sorted(items, key=lambda i: i.get("date", ""), reverse=True):
        if key == "latest" or i["id"] == key or i.get("link", "").endswith(key) or key in i["id"]:
            i["x_url"] = x_url
            save(items)
            return i
    raise SystemExit("no post matches " + key)


def sync(path):
    """Add every post from a tools/scrape_x.js export (JSON list) that is not in the archive yet; fill in missing X links.
    Repo, cheatsheet and prompt-pack posts are matched to the entry the site tools already wrote (by their site link)."""
    import json as _j
    raw = _j.loads(pathlib.Path(path).read_text(encoding="utf-8"))
    if isinstance(raw, str):
        raw = _j.loads(raw)
    sheets = re.findall(r'<article class="sheet reveal" id="([a-z0-9-]+)"', (ROOT / "cheatsheets" / "index.html").read_text(encoding="utf-8"))
    packs = _j.loads((ROOT / "data" / "packs.json").read_text(encoding="utf-8")) if (ROOT / "data" / "packs.json").exists() else []
    known = {i.get("x_url") for i in load()}
    added = 0
    for sid, time, typ, title, body, url, site, img in raw:
        x_url = f"https://x.com/ai_radar_/status/{sid}"
        lines = [l.strip() for l in body.split("\n") if l.strip()]
        pts = [l.lstrip("→").strip() for l in lines if l.startswith("→")]
        other = [l for l in lines if not l.startswith("→") and not re.match(r"^(Save it|Want it\?|\d\. |@ai_radar_|I'll reply|Follow)", l)]
        why = [l for l in other if l.startswith("Why it matters")]
        summary = " ".join([l for l in other if not l.startswith("Why it matters")] + why[:1]).strip()
        date = dt.datetime.fromisoformat(time.replace("Z", "+00:00")).astimezone(IST).replace(microsecond=0).isoformat()
        e = {"type": {"AI fact": "Fact"}.get(typ, typ), "title": title, "summary": summary, "points": pts[:4],
             "x_url": x_url, "date": date, "link": "", "source": "", "img": img}
        if e["type"] == "Repo":
            name = title.split(":", 1)[-1].strip()
            slug = re.sub(r"[^a-z0-9-]+", "-", name.lower().replace("/", "-")).strip("-")
            e.update(link=f"repos/#{slug}", source=f"https://github.com/{name}")
            if (ROOT / "repos" / "img" / f"{slug}.jpg").exists():
                e["img"] = f"repos/img/{slug}.jpg"
        elif e["type"] == "Cheatsheet":
            words = set(re.findall(r"[a-z0-9]+", title.lower())) - {"cheatsheet", "on", "one", "page", "the", "a", "vs"}
            best = max(sheets, key=lambda i: len(words & set(i.split("-"))), default="")
            if best and words & set(best.split("-")):
                e.update(link=f"cheatsheets/#{best}", img=f"cheatsheets/img/{best}.jpg")
        elif e["type"] == "Prompt pack":
            words = set(re.findall(r"[a-z0-9]+", title.lower()))
            pk = max(packs, key=lambda k: len(words & set(re.findall(r"[a-z0-9]+", k["title"].lower()))), default=None)
            if pk:
                e.update(link=pk["url"], img=pk.get("cover", img), summary=pk.get("desc", summary), title="FREE: " + pk["title"])
        else:
            e["source"] = url
        if x_url not in known:
            added += 1
        add(e)
    return added
