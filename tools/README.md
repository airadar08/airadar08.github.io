# AI Radar tools (used by the scheduled posting task)

- `render_cheatsheet.py sheet.json out.png` → out.png, out.jpg, out.baked.html
- `render_repo.py repo.json out.png` → same outputs, repo card
- `post_x.js` → browser snippet that attaches the card and pastes the text on x.com (does not click Post)
- `update_site.py cheatsheet|repo|post|link ...` → adds the posted item to the website and to the posts archive `data/posts.json` (see the file's docstring and `posts.py`)

Needs Python 3, Playwright (Chromium) and Pillow. No secrets live here.

## Card themes (fixed)
- Cheatsheets: always the "Resources" theme (cream #fbf8f1, mint #13a36b, dark "Remember" callout) — same look as the 50 AI prompts cover. The `slot` field is ignored.
- Repos: always the dark "terminal" theme (#121417 background, mint #34c98a accents). The `slot` field is ignored.
- News / updates / AI facts (made by the separate news task) keep the 8 rotating slot colours.

## Prompt packs
- `make_pack.py pack.json [x_post_url]` → builds `prompt-packs/<slug>/index.html` from `pack_template.html`, renders `cover.png/.jpg/.baked.html` (cream/mint resource look with the comment keyword), prepends `data/packs.json`, and adds a home card after `<!-- new-pack:home -->`. The first pack lives at `/prompts/` (kept so old links work).

## News posts (standing format, decided 2026-10-25)
Every news post = ONE source-backed card in the "AI Radar Notes" style, made with `render_news.py` (see its docstring for the JSON):
kicker, big headline, 4 stat tiles, 2 sections of short lines, "Our read:" takeaway, "Sources:" in the footer; rotating slot colour.
Post text: line 1 = the news as one plain sentence, blank line, 3 "→" fact lines, blank line, "Source: <original URL>" (X counts URL = 23, emoji/→ = 2; max 280).
Only facts read in sources. Then: `python3 tools/update_site.py post <post.json> <card.png>`, post with post_x.js (use the .baked.html), `update_site.py link <id> <x_url>`, commit and push.
Repos, cheatsheets and prompt packs keep their own fixed designs (render_repo.py, render_cheatsheet.py, make_pack.py).
