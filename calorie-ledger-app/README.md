# Calorie Ledger

Photo-based calorie tracker: scan a meal, get an AI estimate, track against a
daily target calculated from your stats. Installable as a home-screen app
(PWA) on iOS and Android.

## Local dev

```bash
npm install
npm run dev
```

Note: `/api/scan` is a Vercel serverless function, so it won't work with
plain `vite dev`. Use `vercel dev` instead if you want to test the scan
feature locally (see below), or just deploy and test on the live URL.

## Deploy to Vercel

1. Push this folder to a new GitHub repo (or import directly from your
   machine with the Vercel CLI).
2. In Vercel: **New Project** -> import the repo.
3. Framework preset: Vite (auto-detected).
4. **Settings -> Environment Variables** -> add:
   - `ANTHROPIC_API_KEY` = your Anthropic API key (get one at
     console.anthropic.com if you don't have one separate from your
     claude.ai account)
5. Deploy.

Or via CLI from this folder:

```bash
npm install -g vercel   # if not already installed
vercel login
vercel                  # first deploy, follow prompts
vercel env add ANTHROPIC_API_KEY   # paste your key when prompted
vercel --prod
```

## Install on your phone

Once deployed:
- **iPhone (Safari):** open the URL -> Share icon -> "Add to Home Screen"
- **Android (Chrome):** open the URL -> menu (⋮) -> "Install app" / "Add to
  Home Screen"

It'll launch full-screen with its own icon, no browser bar.

## Notes

- Data (today's log, weight history, your stats) is stored in the phone's
  local browser storage — it stays on-device and isn't synced anywhere. If
  you clear Safari/Chrome site data or switch phones, it resets. Fine for a
  single-device personal tracker; let me know if you want it synced to a
  real backend instead (e.g. a small database on Vercel) so it follows you
  across devices.
- Calorie estimates come straight from the model reading the photo — treat
  them as a ballpark, not a lab measurement.
- Cost: each scan is one Claude API call with an image, billed to your
  Anthropic account. At normal use (a few scans a day) this is pennies a
  month, but it's worth glancing at usage on console.anthropic.com
  occasionally.
