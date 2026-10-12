// Linkhub: a self-hosted Linktree clone. No dependencies, Node 18+.
const http = require('http'), fs = require('fs'), crypto = require('crypto'), path = require('path');
const PORT = process.env.PORT || 3000;
const DIR = process.env.DATA_DIR || './data';
const SECRET = process.env.SECRET || 'change-this-secret';
const FILE = path.join(DIR, 'db.json');
fs.mkdirSync(DIR, { recursive: true });
let DB = { users: {} };
try { DB = JSON.parse(fs.readFileSync(FILE)); } catch {}
const save = () => fs.writeFileSync(FILE, JSON.stringify(DB));

const RESERVED = ['admin', 'go', 'login', 'logout', 'signup', 'static', 'api'];
const THEMES = {
  meadow: { bg: 'linear-gradient(160deg,#e6f0cf,#c9e0b0)', txt: '#1d2b17', btn: '#1d2b17', bt: '#eef6dc' },
  dusk: { bg: 'linear-gradient(160deg,#2a2150,#4a2d6e)', txt: '#f2edff', btn: '#f2edff', bt: '#2a2150' },
  sunset: { bg: 'linear-gradient(160deg,#ffc79a,#ff7f93)', txt: '#3a0f20', btn: '#ffffff', bt: '#3a0f20' },
  paper: { bg: '#f5f2ec', txt: '#161616', btn: '#161616', bt: '#f5f2ec' },
  sea: { bg: 'linear-gradient(160deg,#0c3640,#12565a)', txt: '#e4fbf6', btn: '#5de0c8', bt: '#0c3640' } };
const RADII = { pill: '999px', round: '14px', square: '0' }, FILLS = ['solid', 'outline', 'soft'];
const ADMIN = fs.readFileSync(path.join(__dirname, 'admin.html'));
const FONTS = { sans: 'system-ui,sans-serif', serif: 'Georgia,serif', mono: 'ui-monospace,Menlo,monospace', round: 'ui-rounded,"Trebuchet MS",sans-serif' };
const h = v => v.replace(/^@/, '');
const SOC = { ig: ['IG', 'Instagram', v => 'https://instagram.com/' + h(v)], yt: ['YT', 'YouTube', v => /^https?:/i.test(v) ? v : 'https://youtube.com/@' + h(v)],
  x: ['X', 'X', v => 'https://x.com/' + h(v)], tiktok: ['TT', 'TikTok', v => 'https://tiktok.com/@' + h(v)],
  linkedin: ['in', 'LinkedIn', v => /^https?:/i.test(v) ? v : 'https://linkedin.com/in/' + v], github: ['GH', 'GitHub', v => 'https://github.com/' + h(v)],
  whatsapp: ['WA', 'WhatsApp', v => 'https://wa.me/' + v.replace(/\D/g, '')], email: ['@', 'Email', v => 'mailto:' + v] };
const hex = (v, d) => /^#[0-9a-f]{6}$/i.test(v) ? v : d;
const themeOf = u => u.theme === 'custom' ? { bg: hex(u.custom?.bg, '#ffffff'), txt: hex(u.custom?.txt, '#111111'), btn: hex(u.custom?.btn, '#111111'), bt: hex(u.custom?.bt, '#ffffff') } : THEMES[u.theme] || THEMES.meadow;
const bump = (u, k) => { const d = new Date().toISOString().slice(0, 10); u.daily = u.daily || {}; const e = u.daily[d] = u.daily[d] || { v: 0, c: 0 }; e[k]++;
  const ks = Object.keys(u.daily).sort(); while (ks.length > 60) delete u.daily[ks.shift()]; };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sign = v => v + '.' + crypto.createHmac('sha256', SECRET).update(v).digest('hex');
const unsign = s => { if (!s) return null; const i = s.lastIndexOf('.'); const v = s.slice(0, i); return sign(v) === s ? v : null; };
const hash = (p, salt = crypto.randomBytes(8).toString('hex')) => salt + ':' + crypto.scryptSync(p, salt, 32).toString('hex');
const verify = (p, h) => { const a = Buffer.from(hash(p, h.split(':')[0])), b = Buffer.from(h); return a.length === b.length && crypto.timingSafeEqual(a, b); };
const safeUrl = u => { u = (u || '').trim(); if (!u) return null; if (!/^[a-z][a-z0-9+.-]*:/i.test(u)) u = 'https://' + u; return /^(https?:|mailto:)/i.test(u) ? u : null; };

const CSS = `*{box-sizing:border-box}body{margin:0;font:16px/1.45 system-ui,sans-serif;background:#f3f1fa;color:#1d1a2e}
main{max-width:560px;margin:0 auto;padding:24px 16px 60px}h1,h2{letter-spacing:-.02em}
.card{background:#fff;border:1px solid #dedaee;border-radius:14px;padding:14px;margin:0 0 12px}
input,textarea,select{width:100%;padding:9px 11px;margin:4px 0 8px;border:1px solid #cfc9e6;border-radius:10px;font:inherit}
button,.btn{background:#5b3df5;color:#fff;border:0;border-radius:10px;padding:9px 14px;font:inherit;font-weight:600;cursor:pointer;text-decoration:none;display:inline-block}
button.alt{background:#ece9f8;color:#1d1a2e}button.del{background:#fde4ea;color:#b4173f}.row{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.err{background:#fde4ea;color:#b4173f;padding:10px;border-radius:10px;margin-bottom:12px}small{color:#6d6985}`;
const shell = (title, body) => `<!doctype html><html lang=en><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>${CSS}</style></head><body><main>${body}</main></body></html>`;

function publicPage(u, name, ok) {
  const t = themeOf(u), r = RADII[u.shape] || RADII.pill, fill = FILLS.includes(u.fill) ? u.fill : 'solid', font = FONTS[u.font] || FONTS.sans, td = new Date().toISOString().slice(0, 10);
  const body = u.links.filter(l => l.on && l.title && !(l.start && td < l.start) && !(l.end && td > l.end)).map(l => {
    if (l.type === 'heading') return `<h2>${esc(l.title)}</h2>`;
    if (!safeUrl(l.url)) return '';
    if (l.type === 'video') { const m = l.url.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/); if (m) return `<iframe src="https://www.youtube-nocookie.com/embed/${m[1]}" title="${esc(l.title)}" loading=lazy allowfullscreen></iframe>`; }
    return `<a class="${fill}${l.star ? ' star' : ''}" href="/go/${name}/${l.id}" rel="noopener">${l.icon ? `<span>${esc(l.icon)}</span>` : ''}${esc(l.title)}</a>`;
  }).join('');
  const soc = Object.entries(SOC).filter(([k]) => u.socials?.[k] && /^[^\s<>"']+$/.test(u.socials[k])).map(([k, [ab, nm, fn]]) =>
    `<a class=so href="${esc(fn(u.socials[k]))}" aria-label="${nm}" rel=noopener>${ab}</a>`).join('');
  const sub = u.subscribe ? `<form method=post action="/subscribe/${name}" class=sub>${ok ? '<p>Thanks, you are subscribed.</p>' : `<input type=email name=email placeholder="Your email" required aria-label=Email><button>${esc(u.subText || 'Subscribe')}</button>`}</form>` : '';
  const av = /^https:\/\//.test(u.photo || '') ? `<img class=av src="${esc(u.photo)}" alt="">` : `<div class=av>${esc(u.avatar || '🙂')}</div>`;
  return `<!doctype html><html lang=en><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1">
<title>${esc(u.display || name)}</title><meta name=description content="${esc(u.bio)}"><meta property=og:title content="${esc(u.display || name)}"><meta property=og:description content="${esc(u.bio)}">
<style>*{box-sizing:border-box}body{margin:0;min-height:100vh;background:${t.bg};color:${t.txt};font:16px/1.45 ${font};text-align:center}
main{max-width:480px;margin:0 auto;padding:48px 22px 30px}.av{font-size:44px;width:88px;height:88px;border-radius:50%;background:${t.btn};color:${t.bt};display:grid;place-items:center;margin:0 auto 10px;object-fit:cover}
h1{margin:0;font-size:22px}.h{opacity:.75}p{margin:8px auto 18px;max-width:32ch}h2{font-size:14px;margin:20px 0 10px;opacity:.8}
.socials{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin:0 0 20px}a.so{width:40px;height:40px;border-radius:50%;display:grid;place-items:center;background:${t.btn};color:${t.bt};font-weight:700;font-size:13px;text-decoration:none}
a.solid,a.outline,a.soft{display:block;margin:0 0 12px;padding:15px 16px;border-radius:${r};border:2px solid ${t.btn};background:${t.btn};color:${t.bt};font-weight:600;text-decoration:none;transition:transform .12s}
a.outline{background:transparent;color:${t.btn}}a.soft{background:color-mix(in srgb,${t.btn} 16%,transparent);color:${t.txt};border-color:transparent}
a span{margin-right:8px}a:hover{transform:scale(1.02)}iframe{width:100%;aspect-ratio:16/9;border:0;border-radius:${r === '999px' ? '16px' : r};margin:0 0 12px}
a.star{animation:pulse 1.6s infinite}@keyframes pulse{50%{transform:scale(1.04)}}@media(prefers-reduced-motion:reduce){a.star{animation:none}}
.sub{display:flex;gap:8px;margin:18px 0}.sub input{flex:1;min-width:0;padding:12px;border-radius:${r === '999px' ? '999px' : r};border:2px solid ${t.btn};background:transparent;color:inherit;font:inherit}
.sub button{padding:12px 16px;border:0;border-radius:${r === '999px' ? '999px' : r};background:${t.btn};color:${t.bt};font:inherit;font-weight:600;cursor:pointer}
footer{margin-top:30px;font-size:12px;opacity:.7}footer a{color:inherit}</style></head>
<body><main>${av}<h1>${esc(u.display || name)}</h1><div class=h>@${name}</div><p>${esc(u.bio)}</p>
${soc ? `<div class=socials>${soc}</div>` : ''}${body || '<p>No links yet.</p>'}${sub}${u.hideBrand ? '' : '<footer><a href="/">Make your own Linkhub</a></footer>'}</main></body></html>`;
}

function clean(f, old) {
  const oc = Object.fromEntries(old.links.map(l => [l.id, l.clicks || 0]));
  const str = (v, n) => String(v ?? '').slice(0, n), dt = v => /^\d{4}-\d\d-\d\d$/.test(v) ? v : '';
  const soc = {}; for (const k of Object.keys(SOC)) if (f.socials?.[k]) soc[k] = str(f.socials[k], 100).trim();
  return { display: str(f.display, 40), bio: str(f.bio, 160), avatar: str(f.avatar, 4), photo: /^https:\/\//.test(f.photo) ? str(f.photo, 500) : '', socials: soc,
    theme: THEMES[f.theme] || f.theme === 'custom' ? f.theme : 'meadow', custom: { bg: hex(f.custom?.bg, '#ffffff'), txt: hex(f.custom?.txt, '#111111'), btn: hex(f.custom?.btn, '#111111'), bt: hex(f.custom?.bt, '#ffffff') },
    font: FONTS[f.font] ? f.font : 'sans', fill: FILLS.includes(f.fill) ? f.fill : 'solid', shape: RADII[f.shape] ? f.shape : 'pill',
    hideBrand: !!f.hideBrand, subscribe: !!f.subscribe, subText: str(f.subText, 30) || 'Subscribe',
    links: (Array.isArray(f.links) ? f.links : []).slice(0, 100).map(l => {
      const id = /^[a-z0-9]{1,20}$/.test(l.id) ? l.id : Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
      return { id, type: ['heading', 'video'].includes(l.type) ? l.type : 'link', title: str(l.title, 60), url: str(l.url, 500), on: !!l.on,
        icon: str(l.icon, 4), star: !!l.star, start: dt(l.start), end: dt(l.end), clicks: oc[id] || 0 };
    }) };
}

http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x'), p = u.pathname;
  const cookies = Object.fromEntries((req.headers.cookie || '').split('; ').filter(Boolean).map(c => { const i = c.indexOf('='); return [c.slice(0, i), decodeURIComponent(c.slice(i + 1))]; }));
  const name = unsign(cookies.s), me = name && DB.users[name];
  const secure = req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
  const origin = (req.headers['x-forwarded-proto'] || 'http') + '://' + req.headers.host;
  const send = (code, body, h = {}) => { res.writeHead(code, { 'Content-Type': 'text/html; charset=utf-8', ...h }); res.end(body); };
  const go = (to, h = {}) => { res.writeHead(302, { Location: to, ...h }); res.end(); };
  const login = n => `s=${encodeURIComponent(sign(n))}; HttpOnly; Path=/; SameSite=Lax; Max-Age=2592000${secure}`;
  let f = {};
  if (req.method !== 'GET') { let b = ''; for await (const c of req) { b += c; if (b.length > 2e5) return send(413, 'Too large'); }
    try { f = (req.headers['content-type'] || '').includes('json') ? JSON.parse(b) : Object.fromEntries(new URLSearchParams(b)); } catch { return send(400, 'Bad request'); } }
  const err = u.searchParams.get('e');

  if (p === '/' && req.method === 'GET') {
    if (me) return go('/admin');
    return send(200, shell('Linkhub', `<h1>One link for everything you share</h1><p>Create your page, then put <b>${esc(origin)}/yourname</b> in your Instagram bio.</p>
${err ? `<div class=err>${esc(err)}</div>` : ''}<form method=post action=/signup class=card><h2>Create your page</h2>
<input name=username placeholder="username (letters, numbers, _)" required pattern="[a-zA-Z0-9_]{3,30}"><input name=password type=password placeholder="Password (8+ characters)" required minlength=8><button>Sign up</button></form>
<form method=post action=/login class=card><h2>Log in</h2><input name=username placeholder="username" required><input name=password type=password placeholder="Password" required><button class=alt>Log in</button></form>`));
  }
  if (p === '/signup' && req.method === 'POST') {
    const n = (f.username || '').toLowerCase();
    if (!/^[a-z0-9_]{3,30}$/.test(n) || RESERVED.includes(n)) return go('/?e=' + encodeURIComponent('Pick a username of 3-30 letters, numbers or _'));
    if (DB.users[n]) return go('/?e=' + encodeURIComponent('That username is taken'));
    if ((f.password || '').length < 8) return go('/?e=' + encodeURIComponent('Password needs 8+ characters'));
    DB.users[n] = { pw: hash(f.password), display: n, bio: 'Welcome to my page.', avatar: '🙂', theme: 'meadow', views: 0, links: [] };
    save(); return go('/admin', { 'Set-Cookie': login(n) });
  }
  if (p === '/login' && req.method === 'POST') {
    const n = (f.username || '').toLowerCase(), usr = DB.users[n];
    if (!usr || !verify(f.password || '', usr.pw)) return go('/?e=' + encodeURIComponent('Wrong username or password'));
    return go('/admin', { 'Set-Cookie': login(n) });
  }
  if (p === '/logout') return go('/', { 'Set-Cookie': `s=; Path=/; Max-Age=0${secure}` });

  if (p === '/admin') return me ? send(200, ADMIN) : go('/');
  if (p === '/api/me') {
    if (!me) return send(401, '{}', { 'Content-Type': 'application/json' });
    if (req.method === 'PUT') { Object.assign(me, clean(f, me)); save(); }
    const { pw, subs, ...pub } = me;
    return send(200, JSON.stringify({ username: name, subsCount: (subs || []).length, ...pub }), { 'Content-Type': 'application/json' });
  }
  let m = p.match(/^\/go\/([a-z0-9_]+)\/([a-z0-9]+)$/);
  if (m) {
    const l = DB.users[m[1]]?.links.find(x => x.id === m[2]), to = l && safeUrl(l.url);
    if (!to) return send(404, shell('Not found', '<h1>Link not found</h1>'));
    l.clicks = (l.clicks || 0) + 1; bump(DB.users[m[1]], 'c'); save(); return go(to);
  }
  m = p.match(/^\/subscribe\/([a-z0-9_]+)$/);
  if (m && req.method === 'POST') {
    const su = DB.users[m[1]], em = (f.email || '').trim().toLowerCase();
    if (su && su.subscribe && em.length < 200 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
      su.subs = su.subs || [];
      if (su.subs.length < 5000 && !su.subs.some(x => x.email === em)) { su.subs.push({ email: em, at: new Date().toISOString() }); save(); }
    }
    return go('/' + m[1] + '?ok=1');
  }
  if (p === '/api/subs.csv') {
    if (!me) return go('/');
    const rows = ['email,subscribed_at', ...(me.subs || []).map(x => (x.email + ',' + x.at).replace(/^[=+\-@]/, "'$&"))];
    res.writeHead(200, { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename=subscribers.csv' }); return res.end(rows.join('\n'));
  }
  m = p.match(/^\/([a-zA-Z0-9_]{3,30})$/);
  const pu = m && DB.users[m[1].toLowerCase()];
  if (pu) { pu.views = (pu.views || 0) + 1; bump(pu, 'v'); save(); return send(200, publicPage(pu, m[1].toLowerCase(), u.searchParams.get('ok'))); }
  send(404, shell('Not found', '<h1>Page not found</h1><p><a href="/">Create your own Linkhub</a></p>'));
}).listen(PORT, () => console.log('Linkhub running on port ' + PORT));
