// Run on https://x.com/ai_radar_ (signed in, Posts tab) with ONE javascript_exec.
// Scrolls the profile, reads the newest posts and returns a compact JSON string:
// [[status_id, iso_time, type, title, body, link, domain, image_url], ...]  newest first, pinned post skipped.
// Save the returned string to /tmp/x_posts.json, then: python3 tools/update_site.py sync /tmp/x_posts.json
(async () => {
  const MAX = 25, seen = {};
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  function grab() {
    document.querySelectorAll('article[data-testid="tweet"]').forEach((a) => {
      const t = a.querySelector('time'); const link = t && t.closest('a'); if (!link) return;
      const href = link.getAttribute('href'); if (!/^\/ai_radar_\/status\/\d+$/.test(href)) return;
      const social = a.querySelector('[data-testid="socialContext"]');
      if (social && /Pinned/.test(social.innerText)) return;
      const textEl = a.querySelector('[data-testid="tweetText"]');
      const imgs = [...a.querySelectorAll('[data-testid="tweetPhoto"] img')].map((i) => i.src);
      const links = textEl ? [...textEl.querySelectorAll('a')].map((x) => x.href).filter((h) => !/x\.com\/(hashtag|search|ai_radar_)/.test(h)) : [];
      seen[href] = { href, time: t.getAttribute('datetime'), text: textEl ? textEl.innerText : '', imgs, links };
    });
  }
  window.scrollTo(0, 0); await sleep(1500);
  for (let i = 0; i < 12 && Object.keys(seen).length < MAX; i++) { grab(); window.scrollBy(0, 1500); await sleep(1300); }
  grab(); window.scrollTo(0, 0);
  const out = Object.values(seen).sort((a, b) => (a.time < b.time ? 1 : -1)).slice(0, MAX).map((p) => {
    const t = p.text; const m = t.match(/\n*https:\/\/\n?([\s\S]*)$/); let vis = '', body = t;
    if (m) { vis = m[1].replace(/\n/g, ''); body = t.slice(0, m.index); }
    const trunc = /…$/.test(vis); vis = vis.replace(/…$/, '');
    const first = body.split('\n')[0];
    let type = 'News';
    if (/^📌/.test(first)) type = 'Cheatsheet'; else if (/Trending AI repo/.test(first)) type = 'Repo';
    else if (/^🎁 FREE|^Prompt pack/.test(first)) type = 'Prompt pack'; else if (/AI fact/.test(first)) type = 'AI fact';
    const title = first.replace(/^[^\p{L}\p{N}"]+/u, '').replace(/^AI fact:\s*/, '').trim();
    const rest = body.trim().split('\n').slice(1).join('\n').trim().replace(/\n{2,}/g, '\n');
    const url = !vis ? '' : trunc ? (p.links[0] || '') : 'https://' + vis;
    return [p.href.split('/').pop(), p.time, type, title, rest, url, vis.split('/')[0], (p.imgs[0] || '').replace('&name=medium', '&name=small')];
  });
  return JSON.stringify(out);
})();
