import { useState, useEffect, useRef } from "react";

const SUBJECTS = [
  { key: "all",            label: "All Notes",      color: "#38bdf8", dot: "#38bdf8" },
  { key: "biochemistry",   label: "Biochemistry",   color: "#0ea5e9", dot: "#0ea5e9" },
  { key: "physiology",     label: "Physiology",     color: "#f59e0b", dot: "#f59e0b" },
  { key: "dental-anatomy", label: "Dental Anatomy", color: "#a78bfa", dot: "#a78bfa" },
  { key: "anatomy",        label: "Anatomy",        color: "#fb923c", dot: "#fb923c" },
];

const SUBJECT_MAP = Object.fromEntries(
  SUBJECTS.filter(s => s.key !== "all").map(s => [s.key, s])
);

const STORAGE_KEY = "mednotes-shared-v2";
const MAX_FILE_MB = 4;

const FILE_ICONS = {
  pdf: "📄", doc: "📝", docx: "📝", txt: "📃",
  png: "🖼️", jpg: "🖼️", jpeg: "🖼️", gif: "🖼️", webp: "🖼️",
  ppt: "📊", pptx: "📊", xls: "📊", xlsx: "📊",
};
function fileIcon(name = "") {
  const ext = name.split(".").pop().toLowerCase();
  return FILE_ICONS[ext] || "📎";
}
function isImage(name = "") {
  return /\.(png|jpe?g|gif|webp)$/i.test(name);
}

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function readFileAsBase64(file) {
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => res(reader.result); // data URL
    reader.onerror = rej;
    reader.readAsDataURL(file);
  });
}

export default function MedNotes() {
  const [notes, setNotes]       = useState([]);
  const [filter, setFilter]     = useState("all");
  const [search, setSearch]     = useState("");
  const [modal, setModal]       = useState(false);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview]   = useState(null); // { note, file index }
  const [form, setForm]         = useState({ title: "", subject: "biochemistry", body: "", author: "" });
  const [files, setFiles]       = useState([]); // [{name, size, dataUrl, type}]
  const [error, setError]       = useState("");
  const pollRef  = useRef(null);
  const fileRef  = useRef(null);

  async function loadNotes() {
    try {
      const res = await window.storage.get(STORAGE_KEY, true);
      const data = res ? JSON.parse(res.value) : [];
      setNotes(Array.isArray(data) ? data : []);
    } catch { setNotes([]); }
    setLoading(false);
  }

  async function saveNotes(updated) {
    await window.storage.set(STORAGE_KEY, JSON.stringify(updated), true);
  }

  useEffect(() => {
    loadNotes();
    pollRef.current = setInterval(loadNotes, 8000);
    return () => clearInterval(pollRef.current);
  }, []);

  const filtered = notes.filter(n => {
    const matchF = filter === "all" || n.subject === filter;
    const q = search.toLowerCase();
    const matchS = !q || n.title.toLowerCase().includes(q) ||
      n.body.toLowerCase().includes(q) || (n.author || "").toLowerCase().includes(q);
    return matchF && matchS;
  });

  function countFor(key) {
    return key === "all" ? notes.length : notes.filter(n => n.subject === key).length;
  }

  async function processFiles(rawFiles) {
    const results = [];
    for (const f of Array.from(rawFiles)) {
      if (f.size > MAX_FILE_MB * 1024 * 1024) {
        setError(`"${f.name}" exceeds ${MAX_FILE_MB} MB limit.`);
        continue;
      }
      const dataUrl = await readFileAsBase64(f);
      results.push({ name: f.name, size: f.size, type: f.type, dataUrl });
    }
    setFiles(prev => [...prev, ...results]);
  }

  function handleFileInput(e) {
    if (e.target.files?.length) processFiles(e.target.files);
  }

  function handleDrop(e) {
    e.preventDefault(); setDragOver(false);
    if (e.dataTransfer.files?.length) processFiles(e.dataTransfer.files);
  }

  function removeFile(i) {
    setFiles(prev => prev.filter((_, idx) => idx !== i));
  }

  async function handleSave() {
    if (!form.title.trim()) { setError("Please enter a title."); return; }
    setSaving(true);
    const newNote = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2),
      title: form.title.trim(),
      subject: form.subject,
      body: form.body.trim(),
      author: form.author.trim() || "Anonymous",
      date: new Date().toISOString(),
      files: files.map(f => ({ name: f.name, size: f.size, type: f.type, dataUrl: f.dataUrl })),
    };
    const updated = [newNote, ...notes];
    try {
      await saveNotes(updated);
      setNotes(updated);
      setModal(false);
      setForm({ title: "", subject: "biochemistry", body: "", author: "" });
      setFiles([]);
      setError("");
    } catch (e) {
      setError("Failed to save — files may be too large. Try smaller files.");
    }
    setSaving(false);
  }

  async function handleDelete(id) {
    const updated = notes.filter(n => n.id !== id);
    await saveNotes(updated);
    setNotes(updated);
  }

  function downloadFile(f) {
    const a = document.createElement("a");
    a.href = f.dataUrl;
    a.download = f.name;
    a.click();
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  const inp = {
    width: "100%", background: "#f0f9ff", border: "1.5px solid #bae6fd",
    borderRadius: 8, padding: "9px 13px", color: "#0f172a",
    fontFamily: "Inter, sans-serif", fontSize: 14, outline: "none", resize: "vertical",
  };

  return (
    <div style={{ fontFamily: "Inter, system-ui, sans-serif", minHeight: "100vh", background: "#fff", color: "#1e293b", display: "flex", flexDirection: "column" }}>

      {/* HEADER */}
      <header style={{ background: "#fff", borderBottom: "1.5px solid #bae6fd", padding: "0 28px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 50, boxShadow: "0 1px 6px rgba(56,189,248,.08)" }}>
        <div style={{ fontFamily: "Georgia, serif", fontSize: "1.4rem", fontWeight: 700, color: "#0369a1" }}>
          Med<span style={{ color: "#38bdf8" }}>Notes</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search notes…"
            style={{ ...inp, width: 200, resize: "none" }} />
          <button onClick={() => { setModal(true); setError(""); setFiles([]); }}
            style={{ display: "flex", alignItems: "center", gap: 7, background: "#38bdf8", color: "#0c4a6e", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
            <span style={{ fontSize: 18 }}>+</span> New Note
          </button>
        </div>
      </header>

      <div style={{ display: "flex", flex: 1 }}>

        {/* SIDEBAR */}
        <aside style={{ width: 210, minWidth: 210, background: "#fff", borderRight: "1.5px solid #bae6fd", padding: "24px 14px", display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em", color: "#94a3b8", padding: "0 8px 10px" }}>Subjects</div>
          {SUBJECTS.map(s => (
            <button key={s.key} onClick={() => setFilter(s.key)}
              style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 10px", borderRadius: 8, border: "none", background: filter === s.key ? "#e0f2fe" : "transparent", color: filter === s.key ? "#0369a1" : "#334155", fontWeight: filter === s.key ? 600 : 400, fontSize: 14, cursor: "pointer", textAlign: "left", width: "100%" }}>
              {s.key !== "all" ? <span style={{ width: 8, height: 8, borderRadius: "50%", background: s.dot, flexShrink: 0 }} /> : <span>📚</span>}
              <span style={{ flex: 1 }}>{s.label}</span>
              <span style={{ background: filter === s.key ? "#7dd3fc" : "#e0f2fe", color: filter === s.key ? "#0c4a6e" : "#0369a1", borderRadius: 20, fontSize: 11, padding: "1px 7px", fontWeight: 600 }}>{countFor(s.key)}</span>
            </button>
          ))}
          <div style={{ borderTop: "1px solid #bae6fd", margin: "12px 0" }} />
          <div style={{ fontSize: 11, color: "#94a3b8", padding: "0 8px", lineHeight: 1.6 }}>Shared with all users · auto-refreshes every 8s</div>
          <button onClick={loadNotes} style={{ marginTop: 6, background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 7, padding: "7px 10px", fontSize: 12, color: "#0369a1", cursor: "pointer", fontWeight: 500 }}>
            🔄 Refresh
          </button>
        </aside>

        {/* MAIN */}
        <main style={{ flex: 1, padding: 28, overflowY: "auto", background: "#fff" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
            <h1 style={{ fontFamily: "Georgia, serif", fontSize: "1.6rem", fontStyle: "italic", color: "#0369a1" }}>
              {SUBJECTS.find(s => s.key === filter)?.label}
            </h1>
            <span style={{ fontSize: 13, color: "#94a3b8" }}>{filtered.length} note{filtered.length !== 1 ? "s" : ""}</span>
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: 80, color: "#94a3b8" }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>Loading shared notes…
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: 80, color: "#94a3b8" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📝</div>
              <div style={{ fontWeight: 600, color: "#475569", marginBottom: 6 }}>{search ? "No results" : "No notes yet"}</div>
              <div style={{ fontSize: 14 }}>{search ? "Try a different search." : "Be the first to upload a note!"}</div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: 16 }}>
              {filtered.map(n => {
                const sub = SUBJECT_MAP[n.subject] || SUBJECTS[1];
                return (
                  <div key={n.id}
                    style={{ background: "#fff", border: "1.5px solid #e0f2fe", borderLeft: `4px solid ${sub.color}`, borderRadius: 12, padding: "16px 18px 14px", boxShadow: "0 1px 5px rgba(56,189,248,.07)", transition: "box-shadow .15s, transform .15s" }}
                    onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 6px 20px rgba(56,189,248,.14)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                    onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 1px 5px rgba(56,189,248,.07)"; e.currentTarget.style.transform = "none"; }}>

                    {/* top row */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ background: sub.color + "22", color: sub.color, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em", padding: "3px 10px", borderRadius: 20 }}>{sub.label}</span>
                      <button onClick={() => handleDelete(n.id)}
                        style={{ background: "none", border: "none", cursor: "pointer", fontSize: 15, color: "#cbd5e1" }}
                        onMouseEnter={e => e.currentTarget.style.color = "#f87171"}
                        onMouseLeave={e => e.currentTarget.style.color = "#cbd5e1"}>🗑</button>
                    </div>

                    <div style={{ fontWeight: 700, fontSize: 15, color: "#0f172a", marginBottom: 5, lineHeight: 1.35 }}>{n.title}</div>
                    {n.body && <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.6, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden", marginBottom: 8 }}>{n.body}</div>}

                    {/* image previews */}
                    {n.files?.filter(f => isImage(f.name)).length > 0 && (
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                        {n.files.filter(f => isImage(f.name)).map((f, i) => (
                          <img key={i} src={f.dataUrl} alt={f.name}
                            onClick={() => setPreview({ note: n, file: f })}
                            style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 6, border: "1px solid #bae6fd", cursor: "pointer" }} />
                        ))}
                      </div>
                    )}

                    {/* non-image files */}
                    {n.files?.filter(f => !isImage(f.name)).map((f, i) => (
                      <div key={i}
                        onClick={() => downloadFile(f)}
                        style={{ display: "flex", alignItems: "center", gap: 8, background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 7, padding: "6px 10px", marginBottom: 4, cursor: "pointer", fontSize: 12, color: "#0369a1" }}
                        onMouseEnter={e => e.currentTarget.style.background = "#e0f2fe"}
                        onMouseLeave={e => e.currentTarget.style.background = "#f0f9ff"}>
                        <span style={{ fontSize: 16 }}>{fileIcon(f.name)}</span>
                        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                        <span style={{ color: "#94a3b8", flexShrink: 0 }}>{formatSize(f.size)}</span>
                        <span>⬇</span>
                      </div>
                    ))}

                    <div style={{ marginTop: 10, display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, color: "#94a3b8" }}>
                      <span>👤 {n.author}</span>
                      <span>{timeAgo(n.date)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {/* UPLOAD MODAL */}
      {modal && (
        <div onClick={e => { if (e.target === e.currentTarget) { setModal(false); setFiles([]); } }}
          style={{ position: "fixed", inset: 0, background: "rgba(14,42,71,.35)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }}>
          <div style={{ background: "#fff", border: "1.5px solid #bae6fd", borderRadius: 16, padding: 32, width: 500, maxWidth: "96vw", maxHeight: "92vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(56,189,248,.15)", animation: "pop .2s ease" }}>
            <h2 style={{ fontFamily: "Georgia, serif", fontSize: "1.35rem", color: "#0369a1", marginBottom: 22 }}>Upload a Note</h2>

            {error && (
              <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "9px 13px", marginBottom: 14, fontSize: 13, color: "#dc2626" }}>{error}</div>
            )}

            {/* Author */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em", color: "#64748b", marginBottom: 5 }}>Your Name</label>
              <input style={inp} placeholder="e.g. Gokul" value={form.author} onChange={e => setForm(f => ({ ...f, author: e.target.value }))} />
            </div>

            {/* Subject */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em", color: "#64748b", marginBottom: 5 }}>Subject</label>
              <select style={{ ...inp, resize: "none" }} value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}>
                <option value="biochemistry">Biochemistry</option>
                <option value="physiology">Physiology</option>
                <option value="dental-anatomy">Dental Anatomy</option>
                <option value="anatomy">Anatomy</option>
              </select>
            </div>

            {/* Title */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em", color: "#64748b", marginBottom: 5 }}>Title</label>
              <input style={inp} placeholder="e.g. Krebs Cycle Summary" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>

            {/* Body */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em", color: "#64748b", marginBottom: 5 }}>Note Content <span style={{ fontWeight: 400, textTransform: "none" }}>(optional)</span></label>
              <textarea style={{ ...inp, minHeight: 90 }} placeholder="Write your notes here…" value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} />
            </div>

            {/* Drop zone */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em", color: "#64748b", marginBottom: 5 }}>Attach Files <span style={{ fontWeight: 400, textTransform: "none" }}>— PDF, DOC, images, etc. (max {MAX_FILE_MB} MB each)</span></label>
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                style={{ border: `2px dashed ${dragOver ? "#38bdf8" : "#bae6fd"}`, background: dragOver ? "#e0f2fe" : "#f0f9ff", borderRadius: 10, padding: "22px 16px", textAlign: "center", cursor: "pointer", transition: "all .2s" }}>
                <input ref={fileRef} type="file" multiple style={{ display: "none" }} onChange={handleFileInput} />
                <div style={{ fontSize: 26, marginBottom: 6 }}>📂</div>
                <div style={{ fontSize: 13, color: "#0369a1", fontWeight: 600 }}>Drag & drop files here</div>
                <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 3 }}>or click to browse</div>
              </div>
            </div>

            {/* File list preview */}
            {files.length > 0 && (
              <div style={{ marginBottom: 16, display: "flex", flexDirection: "column", gap: 6 }}>
                {files.map((f, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 8, padding: "7px 12px" }}>
                    {isImage(f.name)
                      ? <img src={f.dataUrl} alt={f.name} style={{ width: 36, height: 36, objectFit: "cover", borderRadius: 5, border: "1px solid #bae6fd" }} />
                      : <span style={{ fontSize: 22 }}>{fileIcon(f.name)}</span>}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</div>
                      <div style={{ fontSize: 11, color: "#94a3b8" }}>{formatSize(f.size)}</div>
                    </div>
                    <button onClick={() => removeFile(i)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 16, lineHeight: 1 }}
                      onMouseEnter={e => e.currentTarget.style.color = "#f87171"}
                      onMouseLeave={e => e.currentTarget.style.color = "#94a3b8"}>✕</button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => { setModal(false); setFiles([]); setError(""); }}
                style={{ background: "transparent", border: "1.5px solid #bae6fd", borderRadius: 8, padding: "9px 18px", color: "#64748b", fontSize: 14, cursor: "pointer" }}>Cancel</button>
              <button onClick={handleSave} disabled={saving}
                style={{ background: "#38bdf8", color: "#0c4a6e", border: "none", borderRadius: 8, padding: "9px 22px", fontSize: 14, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? .7 : 1 }}>
                {saving ? "Saving…" : `Save Note${files.length ? ` + ${files.length} file${files.length > 1 ? "s" : ""}` : ""}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IMAGE LIGHTBOX */}
      {preview && (
        <div onClick={() => setPreview(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.8)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", cursor: "zoom-out" }}>
          <div onClick={e => e.stopPropagation()} style={{ position: "relative", maxWidth: "90vw", maxHeight: "90vh" }}>
            <img src={preview.file.dataUrl} alt={preview.file.name}
              style={{ maxWidth: "90vw", maxHeight: "85vh", borderRadius: 10, boxShadow: "0 8px 40px rgba(0,0,0,.6)" }} />
            <div style={{ textAlign: "center", marginTop: 10, color: "#e2e8f0", fontSize: 13 }}>{preview.file.name}</div>
            <button onClick={() => downloadFile(preview.file)}
              style={{ position: "absolute", top: -12, right: 40, background: "#38bdf8", color: "#0c4a6e", border: "none", borderRadius: 7, padding: "6px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>⬇ Download</button>
            <button onClick={() => setPreview(null)}
              style={{ position: "absolute", top: -12, right: -4, background: "#f87171", color: "#fff", border: "none", borderRadius: 7, padding: "6px 11px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>✕</button>
          </div>
        </div>
      )}

      <style>{`@keyframes pop { from { transform: scale(.93); opacity: 0; } to { transform: scale(1); opacity: 1; } }`}</style>
    </div>
  );
}
