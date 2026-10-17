// The web version's chat goes to the app's smart bot (bot/worker.js in the Android project, Cloudflare Worker airadar-app-bot).
// No key here: the Worker recognises this page by its origin, https://airadar08.github.io.
window.AIRADAR_BOT = { url: 'https://airadar-app-bot.arinsingh2304.workers.dev', key: '' };
