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
const THEMES = { // [background, text, button, button text]
  meadow: ['#e6f0cf', '#1d2b17', '#1d2b17', '#eef6dc'], dusk: ['#2a2150', '#f2edff', '#f2edff', '#2a2150'],
  sunset: ['#ffb98f', '#3a0f20', '#ffffff', '#3a0f20'], paper: ['#f5f2ec', '#161616', '#161616', '#f5f2ec'],
  sea: ['#0c3640', '#e4fbf6', '#5de0c8', '#0c3640'] };
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

function publicPage(u, name) {
  const [bg, txt, btn, bt] = THEMES[u.theme] || THEMES.meadow;
  const links = u.links.filter(l => l.on && l.title && safeUrl(l.url)).map(l =>
    `<a href="/go/${name}/${l.id}" rel="noopener">${esc(l.title)}</a>`).join('');
  return `<!doctype html><html lang=en><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1">
<title>${esc(u.display || name)}</title><meta name=description content="${esc(u.bio)}"><meta property=og:title content="${esc(u.display || name)}">
<style>*{box-sizing:border-box}body{margin:0;min-height:100vh;background:${bg};color:${txt};font:16px/1.45 system-ui,sans-serif;text-align:center}
main{max-width:480px;margin:0 auto;padding:48px 22px 30px}.av{font-size:44px;width:88px;height:88px;border-radius:50%;background:${btn};color:${bt};display:grid;place-items:center;margin:0 auto 10px}
h1{margin:0;font-size:22px}p{margin:6px auto 22px;max-width:32ch}.l a{display:block;margin:0 0 12px;padding:15px 16px;border-radius:999px;background:${btn};color:${bt};font-weight:600;text-decoration:none}
.l a:hover{transform:scale(1.02)}footer{margin-top:30px;font-size:12px;opacity:.7}footer a{color:inherit}</style></head>
<body><main><div class=av>${esc(u.avatar || '🙂')}</div><h1>${esc(u.display || name)}</h1><div style="opacity:.75">@${name}</div><p>${esc(u.bio)}</p>
<div class=l>${links || '<p>No links yet.</p>'}</div><footer><a href="/">Make your own Linkhub</a></footer></main></body></html>`;
}

function admin(u, name, origin) {
  const clicks = u.links.reduce((a, l) => a + (l.clicks || 0), 0);
  const items = u.links.map(l => `<form method=post action=/admin/link class=card><input type=hidden name=id value=${l.id}>
<input name=title value="${esc(l.title)}" placeholder="Link title" maxlength=60><input name=url value="${esc(l.url)}" placeholder="https://...">
<div class=row><label><input type=checkbox name=on ${l.on ? 'checked' : ''} style="width:auto"> Visible</label><small>${l.clicks || 0} clicks</small></div>
<div class=row><button name=act value=save>Save</button><button class=alt name=act value=up>Up</button><button class=alt name=act value=down>Down</button><button class=del name=act value=del>Delete</button></div></form>`).join('');
  return shell('Linkhub admin', `<h1>Your Linkhub</h1>
<div class=card>Your public link: <a href="/${name}"><b>${esc(origin)}/${name}</b></a><br><small>${u.views || 0} views, ${clicks} clicks. Put this link in your Instagram bio.</small></div>
<form method=post action=/admin/profile class=card><h2>Profile</h2>
<label>Display name<input name=display value="${esc(u.display)}" maxlength=40></label><label>Avatar emoji<input name=avatar value="${esc(u.avatar)}" maxlength=4></label>
<label>Bio<textarea name=bio maxlength=160>${esc(u.bio)}</textarea></label>
<label>Theme<select name=theme>${Object.keys(THEMES).map(t => `<option ${t === u.theme ? 'selected' : ''}>${t}</option>`).join('')}</select></label><button>Save profile</button></form>
<h2>Links</h2><form method=post action=/admin/add class=card><input name=title placeholder="Link title" required maxlength=60><input name=url placeholder="https://..." required><button>Add link</button></form>
${items}<p><a href="/logout">Log out</a></p>`);
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
  if (req.method === 'POST') { let b = ''; for await (const c of req) { b += c; if (b.length > 1e5) return send(413, 'Too large'); } f = Object.fromEntries(new URLSearchParams(b)); }
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

  if (p.startsWith('/admin')) {
    if (!me) return go('/');
    if (req.method === 'GET') return send(200, admin(me, name, origin));
    if (p === '/admin/profile') { me.display = f.display?.slice(0, 40); me.avatar = f.avatar?.slice(0, 4); me.bio = f.bio?.slice(0, 160); if (THEMES[f.theme]) me.theme = f.theme; }
    if (p === '/admin/add' && safeUrl(f.url)) me.links.push({ id: Date.now().toString(36), title: (f.title || '').slice(0, 60), url: f.url.trim(), on: true, clicks: 0 });
    if (p === '/admin/link') {
      const i = me.links.findIndex(l => l.id === f.id), l = me.links[i];
      if (l) {
        if (f.act === 'save') { l.title = (f.title || '').slice(0, 60); l.url = (f.url || '').trim(); l.on = !!f.on; }
        else if (f.act === 'del') me.links.splice(i, 1);
        else { const j = i + (f.act === 'up' ? -1 : 1); if (me.links[j]) [me.links[i], me.links[j]] = [me.links[j], me.links[i]]; }
      }
    }
    save(); return go('/admin');
  }
  let m = p.match(/^\/go\/([a-z0-9_]+)\/([a-z0-9]+)$/);
  if (m) {
    const l = DB.users[m[1]]?.links.find(x => x.id === m[2]), to = l && safeUrl(l.url);
    if (!to) return send(404, shell('Not found', '<h1>Link not found</h1>'));
    l.clicks = (l.clicks || 0) + 1; save(); return go(to);
  }
  m = p.match(/^\/([a-zA-Z0-9_]{3,30})$/);
  const pu = m && DB.users[m[1].toLowerCase()];
  if (pu) { pu.views = (pu.views || 0) + 1; save(); return send(200, publicPage(pu, m[1].toLowerCase())); }
  send(404, shell('Not found', '<h1>Page not found</h1><p><a href="/">Create your own Linkhub</a></p>'));
}).listen(PORT, () => console.log('Linkhub running on port ' + PORT));
