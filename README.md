# pi scheduler

A React + Vite scheduling demo with a pi-powered assistant. The app shows an employee scheduling calendar, supports drag-and-drop employee assignment, and lets the assistant inspect schedule context and apply UI changes through semantic tools.

## What this demo includes

- Weekly employee schedule calendar
- Multiple shifts per day
- Employees with roles, skills, availability, and attendance risk
- Manual shift assignment via drag/drop or dropdowns
- Name-based demo login that reconnects to an existing local chat session
- Assistant side panel powered by `@earendil-works/pi-coding-agent`
- Assistant tools:
  - `get_current_app_context`
  - `apply_scheduling_changes`

## Requirements

- macOS/Linux shell
- [Bun](https://bun.sh/)
- A configured pi-compatible model/API key, for example Anthropic or OpenAI
- Optional for deployment: Cloudflare account + `CLOUDFLARE_API_TOKEN`

## 1. Install Bun

If you do not already have Bun:

```bash
curl -fsSL https://bun.sh/install | bash
```

Restart your shell, then verify:

```bash
bun --version
```

## 2. Clone the repo

Using SSH:

```bash
git clone git@github.com:mjr-intellbits/pi-scheduler.git
cd pi-scheduler
```

Or HTTPS:

```bash
git clone https://github.com/mjr-intellbits/pi-scheduler.git
cd pi-scheduler
```

## 3. Install dependencies

```bash
bun install
```

## 4. Configure model credentials

The local assistant server uses pi's SDK, so it uses your normal pi auth/config.

Example with Anthropic:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

Example with OpenAI:

```bash
export OPENAI_API_KEY=sk-...
```

Alternatively, if you already use pi locally and have logged in/configured credentials, the SDK can reuse your existing pi auth storage.

## 5. Start the app locally

```bash
bun run dev
```

This starts both:

- Vite frontend: `http://localhost:5173`
- Bun/Express assistant backend: `http://localhost:8787`

Open:

```txt
http://localhost:5173
```

## 6. Log in to the demo

The demo login is intentionally simple:

1. Enter a name, for example `josh`.
2. The app stores that name in browser `localStorage`.
3. The backend uses that name as the local session key.
4. Reusing the same name reconnects to the same saved assistant chat session.

Session files are stored locally under:

```txt
.pi-web/sessions/<name>/
```

This is demo-only auth. It is not secure user authentication.

## 7. Try the scheduling UI

You can manually adjust the schedule:

- Drag an employee card onto a calendar shift
- Drag an employee card onto a selected-day shift row
- Use the dropdown on a shift row

Risky assignments are marked as warnings, for example:

- employee is unavailable that day
- employee has the wrong role/skill
- employee has high attendance risk

## 8. Try assistant actions

Example prompts:

```txt
Can this schedule be optimized?
```

```txt
Assign someone to the open Saturday server shift.
```

```txt
Fix the highest risk scheduling issue in the UI and explain what you changed.
```

```txt
Add a Friday evening cook shift from 16:00 to 22:00.
```

The assistant receives semantic app context from the frontend and can call `apply_scheduling_changes` to update the UI.

## 9. Build

```bash
bun run build
```

This produces:

- `dist/` static frontend
- `dist-server/` compiled local server

## 10. Run the production build locally

```bash
bun run build
bun run start
```

Then open:

```txt
http://localhost:8787
```

In production mode, the Bun/Express server serves `dist/` and handles the assistant WebSocket endpoint.

## 11. Deploy the static frontend to Cloudflare Pages

Build first:

```bash
bun run build
```

Authenticate Wrangler with an API token:

```bash
export CLOUDFLARE_API_TOKEN=your_token_here
```

Deploy:

```bash
bun run deploy:pages
```

Equivalent direct command:

```bash
bunx wrangler pages deploy dist --project-name pi-web
```

Important: Cloudflare Pages only hosts the static frontend. The assistant backend currently requires a Node/Bun-compatible server because it uses:

- `@earendil-works/pi-coding-agent`
- Express
- WebSockets via `ws`
- local filesystem sessions

For full deployed assistant functionality, deploy the backend separately to a Node/Bun host and point the frontend WebSocket URL at it, or rewrite the backend for Cloudflare Workers.

## 12. GitHub SSH setup, if push fails

GitHub SSH remotes look like this:

```txt
git@github.com:mjr-intellbits/pi-scheduler.git
```

The `git` username is normal. GitHub identifies you by your SSH key.

If needed, create a key:

```bash
ssh-keygen -t ed25519 -C "your_email@example.com"
```

Suggested file name:

```txt
~/.ssh/id_ed25519_mjr_intellbits
```

Add it to your agent:

```bash
ssh-add ~/.ssh/id_ed25519_mjr_intellbits
```

Copy the public key:

```bash
pbcopy < ~/.ssh/id_ed25519_mjr_intellbits.pub
```

Add it in GitHub:

```txt
GitHub → Settings → SSH and GPG keys → New SSH key
```

Set the repo remote to SSH:

```bash
git remote set-url origin git@github.com:mjr-intellbits/pi-scheduler.git
```

Test:

```bash
ssh -T git@github.com
```

Expected result should mention your GitHub username and successful authentication.

If GitHub still uses the wrong key, add this to `~/.ssh/config`:

```sshconfig
Host github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_ed25519_mjr_intellbits
  IdentitiesOnly yes
```

Then push:

```bash
git push -u origin main
```

## Scripts

```bash
bun run dev          # run frontend + backend in dev mode
bun run dev:client   # run Vite only
bun run dev:server   # run Bun/Express assistant server only
bun run build        # typecheck + build frontend/server
bun run start        # run production server locally
bun run deploy:pages # deploy dist/ to Cloudflare Pages
```

## Security notes

This is a demo, not production auth or authorization.

Before using this pattern in a real scheduling product:

- Replace name-only login with real authentication
- Add tenant/user authorization checks
- Add explicit confirmation before destructive schedule changes
- Validate every assistant-suggested mutation server-side
- Store sessions in a durable database instead of local files
- Restrict tools to domain-specific APIs
- Avoid exposing raw filesystem or shell tools in production
