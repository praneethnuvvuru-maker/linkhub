# Linkhub

Run locally: `node server.js`, then open http://localhost:3000

## Deploy on Render
1. Push this folder to a GitHub repo.
2. New > Web Service > pick the repo. Build command: empty. Start command: `node server.js`.
3. Environment variables:
   - `SECRET` = any long random string (required)
   - `DATA_DIR` = `/data` (with a Disk mounted at `/data`, or accounts are erased on restart)
   - `ANTHROPIC_API_KEY` = your key from console.anthropic.com (optional, turns on the AI assistant; usage is billed to you)
   - `AI_MODEL` = optional, defaults to `claude-haiku-5-5`
