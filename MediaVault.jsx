import { useState, useEffect, useRef } from "react";

// ── Constants ────────────────────────────────────────────────────────────────
const STORAGE_KEY = "mv3-items";
const CATS = ["movie", "show", "book", "game", "anime", "manga"];
const CAT_LABEL = { movie: "film", show: "show", book: "book", game: "game", anime: "anime", manga: "manga" };
const CAT_COLOR = { movie: "#ee9d64", show: "#67b8e0", book: "#7cd89a", game: "#c4a2f0", anime:"#ff7fb0", manga: "#b8b8c9" };
const STATUSES = ["want", "ongoing", "not_completed", "consumed"];
const PROGRESS_STATUSES = new Set(["ongoing", "not_completed"]);
const STATUS_NEXT = {
  want: "ongoing",
  ongoing: "not_completed",
  not_completed: "consumed",
  consumed: "want",
};
const STATUS_LABEL = {
  want: "want",
  ongoing: "ongoing",
  not_completed: "not completed",
  consumed: "done",
};
const STATUS_COLOR = {
  want: "#b2bbd8",
  ongoing: "#f0c856",
  not_completed: "#f47f70",
  consumed: "#82dda0",
};
const API_BASE = import.meta.env.VITE_API_BASE || "";

function defaultForm() {
  return {
    title: "",
    category: "movie",
    status: "ongoing",
    genre: "",
    rating: "",
    progress: "",
    source: "",
  };
}

async function apiJson(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const contentType = res.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await res.json()
    : null;
  if (!res.ok) {
    throw new Error(data?.error || "Database request failed.");
  }
  if (data === null) {
    throw new Error("The database API returned a webpage instead of JSON. Restart with npm run dev.");
  }
  return data;
}

function legacyItems() {
  try {
    const items = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

// ── CSS ──────────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&family=DM+Mono:wght@400&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

html { background: #08090a; }

body {
  background: #08090a;
  color: #e2e2e2;
  font-family: 'DM Sans', system-ui, sans-serif;
  font-size: 16px;
  font-weight: 400;
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
}

::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #33383d; border-radius: 4px; }

/* ─ Layout ─ */
.wrap { max-width: 1100px; margin: 0 auto; padding: 0 2rem; }

/* ─ Header ─ */
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 2.75rem 2.5rem 1.25rem;
  max-width: 1100px;
  margin: 0 auto;
}
.wordmark {
  font-size: 13px;
  font-weight: 400;
  color: #cfcfcf;
  letter-spacing: 0.14em;
  text-transform: lowercase;
  user-select: none;
}
.add-btn {
  background: #111315;
  border: 1px solid #34383d;
  color: #e4e4e4;
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  padding: 8px 18px;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
  border-radius: 4px;
  letter-spacing: 0.04em;
}
.add-btn:hover { border-color: #666d75; color: #ffffff; background: #171a1d; }

/* ─ Stats ─ */
.stats-line {
  padding: 0 2.5rem 1.4rem;
  max-width: 1100px;
  margin: 0 auto;
  font-size: 13px;
  color: #9b9b9b;
  font-family: 'DM Mono', monospace;
  display: flex;
  align-items: center;
  gap: 9px;
  flex-wrap: wrap;
}
.stats-line .sep { color: #555b61; }
.stat-val { color: inherit; }

/* ─ Filters ─ */
.filters {
  max-width: 1100px;
  margin: 0 auto;
  padding: 0 2.5rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.25rem;
  border-bottom: 1px solid #24282c;
  padding-bottom: 0.9rem;
  flex-wrap: wrap;
}
.tab-group, .sf-group { display: flex; gap: 4px; flex-wrap: wrap; }
.tab-btn, .sf-btn {
  background: none;
  border: 1px solid transparent;
  color: #82878d;
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  padding: 6px 11px;
  cursor: pointer;
  transition: color 0.12s, border-color 0.12s, background 0.12s;
  display: flex;
  align-items: center;
  gap: 4px;
  letter-spacing: 0.03em;
  border-radius: 4px;
}
.tab-btn:hover, .sf-btn:hover { color: #e8e8e8; border-color: #30363c; }
.tab-btn.active,
.sf-btn.active {
  color: #f4f4f4;
  border-color: #3b4249;
  background: #121518;
}
.cnt {
  font-family: 'DM Mono', monospace;
  font-size: 10px;
  opacity: 0.75;
}

/* ─ Search ─ */
.search-wrap {
  max-width: 1100px;
  margin: 0 auto;
  padding: 1rem 2.5rem;
  border-bottom: 1px solid #1d2125;
}
.search {
  background: none;
  border: none;
  color: #f0f0f0;
  font-family: inherit;
  font-size: 15px;
  font-weight: 400;
  padding: 0;
  width: 100%;
  outline: none;
}
.search::placeholder { color: #6b7076; }

.notice {
  max-width: 1100px;
  margin: 0 auto;
  padding: 0.75rem 2.5rem 0;
  color: #9aa8b6;
  font-family: 'DM Mono', monospace;
  font-size: 12px;
}
.notice.error { color: #ff9b91; }

/* ─ List ─ */
.list {
  max-width: 1100px;
  margin: 0 auto;
  padding: 0.5rem 2.5rem 1.5rem;
}

.row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 13px 0;
  border-bottom: 1px solid #1b1f23;
  position: relative;
  min-width: 0;
}
.row:last-child { border-bottom: none; }

.row-title {
  flex: 1;
  font-size: 16px;
  font-weight: 500;
  color: #eeeeee;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
  transition: color 0.12s;
  padding: 0;
  background: none;
  border: none;
  text-align: left;
  font-family: inherit;
}
.row-title:hover { color: #ffffff; }

.row-meta {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  flex-shrink: 0;
  flex-wrap: wrap;
  max-width: 58%;
}

.tag {
  font-family: 'DM Mono', monospace;
  font-size: 11px;
  white-space: nowrap;
}
.cat-tag  { color: #9fa5ab; }
.genre-tag { color: #c7b9a6; }
.status-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-family: 'DM Mono', monospace;
  font-size: 11px;
  padding: 0;
  transition: opacity 0.12s;
  white-space: nowrap;
}
.status-btn:hover { opacity: 0.75; }

.prog-tag { color: #efe19a; }
.src-tag  { color: #9aa8b6; }
.rating-tag { color: #f0bc5e; }

.del-btn {
  background: none;
  border: none;
  color: #858b92;
  cursor: pointer;
  font-size: 15px;
  padding: 0 3px;
  line-height: 1;
  flex-shrink: 0;
  transition: color 0.12s;
  font-family: inherit;
}
.del-btn:hover { color: #ff7b72; }

.empty {
  padding: 3.5rem 0;
  font-size: 13px;
  color: #858b92;
  font-family: 'DM Mono', monospace;
}

/* ─ AI Section ─ */
.ai-section {
  max-width: 1100px;
  margin: 0.75rem auto 0;
  padding: 0 2.5rem 4rem;
  border-top: 1px solid #202428;
}
.ai-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  background: none;
  border: none;
  color: #858b92;
  font-family: inherit;
  font-size: 13px;
  cursor: pointer;
  padding: 1rem 0;
  width: 100%;
  text-align: left;
  transition: color 0.12s;
  letter-spacing: 0.04em;
}
.ai-toggle:hover { color: #d8d8d8; }
.ai-dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #7a2020;
  flex-shrink: 0;
}
.ai-chevron { margin-left: auto; font-size: 13px; }

.ai-body { padding-bottom: 1rem; }
.ai-key {
  background: none;
  border: none;
  border-bottom: 1px solid #252a2f;
  color: #d8d8d8;
  font-family: 'DM Mono', monospace;
  font-size: 11px;
  padding: 5px 0;
  width: 100%;
  outline: none;
  margin-bottom: 10px;
  transition: border-color 0.15s;
}
.ai-key:focus { border-color: #58616a; }
.ai-key::placeholder { color: #62686e; }

.ai-row { display: flex; gap: 8px; align-items: flex-end; }
.ai-input {
  flex: 1;
  background: none;
  border: none;
  border-bottom: 1px solid #252a2f;
  color: #e0e0e0;
  font-family: inherit;
  font-size: 14px;
  font-weight: 400;
  padding: 5px 0;
  outline: none;
  transition: border-color 0.15s;
}
.ai-input:focus { border-color: #58616a; }
.ai-input::placeholder { color: #62686e; }

.ai-ask-btn {
  background: none;
  border: 1px solid #34383d;
  color: #d8d8d8;
  font-family: inherit;
  font-size: 13px;
  padding: 6px 14px;
  cursor: pointer;
  border-radius: 2px;
  transition: border-color 0.12s, color 0.12s;
  white-space: nowrap;
  margin-bottom: 1px;
}
.ai-ask-btn:hover { border-color: #666d75; color: #ffffff; }

.ai-res {
  margin-top: 1rem;
  font-family: 'DM Mono', monospace;
  font-size: 11px;
  color: #c8c8c8;
  white-space: pre-wrap;
  line-height: 1.85;
  padding-left: 1rem;
  border-left: 1px solid #34383d;
}

/* ─ Overlay & Modal ─ */
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.72);
  backdrop-filter: blur(3px);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.25rem;
}

.modal {
  background: #111315;
  border: 1px solid #34383d;
  border-radius: 6px;
  padding: 2rem 2.25rem 2.25rem;
  width: 560px;
  max-width: 100%;
}

.modal-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.75rem;
}
.modal-label {
  font-size: 12px;
  color: #d8d8d8;
  letter-spacing: 0.12em;
  text-transform: lowercase;
  font-family: 'DM Mono', monospace;
}
.modal-close {
  background: none;
  border: none;
  color: #9aa0a6;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  transition: color 0.12s;
  padding: 0;
  font-family: inherit;
}
.modal-close:hover { color: #ffffff; }

.field { margin-bottom: 1.35rem; }
.field-row { display: flex; gap: 1.5rem; margin-bottom: 1.35rem; }
.half { flex: 1; min-width: 0; }

.field > label,
.half > label {
  display: block;
  font-size: 11px;
  color: #9aa0a6;
  letter-spacing: 0.14em;
  text-transform: lowercase;
  margin-bottom: 7px;
  font-family: 'DM Mono', monospace;
}

.field input,
.half input {
  background: none;
  border: none;
  border-bottom: 1px solid #30363c;
  color: #f0f0f0;
  font-family: inherit;
  font-size: 15px;
  font-weight: 400;
  padding: 4px 0 8px;
  width: 100%;
  outline: none;
  transition: border-color 0.15s;
}
.field input:focus,
.half input:focus { border-color: #69717a; color: #ffffff; }
.field input::placeholder,
.half input::placeholder { color: #656b72; }

.picker { display: flex; gap: 6px; flex-wrap: wrap; }
.pick-btn {
  background: none;
  border: 1px solid #30363c;
  color: #a9afb5;
  font-family: 'DM Mono', monospace;
  font-size: 11px;
  padding: 6px 11px;
  border-radius: 4px;
  cursor: pointer;
  transition: border-color 0.12s, color 0.12s;
}
.pick-btn:hover { border-color: #69717a; color: #ffffff; }
.pick-btn.sel { border-color: currentColor; background: rgba(255,255,255,0.04); opacity: 1; }

.modal-footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 8px;
  margin-top: 1.5rem;
  padding-top: 1.25rem;
  border-top: 1px solid #252a2f;
}
.btn-cancel {
  background: none;
  border: none;
  color: #9aa0a6;
  font-family: inherit;
  font-size: 13px;
  cursor: pointer;
  padding: 5px 10px;
  transition: color 0.12s;
  letter-spacing: 0.04em;
}
.btn-cancel:hover { color: #ffffff; }
.btn-save {
  background: #15181b;
  border: 1px solid #3a4148;
  color: #f0f0f0;
  font-family: inherit;
  font-size: 13px;
  padding: 8px 20px;
  border-radius: 4px;
  cursor: pointer;
  transition: border-color 0.12s, color 0.12s;
  letter-spacing: 0.04em;
}
.btn-save:hover { border-color: #69717a; color: #ffffff; }

@media (max-width: 560px) {
  .header, .stats-line, .filters, .search-wrap, .notice, .list, .ai-section {
    padding-left: 1.25rem;
    padding-right: 1.25rem;
  }
  .filters { flex-direction: column; align-items: flex-start; }
  .field-row { flex-direction: column; gap: 1.25rem; }
  .row { align-items: flex-start; flex-direction: column; gap: 6px; }
  .row-meta { justify-content: flex-start; max-width: 100%; }
  .row-meta .cat-tag,
  .row-meta .src-tag { display: none; }
}
`;

// ── Component ────────────────────────────────────────────────────────────────
export default function binge() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState("");
  const [tab, setTab] = useState("all");
  const [sf, setSf] = useState("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(defaultForm());
  const [hovered, setHovered] = useState(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiQ, setAiQ] = useState("");
  const [aiRes, setAiRes] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const titleRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function loadItems() {
      setLoading(true);
      setDbError("");
      try {
        let saved = await apiJson("/api/items");
        saved = Array.isArray(saved) ? saved : [];
        const oldItems = legacyItems();
        if (saved.length === 0 && oldItems.length > 0) {
          saved = await apiJson("/api/items/import", {
            method: "POST",
            body: JSON.stringify({
              items: oldItems.map((item, index) => ({
                ...item,
                createdAt: Number(item.id) || Date.now() - index,
              })),
            }),
          });
          saved = Array.isArray(saved) ? saved : [];
          localStorage.setItem(`${STORAGE_KEY}-migrated`, "true");
        }
        if (!cancelled) setItems(saved);
      } catch (error) {
        if (!cancelled) setDbError(error.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadItems();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => titleRef.current?.focus(), 60);
  }, [open]);

  // Keyboard shortcut: Escape closes modal
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape" && open) setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const filtered = items.filter((i) => {
    if (tab !== "all" && i.category !== tab) return false;
    if (sf !== "all" && i.status !== sf) return false;
    if (q) {
      const query = q.toLowerCase();
      const haystack = [
        i.title,
        i.genre,
        i.source,
        CAT_LABEL[i.category],
        STATUS_LABEL[i.status],
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });

  const ratings = items.filter((i) => i.rating).map((i) => +i.rating);
  const stats = {
    total: items.length,
    consumed: items.filter((i) => i.status === "consumed").length,
    ongoing: items.filter((i) => i.status === "ongoing").length,
    notCompleted: items.filter((i) => i.status === "not_completed").length,
    want: items.filter((i) => i.status === "want").length,
    avg: ratings.length
      ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)
      : null,
  };

  const submit = async () => {
    if (!form.title.trim()) return;
    const rating = form.rating ? Math.min(10, Math.max(1, +form.rating)) : "";
    const cleaned = {
      ...form,
      title: form.title.trim(),
      genre: form.genre.trim(),
      source: form.source.trim(),
      progress: PROGRESS_STATUSES.has(form.status) ? form.progress.trim() : "",
      rating,
    };
    try {
      setDbError("");
      const saved = editId
        ? await apiJson(`/api/items/${editId}`, {
            method: "PUT",
            body: JSON.stringify(cleaned),
          })
        : await apiJson("/api/items", {
            method: "POST",
            body: JSON.stringify(cleaned),
          });
      setItems(saved);
      setEditId(null);
      setForm(defaultForm());
      setOpen(false);
    } catch (error) {
      setDbError(error.message);
    }
  };

  const del = async (id) => {
    try {
      setDbError("");
      setItems(
        await apiJson(`/api/items/${id}`, {
          method: "DELETE",
        })
      );
    } catch (error) {
      setDbError(error.message);
    }
  };

  const cycleStatus = async (id) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    const status = STATUS_NEXT[item.status] || "want";
    try {
      setDbError("");
      setItems(
        await apiJson(`/api/items/${id}`, {
          method: "PUT",
          body: JSON.stringify({
            ...item,
            status,
            progress: PROGRESS_STATUSES.has(status) ? item.progress : "",
          }),
        })
      );
    } catch (error) {
      setDbError(error.message);
    }
  };

  const openEdit = (item) => {
    setForm({
      title: item.title || "",
      category: item.category || "movie",
      status: item.status || "ongoing",
      genre: item.genre || "",
      rating: item.rating || "",
      progress: item.progress || "",
      source: item.source || "",
    });
    setEditId(item.id);
    setOpen(true);
  };

  const askAI = async () => {
    if (!aiQ.trim()) return;
    setAiLoading(true);
    setAiRes("");
    try {
      const data = await apiJson("/api/ai/recommend", {
        method: "POST",
        body: JSON.stringify({
          question: aiQ,
        }),
      });
      setAiRes(data.text || "-");
    } catch (e) {
      setAiRes("error: " + e.message);
    }
    setAiLoading(false);
  };

  const catCount = (c) => items.filter((i) => i.category === c).length;

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <>
      <style>{CSS}</style>

      {/* Header */}
      <header className="header">
        <span className="wordmark">binge</span>
        <button
          className="add-btn"
          onClick={() => {
            setEditId(null);
            setForm(defaultForm());
            setOpen(true);
          }}
        >
          + add
        </button>
      </header>

      {/* Stats */}
      <div className="stats-line">
        <span style={{ color: "#d8d8d8" }}>{stats.total} items</span>
        <span className="sep">·</span>
        <span style={{ color: STATUS_COLOR.consumed }}>{stats.consumed} done</span>
        <span className="sep">·</span>
        <span style={{ color: STATUS_COLOR.ongoing }}>{stats.ongoing} ongoing</span>
        <span className="sep">·</span>
        <span style={{ color: STATUS_COLOR.not_completed }}>
          {stats.notCompleted} not completed
        </span>
        <span className="sep">·</span>
        <span style={{ color: STATUS_COLOR.want }}>{stats.want} want</span>
        {stats.avg && (
          <>
            <span className="sep">·</span>
            <span style={{ color: "#f0bc5e" }}>avg {stats.avg}</span>
          </>
        )}
      </div>

      {/* Filters */}
      <div className="filters">
        <div className="tab-group">
          {["all", ...CATS].map((c) => (
            <button
              key={c}
              className={`tab-btn${tab === c ? " active" : ""}`}
              onClick={() => setTab(c)}
            >
              {c === "all" ? "all" : CAT_LABEL[c]}
              {c !== "all" && (
                <span className="cnt">{catCount(c)}</span>
              )}
            </button>
          ))}
        </div>
        <div className="sf-group">
          {["all", ...STATUSES].map((s) => (
            <button
              key={s}
              className={`sf-btn${sf === s ? " active" : ""}`}
              style={sf === s && s !== "all" ? { color: STATUS_COLOR[s] } : {}}
              onClick={() => setSf(s)}
            >
              {s === "all" ? "all" : STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="search-wrap">
        <input
          className="search"
          placeholder="search title, genre, source..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoComplete="off"
        />
      </div>

      {loading && <div className="notice">loading database...</div>}
      {dbError && <div className="notice error">database: {dbError}</div>}

      {/* List */}
      <div className="list">
        {loading ? (
          <div className="empty">opening your vault...</div>
        ) : filtered.length === 0 ? (
          <div className="empty">
            {q ? `nothing matching "${q}"` : items.length === 0 ? "your vault is empty." : "nothing here."}
          </div>
        ) : (
          filtered.map((item) => (
            <div
              key={item.id}
              className="row"
              onMouseEnter={() => setHovered(item.id)}
              onMouseLeave={() => setHovered(null)}
            >
              <button className="row-title" onClick={() => openEdit(item)}>
                {item.title}
              </button>

              <div className="row-meta">
                <span
                  className="tag cat-tag"
                  style={{ color: CAT_COLOR[item.category] || "#d8d8d8" }}
                >
                  {CAT_LABEL[item.category]}
                </span>

                {item.genre && (
                  <span className="tag genre-tag">{item.genre}</span>
                )}

                <button
                  className="status-btn tag"
                  style={{ color: STATUS_COLOR[item.status] || "#d8d8d8" }}
                  onClick={() => cycleStatus(item.id)}
                  title="click to cycle status"
                >
                  {STATUS_LABEL[item.status] || item.status}
                </button>

                {PROGRESS_STATUSES.has(item.status) && item.progress && (
                  <span className="tag prog-tag">{item.progress}</span>
                )}

                {item.source && (
                  <span className="tag src-tag">{item.source}</span>
                )}

                {item.rating && (
                  <span className="tag rating-tag">★{item.rating}</span>
                )}
              </div>

              {hovered === item.id && (
                <button
                  className="del-btn"
                  onClick={() => del(item.id)}
                  title="remove"
                >
                  ×
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {/* AI Section */}
      {items.length > 0 && (
        <div className="ai-section">
          <button className="ai-toggle" onClick={() => setAiOpen(!aiOpen)}>
            <span className="ai-dot" />
            ask ai
            <span className="ai-chevron">{aiOpen ? "−" : "+"}</span>
          </button>

          {aiOpen && (
            <div className="ai-body">
              <div className="ai-row">
                <input
                  className="ai-input"
                  placeholder="what should i watch next?"
                  value={aiQ}
                  onChange={(e) => setAiQ(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && askAI()}
                />
                <button className="ai-ask-btn" onClick={askAI}>
                  {aiLoading ? "..." : "ask"}
                </button>
              </div>
              {aiRes && <pre className="ai-res">{aiRes}</pre>}
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {open && (
        <div
          className="overlay"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="modal">
            <div className="modal-top">
              <span className="modal-label">
                {editId ? "edit entry" : "new entry"}
              </span>
              <button className="modal-close" onClick={() => setOpen(false)}>
                ×
              </button>
            </div>

            {/* Title */}
            <div className="field">
              <label>title</label>
              <input
                ref={titleRef}
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                placeholder="severance, dune, hollow knight..."
              />
            </div>

            {/* Category + Status */}
            <div className="field-row">
              <div className="half">
                <label>category</label>
                <div className="picker">
                  {CATS.map((c) => (
                    <button
                      key={c}
                      className={`pick-btn${form.category === c ? " sel" : ""}`}
                      style={
                        form.category === c
                          ? { color: CAT_COLOR[c], borderColor: CAT_COLOR[c] + "aa" }
                          : {}
                      }
                      onClick={() => setForm({ ...form, category: c })}
                    >
                      {CAT_LABEL[c]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="half">
                <label>status</label>
                <div className="picker">
                  {STATUSES.map((s) => (
                    <button
                      key={s}
                      className={`pick-btn${form.status === s ? " sel" : ""}`}
                      style={
                        form.status === s
                          ? { color: STATUS_COLOR[s], borderColor: STATUS_COLOR[s] + "aa" }
                          : {}
                      }
                      onClick={() =>
                        setForm((curr) => ({
                          ...curr,
                          status: s,
                          progress: PROGRESS_STATUSES.has(s) ? curr.progress : "",
                        }))
                      }
                    >
                      {STATUS_LABEL[s]}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Genre + Source */}
            <div className="field-row">
              <div className="half">
                <label>genre</label>
                <input
                  value={form.genre}
                  onChange={(e) => setForm({ ...form, genre: e.target.value })}
                  placeholder="thriller, sci-fi, cozy"
                />
              </div>
              <div className="half">
                <label>source</label>
                <input
                  value={form.source}
                  onChange={(e) => setForm({ ...form, source: e.target.value })}
                  placeholder="netflix, kindle, steam"
                />
              </div>
            </div>

            {/* Progress */}
            {PROGRESS_STATUSES.has(form.status) && (
              <div className="field">
                <label>progress</label>
                <input
                  value={form.progress}
                  onChange={(e) => setForm({ ...form, progress: e.target.value })}
                  placeholder="s2e4, ch.12, 40hrs"
                />
              </div>
            )}

            {/* Rating */}
            <div className="field">
              <label>rating (1-10)</label>
              <input
                type="number"
                min="1"
                max="10"
                value={form.rating}
                onChange={(e) => setForm({ ...form, rating: e.target.value })}
                placeholder="optional"
              />
            </div>

            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setOpen(false)}>
                cancel
              </button>
              <button className="btn-save" onClick={submit}>
                {editId ? "save" : "add"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
