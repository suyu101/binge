# MediaVault Deployment Guide

This project deploys as one Node web service:

- Vite builds the React frontend into `dist/`
- `server.mjs` serves the frontend and `/api/*`
- Local dev uses SQLite
- Production uses Postgres when `DATABASE_URL` is set

## 1. Upload To GitHub

Create an empty GitHub repository. Do not initialize it with a README, `.gitignore`, or license because this project already has those files.

Then run these commands in this folder:

```powershell
git init
git add .
git commit -m "Initial MediaVault app"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/mediavault.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your GitHub username.

## 2. Create Hosted Postgres

Use Neon, Supabase, Railway, Render Postgres, or any hosted Postgres provider.

For Neon:

1. Create a Neon account.
2. Create a new project.
3. Open the project dashboard.
4. Click **Connect**.
5. Copy the pooled Postgres connection string.
6. Save it for Render as `DATABASE_URL`.

The connection string should look roughly like:

```text
postgresql://user:password@host/database?sslmode=require
```

Never commit this value to GitHub.

## 3. Deploy On Render

1. Go to Render.
2. Create a new **Web Service** from your GitHub repo.
3. Use these settings:

```text
Runtime: Node
Build Command: npm install && npm run build
Start Command: npm run start
Health Check Path: /api/health
```

4. Add this environment variable:

```text
DATABASE_URL=your hosted Postgres connection string
```

5. Deploy.

Render can also detect `render.yaml` in this repo. If you create from Blueprint, Render will still ask you to provide the secret `DATABASE_URL` value.

## 4. Verify The Deployment

After deploy finishes, open:

```text
https://YOUR_RENDER_URL/api/health
```

You should see:

```json
{"ok":true,"database":"postgres"}
```

Then open your normal app URL:

```text
https://YOUR_RENDER_URL/
```

Add one test item, refresh, and open the site from another browser/device. The item should still be there.

## Important

Production data should live in hosted Postgres through `DATABASE_URL`. Do not deploy or rely on the local `mediavault.db` file.

This app does not have login/auth yet. If you deploy it publicly, anyone with the URL can currently read, add, edit, or delete entries. Add authentication before sharing the URL widely.
