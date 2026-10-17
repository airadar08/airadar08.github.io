# AI Radar website

Static site for the @ai_radar_ X account, served by GitHub Pages at https://airadar08.github.io (pushes to `main` go live in ~1 minute; no build step).

## Structure
- `assets/site.css` — shared tokens, header, buttons, resource cards, footer, reveal animation. Every page links it.
- `assets/site.js` — header border on scroll + scroll reveal (content stays visible without JS).
- `assets/hero.js` — flat 2D radar (plain canvas, no libraries) filling the home hero (`#radar`): rings and a sweep beam spreading up from the hero's bottom centre; coloured blips (8 slot colours) light up as the beam passes, and some show a name tag (AI lab names, AI NEWS / UPDATES / AI FACTS). Blips are placed only outside the hero copy and phones, re-laid out on resize.
- `assets/logo.svg` — the AI Radar logo used on the X profile (mint circle, white "ai", radar arcs); also the favicon. Same SVG is inlined in each page header.
- `index.html` — home landing page (self-contained CSS/JS, does NOT link site.css or site.js): sky hero with two phones (left = real X profile screenshot `assets/img/x-profile.jpg`, right = chatbot mock), glass nav with letter-roll hover, custom cursor dot, progressive blur at top/bottom, "How it works" cross-fade carousel, AI labs ring (names only, no logos): full ring orbiting the copy on screens 800px+, sized so every circle stays on screen, turning with scroll plus a slow drift; a looping scrolling row on phones, "What you get" bento, `#repos-strip` (4 newest from `data/repos.json`), `#resources` grid of cheatsheet/prompt-pack cards, FAQ accordion, sky CTA with #stayontheradar, giant wordmark footer. Fonts: Instrument Serif (headings) + Inter. The `<!-- new-pack:home -->` and `<!-- new-cheatsheet:home -->` markers live in the `#resources` grid; cards use the same `.res` markup as before.
- `prompts/index.html` — first prompt pack (50 AI prompts; data in the `PACK` array). Kept at this URL because it was shared on X.
- `prompt-packs/index.html` — Prompt packs listing, renders from `data/packs.json`. New packs live at `prompt-packs/<slug>/` (built by `tools/make_pack.py`).
- `cheatsheets/index.html` — gallery of posted cheatsheets; images in `cheatsheets/img/*.jpg` (1080x1350), each card has an `id` anchor linked from the home page.
- Home chips: "Daily AI news" and "AI facts" link to https://x.com/ai_radar_; "Cheatsheets" to `cheatsheets/`; "Free resources" to `#resources`.
- `assets/chat.js` — "Ask AI Radar" chat overlay on every page (reads the page's CSS tokens; the home page defines aliases for them). Answer order: (1) matching AI Radar resources first, found client-side from `data/repos.json`, `data/packs.json` and the `cheatsheets/` page; (2) for repo questions ("top 5 repos for audio"), a live GitHub search from the browser (most-starred AI repos created in the last 180 days, falling back to recently active ones), no Worker call; (3) otherwise the Worker's AI answer with news headlines. `window.AIRadarChat.open()` and any `[data-open-chat]` element open it. Hidden until `ENDPOINT` is set.
- `worker/worker.js` — Cloudflare Worker (deployed separately on Cloudflare, not by GitHub Pages) that calls OpenRouter. The OpenRouter key is a Cloudflare secret `OPENROUTER_API_KEY`; optional vars `MODEL` (default the free `nvidia/nemotron-3.5-super-vl:free`), `ALLOWED_ORIGIN`. Origin-locked, rate-limited, web search only for news-type questions.
- `repos/index.html` — Repos page; renders from `data/repos.json` (newest first). Home shows the 4 newest in the hidden-until-filled `#repos-strip`. Card images in `repos/img/`.
- `data/repos.json` — featured repos, written by `tools/update_site.py repo`.
- `tools/` — renderers (`render_cheatsheet.py`, `render_repo.py`), `post_x.js` browser snippet, `update_site.py`. Used by the scheduled posting task.
- `.nojekyll` — keeps GitHub Pages from running Jekyll.

## Brand
- Theme: dark everywhere (no light mode). Ground `#0a0c0b`, cards `#111412`, lines `#1f2521`, text `#eef1ee`, muted `#9aa39c`, mint accent `#34c98a` (soft `#12271e`, light `#6fdcaa`). Primary buttons are mint with near-black text. Home hero and CTA are a dark radar (grid, rings, slow sweep) echoing the X banner.
- Fonts (Google Fonts): Instrument Serif (weight 400) for headings, Inter for body and the "AI Radar" name, JetBrains Mono for small labels.
- Logo: `assets/logo.svg`, the same mark as the X profile picture. No company logos or trademarks.
- Post card images keep their own designs. Post cards: cheatsheets use the fixed cream/mint "Resources" theme; repos use the fixed dark theme; news/updates/facts keep the 8 rotating slot colours.
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
- When changing anything in `assets/`, bump the `?v=N` on its links in every page (home, repos, cheatsheets, prompts, prompt-packs, tools/pack_template.html) so browsers fetch the new file.
