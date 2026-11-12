import { useEffect, useMemo, useState } from "react";
import { api } from "./api.js";

const EMPTY = {
  title: "",
  artist: "",
  album: "",
  year: new Date().getFullYear(),
  duration: "",
  genre: "Pop",
  lyricsHook: "",
};

export default function App() {
  const [songs, setSongs] = useState([]);
  const [health, setHealth] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [cover, setCover] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [list, status] = await Promise.all([api.list(), api.health().catch(() => null)]);
    setSongs(list);
    setHealth(status);
  };

  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        try {
          await load();
          return;
        } catch (err) {
          if (attempt === 4 && !cancelled) setError(err.message);
          await new Promise((resolve) => setTimeout(resolve, 600));
        }
      }
    };
    boot();
    return () => {
      cancelled = true;
    };
  }, []);

  const title = useMemo(
    () => (editingId ? "Edit hit" : "Add a hit"),
    [editingId],
  );

  const onChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const reset = () => {
    setForm(EMPTY);
    setCover(null);
    setEditingId(null);
  };

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const payload = new FormData();
      Object.entries(form).forEach(([key, value]) => payload.append(key, value));
      if (cover) payload.append("cover", cover);
      if (editingId) {
        await api.update(editingId, payload);
      } else {
        await api.create(payload);
      }
      reset();
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const edit = (song) => {
    setEditingId(song.id);
    setForm({
      title: song.title,
      artist: song.artist,
      album: song.album,
      year: song.year,
      duration: song.duration,
      genre: song.genre,
      lyricsHook: song.lyricsHook,
    });
    setCover(null);
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this song?")) return;
    setBusy(true);
    try {
      await api.remove(id);
      if (editingId === id) reset();
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="shell">
      <header className="hero">
        <div>
          <p className="kicker">Testing platform</p>
          <h1>POPSTACK</h1>
          <p className="lede">
            CRUD sencillo de canciones pop en inglés. Frontend listo para Cloudflare Pages,
            API para Koyeb, datos en Firestore y portadas en Cloudinary.
          </p>
        </div>
        <aside className="status">
          <span>API: {health ? "online" : "esperando backend"}</span>
          <strong>DB: {health?.db || "—"}</strong>
          <span>Storage: {health?.storage || "—"}</span>
        </aside>
      </header>

      <div className="layout">
        <section className="panel">
          <h2>{title}</h2>
          <form onSubmit={submit}>
            <label>
              Title
              <input name="title" value={form.title} onChange={onChange} required />
            </label>
            <label>
              Artist
              <input name="artist" value={form.artist} onChange={onChange} required />
            </label>
            <label>
              Album
              <input name="album" value={form.album} onChange={onChange} />
            </label>
            <div className="row">
              <label>
                Year
                <input name="year" type="number" value={form.year} onChange={onChange} />
              </label>
              <label>
                Duration
                <input name="duration" placeholder="3:20" value={form.duration} onChange={onChange} />
              </label>
            </div>
            <label>
              Genre
              <input name="genre" value={form.genre} onChange={onChange} />
            </label>
            <label>
              Lyrics hook
              <textarea name="lyricsHook" value={form.lyricsHook} onChange={onChange} />
            </label>
            <label>
              Cover
              <input type="file" accept="image/*" onChange={(event) => setCover(event.target.files[0])} />
            </label>
            {error ? <p className="error">{error}</p> : null}
            <div className="actions">
              <button className="primary" disabled={busy} type="submit">
                {editingId ? "Save changes" : "Create song"}
              </button>
              {editingId ? (
                <button className="ghost" type="button" onClick={reset}>
                  Cancel
                </button>
              ) : null}
            </div>
          </form>
        </section>

        <section>
          <div className="toolbar">
            <h2>{songs.length} English pop hits</h2>
          </div>
          {songs.length === 0 ? (
            <div className="empty">Todavía no hay canciones. Crea la primera a la izquierda.</div>
          ) : (
            <div className="grid">
              {songs.map((song) => (
                <article className="card" key={song.id}>
                  {song.coverUrl ? (
                    <img className="cover" src={song.coverUrl} alt={song.title} />
                  ) : (
                    <div className="placeholder">{song.title.slice(0, 1)}</div>
                  )}
                  <div className="body">
                    <h3>{song.title}</h3>
                    <p className="meta">
                      {song.artist} · {song.year} · {song.genre}
                    </p>
                    <p className="hook">{song.lyricsHook || song.album}</p>
                    <div className="card-actions">
                      <button className="ghost" type="button" onClick={() => edit(song)}>
                        Edit
                      </button>
                      <button className="danger" type="button" onClick={() => remove(song.id)}>
                        Delete
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
