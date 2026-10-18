# AI Radar website

Static site for the @ai_radar_ X account, served by GitHub Pages at https://airadar08.github.io (pushes to `main` go live in ~1 minute; no build step).

## Structure
- `assets/site.css` — shared tokens, header, buttons, resource cards, footer, reveal animation. Every page links it.
- `assets/site.js` — header border on scroll + scroll reveal (content stays visible without JS).
- `assets/hero.js` — flat 2D radar (plain canvas, no libraries) filling the home hero (`#radar`): rings and a sweep beam spreading up from the hero's bottom centre; coloured blips (8 slot colours) light up as the beam passes, and some show a name tag (AI lab names, AI NEWS / UPDATES / AI FACTS). Blips are placed only outside the hero copy and phones, re-laid out on resize.
- `assets/music.js` — background music on every site page (not the app): an original ambient loop made live with the Web Audio API (soft pad over four chords plus an echoing "radar ping"; no audio file). Browsers block sound until the visitor interacts, so it starts on their first click/tap/key press unless they paused it before (localStorage `airadar-music` = `off`). A round play/pause button is inserted just before "Follow on X" in the top bar; the music fades out while the tab is hidden. Loaded after `chat.js` on every page (and in `tools/pack_template.html`).
- `assets/logo.svg` — the AI Radar logo used on the X profile (mint circle, white "ai", radar arcs); also the favicon. Same SVG is inlined in each page header.
- `index.html` — home landing page (self-contained CSS/JS, does NOT link site.css or site.js): intro loader `#intro` (once per visit via sessionStorage `air-intro`; skipped with reduced motion or in a background tab; a full-screen canvas: a small radar whose sweep lights five card-colour blips, green last, locks on the green, glides it to the centre, then opens an even mint ring with sonar ripples onto the page, ~5.4 s; a safety timer always removes it; the hero entrance timers are offset by `window.__airIntro`), sky hero with two phones (left = real X profile screenshot `assets/img/x-profile.jpg`, right = chatbot mock), glass nav with letter-roll hover, custom cursor dot, progressive blur at top/bottom, "How it works" cross-fade carousel, AI labs ring (names only, no logos): full ring orbiting the copy on screens 800px+, sized so every circle stays on screen, turning with scroll plus a slow drift; a looping scrolling row on phones, "What you get" bento, `#repos-strip` (4 newest from `data/repos.json`), `#resources` grid of cheatsheet/prompt-pack cards, FAQ accordion, sky CTA with #stayontheradar, giant wordmark footer. Fonts: Instrument Serif (headings) + Inter. The `<!-- new-pack:home -->` and `<!-- new-cheatsheet:home -->` markers live in the `#resources` grid; cards use the same `.res` markup as before.
- `get-app/index.html` — landing page for the AI Radar **Android app** (where every "Get app" button goes). The app is Android only and "Coming soon on Google Play": there is no web version on this site (the old `app-beta/` and `app-smart/` web apps were removed on 2026-10-18; they are in git history). Built from the home page's own system: same tokens and CSS (copied from `index.html`), same intro loader (shares sessionStorage `air-intro`), hero radar (`assets/hero.js`, needs `#radar`, `.hero-copy`, `.phone-stage`), blur-in words, letter-roll buttons, two tilted phones with real Android-app screenshots (`get-app/img/chat.jpg`, `posts.jpg`; also `home.jpg`, `saved.jpg`; 585x1266) that rise and drift on scroll, a "How it answers" 4-step carousel (understands, searches, reads, answers with sources), a phone gallery of the app's three tabs (`#screens`), a features bento, a "Coming soon" section (`#soon`) with a non-link `.soon` Google Play badge and Follow on X, FAQ, sweeping sky CTA and wordmark footer. When the app is live on Google Play: turn every `.soon` badge into a link to the listing and update the copy and FAQ. Only describe features the Android app really has (Chat with the smart bot, Posts, Saved).
- "Get app": home nav has a glass `.getapp` pill (in `.nav-right`, next to "Follow on X"; on phones under 480px "Follow on X" hides and Get app stays) and an "App" footer column; inner pages (repos, cheatsheets, prompts, prompt-packs and every pack page, plus `tools/pack_template.html`) have `<a class="getapp">` in the header, styled in `assets/site.css` (under 440px "Follow on X" hides). `.getapp` is deliberately not `.btn`, so `assets/music.js` keeps its play button next to "Follow on X" (it picks the first `a.btn` in the bar).
- `prompts/index.html` — first prompt pack (50 AI prompts; data in the `PACK` array). Kept at this URL because it was shared on X.
- `prompt-packs/index.html` — Prompt packs listing, renders from `data/packs.json`. New packs live at `prompt-packs/<slug>/` (built by `tools/make_pack.py`).
- `cheatsheets/index.html` — gallery of posted cheatsheets; images in `cheatsheets/img/*.jpg` (1080x1350), each card has an `id` anchor linked from the home page.
- Home chips: "Daily AI news" and "AI facts" link to https://x.com/ai_radar_; "Cheatsheets" to `cheatsheets/`; "Free resources" to `#resources`.
- `assets/chat.js` — "Ask AI Radar" chat overlay on every page (reads the page's CSS tokens; the home page defines aliases for them). Answer order: (1) matching AI Radar resources first, found client-side from `data/repos.json`, `data/packs.json` and the `cheatsheets/` page; (2) for repo questions, a live GitHub search from the browser, no Worker call: `ghTerms` drops intent words (create, provide, good, want…) and joins phrases ("front end" → frontend); software topics (frontend, website, UI, backend…) search GitHub topics for the most-starred, still-active repos plus up to 3 new AI repos for that topic; AI topics (audio, agents, RAG…) get AI repos; "trending/new/latest" means repos created in the last 180 days. The same `ghTerms` cleaning matches our own resources. (3) otherwise the Worker's AI answer with news headlines. Chat sessions: each visitor's history lives in their own browser tab (`sessionStorage` `air-chat-v2`; the app uses `localStorage` `airadar-chat-v1`); after 5 minutes without a message the next question starts a new session (a "New conversation" divider), and the AI gets only the current session, up to 12 messages (`SESSION_MS`, `CTX_MAX`; the Worker's `MAX_TURNS` is 12). `window.AIRadarChat.open()` and any `[data-open-chat]` element open it. Hidden until `ENDPOINT` is set.
- `worker/worker.js` — Cloudflare Worker (deployed separately on Cloudflare, not by GitHub Pages) that calls OpenRouter. Also answers `{action:"best", query, radar}` (agentic "Best for you" search, built for the removed web app; unused by the site, kept for a future web app) (`best()`): AI plans up to 2 queries per source (`PLAN_SYS`), the Worker searches GitHub, Hugging Face models/apps/datasets, HF papers and Hacker News, drops forks, archived repos, repos untouched for 2 years, duplicates (an AI Radar pick merges with the same GitHub repo) and articles when the user wants free, keeps the top 7 per kind, then AI picks 3–5 with why / trade-off / start (`RANK_SYS`; invented ids dropped); falls back to keywords and popularity when the AI fails; 4 per minute per IP; optional secret `GITHUB_TOKEN` raises GitHub's search limit. The OpenRouter key is a Cloudflare secret `OPENROUTER_API_KEY`; optional vars `MODEL` (default the free `nvidia/nemotron-3.5-super-vl:free`), `ALLOWED_ORIGIN`. Origin-locked, rate-limited, web search only for news-type questions. Also answers `{action:"preview", url}` (page title/description/site, no AI call) for the app's Add sheet; redeploy the Worker on Cloudflare after changing it.
- `repos/index.html` — Repos page; renders from `data/repos.json` (newest first). Home shows the 4 newest in the hidden-until-filled `#repos-strip`. Card images in `repos/img/`.
- `data/repos.json` — featured repos, written by `tools/update_site.py repo`.
- `tools/` — renderers (`render_cheatsheet.py`, `render_repo.py`), `post_x.js` browser snippet, `update_site.py`. Used by the scheduled posting task.
- `data/posts.json` — the archive of EVERY @ai_radar_ post (news, AI facts, repos, cheatsheets, prompt packs), newest first; schema in `tools/posts.py`. `update_site.py cheatsheet|repo` and `make_pack.py` add their entry automatically; news/fact posts are added with `update_site.py post <post.json> [card.png]`; `update_site.py link latest <x_url>` sets the X link after posting; `tools/scrape_x.js` (run on the X profile) + `update_site.py sync <file>` adds any posts that are missing (news, facts, manual posts). The app's Posts tab and chat read it. Every scheduled posting task must log its post here.
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

## Every post on X must land on this site (standing rule)
After ANY post on @ai_radar_ (news, AI fact, repo, cheatsheet, prompt pack, small packs, hand-made posts):
1. Run tools/scrape_x.js on https://x.com/ai_radar_ (browser), save the string to /tmp/x_posts.json.
2. `python3 tools/update_site.py sync /tmp/x_posts.json` (adds new posts to data/posts.json, fills X links).
3. Short prompt packs ("Prompt pack: 3 prompts ...") also get their own page: write a pack.json and run
   `python3 tools/make_pack.py pack.json <x_url>`, then commit and push to main.

## Prompt packs: always the green + black house style
Every prompt pack (any size, even 3 prompts) is made with `python3 tools/make_pack.py pack.json [x_url]`.
Its cover (cream page, green headline, black "Follow + comment" bar, `cover.baked.html`) is the ONLY image used for the X post
and the site. Never use the rotating-colour "AI Radar Notes" card (render_card.py) for a prompt pack.
Post the pack's `cover.baked.html`, link/page = prompt-packs/<slug>/, then sync the archive.

## The Android app
The AI Radar app is Android only (Google Play: coming soon). Its code and its chat bot (Cloudflare Worker `airadar-app-bot`, `bot/worker.js`) live in the separate Android project, not in this repo. The bot accepts only the Android app (header `X-App-Key`). `app-src/` here is just the source of the liquid-glass bundle the old web app used; keep it for a future web app.
