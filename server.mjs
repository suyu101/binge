import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "0.0.0.0";
const DB_PATH = join(__dirname, "mediavault.db");
const DIST_DIR = join(__dirname, "dist");
const DATABASE_URL = process.env.DATABASE_URL || "";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

const CATEGORIES = new Set(["movie", "show", "book", "game"]);
const STATUSES = new Set(["want", "ongoing", "not_completed", "consumed"]);
const PROGRESS_STATUSES = new Set(["ongoing", "not_completed"]);

async function createSqliteStore() {
  const { DatabaseSync } = await import("node:sqlite");
  const db = new DatabaseSync(DB_PATH);
  db.exec(`
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'movie',
      status TEXT NOT NULL DEFAULT 'ongoing',
      genre TEXT NOT NULL DEFAULT '',
      rating TEXT NOT NULL DEFAULT '',
      progress TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL
    );
  `);

  const selectAll = db.prepare(`
    SELECT id, title, category, status, genre, rating, progress, source
    FROM items
    ORDER BY created_at DESC, id DESC
  `);

  const upsertItem = db.prepare(`
    INSERT INTO items (id, title, category, status, genre, rating, progress, source, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      category = excluded.category,
      status = excluded.status,
      genre = excluded.genre,
      rating = excluded.rating,
      progress = excluded.progress,
      source = excluded.source
  `);

  const updateItem = db.prepare(`
    UPDATE items
    SET title = ?, category = ?, status = ?, genre = ?, rating = ?, progress = ?, source = ?
    WHERE id = ?
  `);

  const deleteItem = db.prepare("DELETE FROM items WHERE id = ?");

  return {
    kind: "sqlite",
    async allItems() {
      return selectAll.all();
    },
    async saveItem(item) {
      upsertItem.run(
        item.id,
        item.title,
        item.category,
        item.status,
        item.genre,
        item.rating,
        item.progress,
        item.source,
        item.createdAt
      );
    },
    async saveItems(items) {
      const saveMany = db.transaction((rows) => {
        for (const item of rows) {
          upsertItem.run(
            item.id,
            item.title,
            item.category,
            item.status,
            item.genre,
            item.rating,
            item.progress,
            item.source,
            item.createdAt
          );
        }
      });
      saveMany(items);
    },
    async updateItem(item) {
      updateItem.run(
        item.title,
        item.category,
        item.status,
        item.genre,
        item.rating,
        item.progress,
        item.source,
        item.id
      );
    },
    async deleteItem(id) {
      deleteItem.run(id);
    },
  };
}

async function createPostgresStore() {
  const pg = await import("pg");
  const { Pool, types } = pg.default || pg;
  types.setTypeParser(20, (value) => Number(value));
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl:
      process.env.PGSSL === "false" || DATABASE_URL.includes("localhost")
        ? false
        : { rejectUnauthorized: false },
  });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS items (
      id BIGINT PRIMARY KEY,
      title TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'movie',
      status TEXT NOT NULL DEFAULT 'ongoing',
      genre TEXT NOT NULL DEFAULT '',
      rating TEXT NOT NULL DEFAULT '',
      progress TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT '',
      created_at BIGINT NOT NULL
    );
  `);

  const selectAll = `
    SELECT id, title, category, status, genre, rating, progress, source
    FROM items
    ORDER BY created_at DESC, id DESC
  `;

  const upsertSql = `
    INSERT INTO items (id, title, category, status, genre, rating, progress, source, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      category = excluded.category,
      status = excluded.status,
      genre = excluded.genre,
      rating = excluded.rating,
      progress = excluded.progress,
      source = excluded.source
  `;

  const values = (item) => [
    item.id,
    item.title,
    item.category,
    item.status,
    item.genre,
    item.rating,
    item.progress,
    item.source,
    item.createdAt,
  ];

  return {
    kind: "postgres",
    async allItems() {
      return (await pool.query(selectAll)).rows;
    },
    async saveItem(item) {
      await pool.query(upsertSql, values(item));
    },
    async saveItems(items) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        for (const item of items) await client.query(upsertSql, values(item));
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
    async updateItem(item) {
      await pool.query(
        `
          UPDATE items
          SET title = $1, category = $2, status = $3, genre = $4,
              rating = $5, progress = $6, source = $7
          WHERE id = $8
        `,
        [
          item.title,
          item.category,
          item.status,
          item.genre,
          item.rating,
          item.progress,
          item.source,
          item.id,
        ]
      );
    },
    async deleteItem(id) {
      await pool.query("DELETE FROM items WHERE id = $1", [id]);
    },
  };
}

const store = DATABASE_URL ? await createPostgresStore() : await createSqliteStore();

function cleanText(value) {
  return String(value ?? "").trim();
}

function cleanRating(value) {
  if (value === "" || value === null || value === undefined) return "";
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  return String(Math.min(10, Math.max(1, n)));
}

function normalizeItem(input) {
  const title = cleanText(input.title);
  if (!title) {
    const err = new Error("Title is required.");
    err.status = 400;
    throw err;
  }

  const category = CATEGORIES.has(input.category) ? input.category : "movie";
  const status = STATUSES.has(input.status) ? input.status : "ongoing";

  return {
    id: Number.isSafeInteger(Number(input.id)) ? Number(input.id) : Date.now(),
    title,
    category,
    status,
    genre: cleanText(input.genre),
    rating: cleanRating(input.rating),
    progress: PROGRESS_STATUSES.has(status) ? cleanText(input.progress) : "",
    source: cleanText(input.source),
    createdAt: Number.isSafeInteger(Number(input.createdAt))
      ? Number(input.createdAt)
      : Date.now(),
  };
}

async function readJson(req) {
  let body = "";
  for await (const chunk of req) body += chunk;
  if (!body) return {};
  try {
    return JSON.parse(body);
  } catch {
    const err = new Error("Request body must be valid JSON.");
    err.status = 400;
    throw err;
  }
}

function itemSummary(item) {
  return [
    `${item.category}: "${item.title}"`,
    item.status && `status ${item.status}`,
    item.genre && `genre ${item.genre}`,
    item.rating && `rating ${item.rating}/10`,
    item.progress && `progress ${item.progress}`,
    item.source && `source ${item.source}`,
  ]
    .filter(Boolean)
    .join(", ");
}

function geminiText(data) {
  return (
    data?.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("")
      .trim() || ""
  );
}

function sendJson(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  });
  res.end(JSON.stringify(data));
}

function sendError(res, error) {
  sendJson(res, error.status || 500, {
    error: error.status ? error.message : "Something went wrong.",
  });
}

function notFound(res) {
  sendJson(res, 404, { error: "Not found." });
}

async function serveStatic(req, res) {
  if (!existsSync(DIST_DIR)) {
    sendJson(res, 404, {
      error: "Build the frontend first with npm run build, or use npm run dev.",
    });
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const requested = url.pathname === "/" ? "/index.html" : url.pathname;
  const filepath = normalize(join(DIST_DIR, decodeURIComponent(requested)));

  if (!filepath.startsWith(DIST_DIR)) {
    notFound(res);
    return;
  }

  const target = existsSync(filepath) ? filepath : join(DIST_DIR, "index.html");
  const type =
    {
      ".html": "text/html; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".svg": "image/svg+xml",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".ico": "image/x-icon",
    }[extname(target)] || "application/octet-stream";

  try {
    const file = await readFile(target);
    res.writeHead(200, { "Content-Type": type });
    res.end(file);
  } catch {
    notFound(res);
  }
}

async function handleApi(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === "/api/health" && req.method === "GET") {
    sendJson(res, 200, { ok: true, database: store.kind });
    return;
  }

  if (url.pathname === "/api/items" && req.method === "GET") {
    sendJson(res, 200, await store.allItems());
    return;
  }

  if (url.pathname === "/api/ai/recommend" && req.method === "POST") {
    if (!GEMINI_API_KEY) {
      const err = new Error("GEMINI_API_KEY is not configured on the server.");
      err.status = 400;
      throw err;
    }

    const body = await readJson(req);
    const question = cleanText(body.question);
    if (!question) {
      const err = new Error("Ask a question first.");
      err.status = 400;
      throw err;
    }

    const items = await store.allItems();
    const library = items.length
      ? items.map((item) => `- ${itemSummary(item)}`).join("\n")
      : "The vault is empty.";

    const prompt = [
      "You are a concise, fun media recommendation assistant.",
      "Use only the user's vault data when it is relevant.",
      "Give short bullet points and practical suggestions.",
      "",
      `Vault:\n${library}`,
      "",
      `Question:\n${question}`,
    ].join("\n");

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": GEMINI_API_KEY,
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 700,
          },
        }),
      }
    );

    const data = await geminiRes.json().catch(() => null);
    if (!geminiRes.ok) {
      const err = new Error(data?.error?.message || "Gemini request failed.");
      err.status = geminiRes.status;
      throw err;
    }

    sendJson(res, 200, {
      text: geminiText(data) || "No response text returned.",
      model: GEMINI_MODEL,
    });
    return;
  }

  if (url.pathname === "/api/items" && req.method === "POST") {
    const item = normalizeItem(await readJson(req));
    await store.saveItem(item);
    sendJson(res, 201, await store.allItems());
    return;
  }

  if (url.pathname === "/api/items/import" && req.method === "POST") {
    const body = await readJson(req);
    const items = Array.isArray(body.items) ? body.items.map(normalizeItem) : [];
    await store.saveItems(items);
    sendJson(res, 201, await store.allItems());
    return;
  }

  const itemMatch = url.pathname.match(/^\/api\/items\/(\d+)$/);
  if (itemMatch && req.method === "PUT") {
    const item = normalizeItem({ ...(await readJson(req)), id: Number(itemMatch[1]) });
    await store.updateItem(item);
    sendJson(res, 200, await store.allItems());
    return;
  }

  if (itemMatch && req.method === "DELETE") {
    await store.deleteItem(Number(itemMatch[1]));
    sendJson(res, 200, await store.allItems());
    return;
  }

  notFound(res);
}

createServer(async (req, res) => {
  try {
    if (req.method === "OPTIONS") {
      sendJson(res, 204, null);
      return;
    }
    if (req.url?.startsWith("/api/")) {
      await handleApi(req, res);
      return;
    }
    await serveStatic(req, res);
  } catch (error) {
    sendError(res, error);
  }
}).listen(PORT, HOST, () => {
  const shownHost = HOST === "0.0.0.0" ? "localhost" : HOST;
  console.log(`MediaVault API running at http://${shownHost}:${PORT}`);
  console.log(
    store.kind === "postgres"
      ? "Database: Postgres from DATABASE_URL"
      : `Database: ${DB_PATH}`
  );
});
