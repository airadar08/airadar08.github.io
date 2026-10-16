# AI Radar tools (used by the scheduled posting task)

- `render_cheatsheet.py sheet.json out.png` → out.png, out.jpg, out.baked.html
- `render_repo.py repo.json out.png` → same outputs, repo card
- `post_x.js` → browser snippet that attaches the card and pastes the text on x.com (does not click Post)
- `update_site.py cheatsheet|repo ...` → adds the posted item to the website (see the file's docstring)

Needs Python 3, Playwright (Chromium) and Pillow. No secrets live here.
