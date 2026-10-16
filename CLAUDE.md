# AI Radar website

Static site for the @ai_radar_ X account, served by GitHub Pages at https://airadar08.github.io (pushes to `main` go live in ~1 minute; no build step).

## Structure
- `assets/site.css` — shared tokens, header, buttons, resource cards, footer, reveal animation. Every page links it.
- `assets/site.js` — header border on scroll + scroll reveal (content stays visible without JS).
- `assets/hero.js` — Three.js (r128 UMD from cdnjs) 3D radar on the home hero; static SVG fallback inside `#radar`.
- `assets/logo.svg` — the AI Radar logo used on the X profile (mint circle, white "ai", radar arcs); also the favicon. Same SVG is inlined in each page header.
- `index.html` — home: hero with 3D radar, "What you get", free resources grid (thumbnails), follow band.
- `prompts/index.html` — first prompt pack (50 AI prompts; data in the `PACK` array). Kept at this URL because it was shared on X.
- `prompt-packs/index.html` — Prompt packs listing, renders from `data/packs.json`. New packs live at `prompt-packs/<slug>/` (built by `tools/make_pack.py`).
- `cheatsheets/index.html` — gallery of posted cheatsheets; images in `cheatsheets/img/*.jpg` (1080x1350), each card has an `id` anchor linked from the home page.
- Home chips: "Daily AI news" and "AI facts" link to https://x.com/ai_radar_; "Cheatsheets" to `cheatsheets/`; "Free resources" to `#resources`.
- `assets/chat.js` — "Ask AI Radar" chat overlay on every page. Hidden until `ENDPOINT` (top of file) is set to the Cloudflare Worker URL.
- `worker/worker.js` — Cloudflare Worker (deployed separately on Cloudflare, not by GitHub Pages) that calls OpenRouter. The OpenRouter key is a Cloudflare secret `OPENROUTER_API_KEY`; optional vars `MODEL` (default the free `nvidia/nemotron-3.5-super-vl:free`), `ALLOWED_ORIGIN`. Origin-locked, rate-limited, web search only for news-type questions.
- `repos/index.html` — Repos page; renders from `data/repos.json` (newest first). Home shows the 4 newest in the hidden-until-filled `#repos-strip`. Card images in `repos/img/`.
- `data/repos.json` — featured repos, written by `tools/update_site.py repo`.
- `tools/` — renderers (`render_cheatsheet.py`, `render_repo.py`), `post_x.js` browser snippet, `update_site.py`. Used by the scheduled posting task.
- `.nojekyll` — keeps GitHub Pages from running Jekyll.

## Brand
- Colours: cream `#fbf8f1` background, mint `#13a36b` accent (dark ink `#0b7a4f`), text `#1d1d1f`. Dark mode via `prefers-color-scheme`.
- Fonts (Google Fonts): Bricolage Grotesque for headings, Inter for body, JetBrains Mono for small labels.
- Logo: `assets/logo.svg`, the same mark as the X profile picture. No company logos or trademarks.
- Post cards: cheatsheets use the fixed cream/mint "Resources" theme; repos use the fixed dark theme; news/updates/facts keep the 8 rotating slot colours.
- Motion: subtle (fade/rise, hover lift, the radar sweep). Always respect `prefers-reduced-motion`.

## Adding a new prompt pack
Write a pack JSON (see `tools/make_pack.py` docstring) and run `python3 tools/make_pack.py pack.json [x_post_url]`, then commit and push. The X post uses `prompt-packs/<slug>/cover.baked.html`; commenters get `https://airadar08.github.io/prompt-packs/<slug>/`.

## Adding a new repo
Run `python3 tools/update_site.py repo <card.jpg> <repo.json> [x_post_url]`, then commit and push.

## Adding a new cheatsheet
Prefer `python3 tools/update_site.py cheatsheet <slug> <card.jpg> "<title>" "<subtitle>" "<tag>"`. Manually:
Add the 1080x1350 image as `cheatsheets/img/<slug>.jpg`. Insert the new `<article class="sheet reveal" id="<slug>">` right after the `<!-- new-cheatsheet:page -->` marker in `cheatsheets/index.html` (newest first); insert a matching `<a class="res reveal">` card right after `<!-- new-cheatsheet:home -->` in `index.html`. Copy the markup of the existing entries exactly.

## Adding a new free resource
1. Create `<slug>/index.html` using the same head, header and footer as `cheatsheets/index.html` (links `../assets/site.css`), page-specific CSS inline, works at 400px width.
2. Add a card for it in the "Free resources" list in `index.html`, above the "More coming soon" card.
3. Commit and push to `main`, then check `https://airadar08.github.io/<slug>/` loads.
4. The resource link used in X replies is `https://airadar08.github.io/<slug>/`.

## Rules
- The site itself stays static (no trackers, no forms that submit anywhere). The only backend is the chat Worker.
- Never put an API key or secret in any file in this repo.
- Plain, direct copy; real content only.

- Never show posting frequency or schedules (posts per day, times) anywhere on the site.
- When changing anything in `assets/`, bump the `?v=N` on its links in all three pages so browsers fetch the new file.
