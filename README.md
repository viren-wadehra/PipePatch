# CI/CD Failure Explainer

A GitHub App that automatically analyses failed GitHub Actions workflows and posts a plain-English explanation + fix directly to your commit.

Powered by **Gemini 2.0 Flash** — runs free within Google's generous API limits.

---

## What it does

When a GitHub Actions workflow fails, this app:
1. Receives the webhook event
2. Downloads and extracts the failure logs
3. Sends the relevant portion to Gemini 2.0 Flash
4. Posts a structured explanation as a commit comment

Example comment:

> **🔴 Root Cause**
> The Docker build failed because the base image `node:18-alpine` could not be pulled due to a rate limit on Docker Hub.
>
> **📖 Explanation**
> GitHub Actions runners share Docker Hub IPs, causing rate limits to trigger frequently in CI environments...
>
> **🛠 Fix**
> 1. Authenticate to Docker Hub in your workflow...

---

## Setup

### 1. Get a free Gemini API key
Go to [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) and create a key. Free tier: 15 req/min, 1M tokens/min.

### 2. Create a GitHub App

1. Go to **GitHub → Settings → Developer Settings → GitHub Apps → New GitHub App**
2. Fill in:
   - **Name:** CI/CD Failure Explainer (or anything)
   - **Homepage URL:** your Railway/Fly.io URL (or `http://localhost:3000` for now)
   - **Webhook URL:** your public URL + `/api/github/webhooks`
   - **Webhook secret:** generate a random string (`openssl rand -hex 32`)
3. Set **Permissions:**
   - Repository → Actions: **Read-only**
   - Repository → Commit statuses: **Read & Write**
   - Repository → Contents: **Read-only** *(for commit comments)*
   - Repository → Pull requests: **Read & Write**
4. Subscribe to events: ✅ **Workflow run**
5. Create the app, then generate and download a **private key**

### 3. Configure environment variables

```bash
cp .env.example .env
```

Fill in your `.env`:
```
GITHUB_APP_ID=        # Found on your app's settings page
GITHUB_PRIVATE_KEY=   # Contents of the .pem file you downloaded (paste as one line with \n)
GITHUB_WEBHOOK_SECRET= # The random string you used above
GEMINI_API_KEY=        # From Google AI Studio
```

**Pasting the private key:** Run this to convert the .pem to a single line:
```bash
awk 'NF {sub(/\r/, ""); printf "%s\\n",$0;}' your-app.pem
```
Then paste the output as the value of `GITHUB_PRIVATE_KEY`.

### 4. Run locally with a tunnel (for testing)

Install smee-client globally:
```bash
npm install -g smee-client
```

Create a smee channel at [smee.io](https://smee.io) and copy the URL.

In two terminals:
```bash
# Terminal 1 — start the server
npm run dev

# Terminal 2 — start the tunnel
SMEE_URL=https://smee.io/your-channel-id npm run tunnel
```

Update your GitHub App's webhook URL to the smee URL.

### 5. Install the app on your repo

Go to your GitHub App's settings → **Install App** → select your repo.

Trigger a workflow failure and watch the magic happen in your terminal.

---

## Deploy to Railway (production)

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway init
railway up
```

Set your environment variables in the Railway dashboard, then update your GitHub App's webhook URL to your Railway URL.

---

## Project structure

```
src/
├── index.js      # Express server entry point
├── github.js     # GitHub App setup + webhook listener
├── handler.js    # Core orchestration logic
├── logs.js       # Log fetching + signal extraction
└── gemini.js     # Gemini 2.0 Flash integration
```

---

## Pricing / cost

| Tier | Cost |
|------|------|
| Gemini 2.0 Flash free tier | $0 (15 req/min) |
| Gemini 2.0 Flash paid | $0.10/1M input tokens |
| Railway hosting | ~$5/month |

At $0.10/1M tokens, analysing a typical failure log (~2k tokens in, ~500 out) costs **~$0.00035**. Essentially free.
