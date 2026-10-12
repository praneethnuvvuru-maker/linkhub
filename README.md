# Linkhub

Run locally: `node server.js`, then open http://localhost:3000

Deploy (Render.com, as an example):
1. Push this folder to a GitHub repo.
2. New > Web Service > pick the repo. Build command: empty. Start command: `node server.js`.
3. Environment: `SECRET` = any long random string, `DATA_DIR` = `/data`.
4. Add a Disk (paid plan) mounted at `/data`, or your accounts are erased on every restart.
5. Your page is then at https://YOUR-APP.onrender.com/yourname. Put that in your Instagram bio.
