# MediaVault

MediaVault is a full-stack media tracker with:

- React frontend
- Node API server
- SQLite for local development
- Postgres for production via `DATABASE_URL`

## Run Locally

```powershell
npm install
npm run dev
```

Open:

```text
http://127.0.0.1:5173/
```

Local database file:

```text
mediavault.db
```

## Production

Set a hosted Postgres connection string:

```text
DATABASE_URL=postgresql://...
```

Build command:

```text
npm install && npm run build
```

Start command:

```text
npm run start
```

Health check:

```text
/api/health
```

## Notes

The deployed app serves the frontend and backend from the same Node service. Do not deploy `mediavault.db`; production data belongs in hosted Postgres.

There is no login yet. Do not share the public URL widely until authentication is added.
