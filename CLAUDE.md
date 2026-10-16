# AI Radar website

Static site for the @ai_radar_ X account, served by GitHub Pages at https://airadar08.github.io (pushes to `main` go live in ~1 minute; no build step).

## Structure
- `index.html` — home / link-in-bio page: logo, tagline, follow button, "Free resources" list.
- `prompts/index.html` — free resource: 50 AI prompts (data in the `PACK` array in its script).
- `.nojekyll` — keeps GitHub Pages from running Jekyll.

## Brand
- Colours: cream `#fbf8f1` background, mint `#13a36b` accent (dark ink `#0b7a4f`), text `#1d1d1f`. Dark mode via `prefers-color-scheme`.
- Fonts (Google Fonts): Bricolage Grotesque for headings, Inter for body, JetBrains Mono for small labels.
- Logo: the mint circle "ai" radar SVG inlined in `index.html`. No company logos or trademarks.

## Adding a new free resource
1. Create `<slug>/index.html` as a self-contained page (inline CSS/JS, same tokens as above, works at 400px width, link back to `../`).
2. Add a card for it in the "Free resources" list in `index.html`, above the "More coming soon" card.
3. Commit and push to `main`, then check `https://airadar08.github.io/<slug>/` loads.
4. The resource link used in X replies is `https://airadar08.github.io/<slug>/`.

## Rules
- Keep everything static (no backend, no trackers, no forms that submit anywhere).
- Plain, direct copy; real content only.
