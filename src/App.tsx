import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  createNote as createNoteInDatabase,
  deleteNote as deleteNoteFromDatabase,
  listNotes,
  migrateLegacyLocalStorage,
  searchNotes,
  updateNote,
  type Note,
} from "./noteRepository";
import "./App.css";

const EMPTY_NOTE = `# Untitled

Write your thoughts here...

## Ideas
- capture the idea
- refine the context
- connect it to past notes
`;

function createNewNote(): Note {
  return {
    id: crypto.randomUUID(),
    title: "Untitled",
    content: EMPTY_NOTE,
    updatedAt: new Date().toISOString(),
    tags: [],
  };
}

function getTitleFromContent(content: string) {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : "Untitled";
}

function extractKeywords(content: string) {
  const words = content
    .toLowerCase()
    .replace(/[#*`_\-\[\]()>]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 3 && !/[0-9]/.test(word));

  const counts = new Map<string, number>();
  for (const word of words) {
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);
}

function App() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [currentNoteId, setCurrentNoteId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved");
  const [tagDraft, setTagDraft] = useState("");
  const [filteredNotes, setFilteredNotes] = useState<Note[]>([]);

  useEffect(() => {
    let active = true;

    listNotes()
      .then(async (savedNotes) => {
        if (!active) return;
        if (savedNotes.length > 0) {
          setNotes(savedNotes);
          setCurrentNoteId(savedNotes[0].id);
          return;
        }

        await migrateLegacyLocalStorage(savedNotes);
        const migratedNotes = await listNotes();
        if (migratedNotes.length > 0) {
          setNotes(migratedNotes);
          setCurrentNoteId(migratedNotes[0].id);
          return;
        }

        const initial = createNewNote();
        await createNoteInDatabase(initial);
        if (active) {
          setNotes([initial]);
          setCurrentNoteId(initial.id);
        }
      })
      .catch(() => {
        if (active) setError("Unable to load notes from SQLite.");
      });

    return () => {
      active = false;
    };
  }, []);

  const currentNote = useMemo(
    () => notes.find((note) => note.id === currentNoteId) ?? notes[0],
    [notes, currentNoteId],
  );

  useEffect(() => {
    setTagDraft(currentNote?.tags.join(", ") ?? "");
  }, [currentNoteId, currentNote?.tags]);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      searchNotes(query)
        .then((results) => {
          if (active) setFilteredNotes(results);
        })
        .catch(() => {
          if (active) setError("Unable to search notes.");
        });
    }, 150);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query, notes]);

  const saveNote = (nextNote: Note) => {
    setSaveState("saving");
    updateNote(nextNote)
      .then(() => setSaveState("saved"))
      .catch(() => {
        setSaveState("error");
        setError("Unable to save the note.");
      });
  };

  const saveCurrentNote = (nextContent: string) => {
    if (!currentNote) return;

    const nextNote = {
      ...currentNote,
      title: getTitleFromContent(nextContent),
      content: nextContent,
      updatedAt: new Date().toISOString(),
    };

    setNotes((prevNotes) =>
      prevNotes.map((note) => (note.id === nextNote.id ? nextNote : note)),
    );
    saveNote(nextNote);
  };

  const saveCurrentTags = (value: string) => {
    if (!currentNote) return;
    setTagDraft(value);
    const nextNote = {
      ...currentNote,
      tags: value.split(",").map((tag) => tag.trim()).filter(Boolean),
      updatedAt: new Date().toISOString(),
    };
    setNotes((prevNotes) =>
      prevNotes.map((note) => (note.id === nextNote.id ? nextNote : note)),
    );
    saveNote(nextNote);
  };

  const createNote = () => {
    const newNote = createNewNote();
    createNoteInDatabase(newNote).catch(() => {
      setError("Unable to create the note.");
    });
    setNotes((prev) => [newNote, ...prev]);
    setCurrentNoteId(newNote.id);
  };

  const deleteNote = async (id: string) => {
    try {
      await deleteNoteFromDatabase(id);
      setNotes((prev) => {
        const next = prev.filter((note) => note.id !== id);
        if (next.length === 0) {
          const replaced = createNewNote();
          void createNoteInDatabase(replaced);
          setCurrentNoteId(replaced.id);
          return [replaced];
        }

        if (currentNoteId === id) {
          setCurrentNoteId(next[0].id);
        }
        return next;
      });
    } catch {
      setError("Unable to delete the note.");
    }
  };

  const keywords = currentNote ? extractKeywords(currentNote.content) : [];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h2>Second Brain</h2>
          <button className="primary" onClick={createNote}>
            + New
          </button>
        </div>

        <input
          className="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search notes..."
        />

        <div className="note-list">
          {filteredNotes.map((note) => (
            <button
              key={note.id}
              className={`note-item ${note.id === currentNote?.id ? "active" : ""}`}
              onClick={() => setCurrentNoteId(note.id)}
            >
              <span className="note-title">{note.title}</span>
              <span className="note-date">
                {new Date(note.updatedAt).toLocaleDateString()}
              </span>
              <span className="note-delete" onClick={(e) => {
                e.stopPropagation();
                deleteNote(note.id);
              }}>
                Delete
              </span>
            </button>
          ))}
        </div>
      </aside>

      <main className="editor-pane">
        {error && <div className="empty-state">{error}</div>}
        {currentNote ? (
          <>
            <div className="editor-toolbar">
              <div>
                <span className="meta-label">Note</span>
                <strong>{currentNote.title}</strong>
              </div>
              <button className="primary" onClick={() => saveCurrentNote(currentNote.content)}>
                Save
              </button>
            </div>

            <div className="note-controls">
              <label>
                <span className="meta-label">Tags</span>
                <input
                  className="tag-input"
                  value={tagDraft}
                  onChange={(e) => saveCurrentTags(e.target.value)}
                  placeholder="ideas, project"
                />
              </label>
              <span className={`save-status ${saveState}`}>
                {saveState === "saving" && "Saving..."}
                {saveState === "saved" && "Saved"}
                {saveState === "error" && "Save failed"}
              </span>
            </div>

            <div className="split-layout">
              <div className="editor-panel">
                <textarea
                  value={currentNote.content}
                  onChange={(e) => saveCurrentNote(e.target.value)}
                  spellCheck={false}
                />
              </div>

              <div className="preview-panel">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{currentNote.content}</ReactMarkdown>
              </div>
            </div>
          </>
        ) : (
          <div className="empty-state">Create a note to begin.</div>
        )}
      </main>

      <aside className="ai-sidebar">
        <h3>AI Assistant</h3>
        <div className="ai-card">
          <span className="meta-label">Summary</span>
          <p>
            {currentNote
              ? currentNote.content.split(/\s+/).slice(0, 22).join(" ") + (currentNote.content.split(/\s+/).length > 22 ? "..." : "")
              : "No note selected."}
          </p>
        </div>

        <div className="ai-card">
          <span className="meta-label">Keywords</span>
          <div className="tag-list">
            {keywords.length > 0 ? (
              keywords.map((item) => <span key={item}>{item}</span>)
            ) : (
              <span className="muted">No keywords yet</span>
            )}
          </div>
        </div>

        <div className="ai-card">
          <span className="meta-label">Suggested next actions</span>
          <ul>
            <li>Refine the main idea into a clear heading.</li>
            <li>Separate findings from action items.</li>
            <li>Link this note to a related concept.</li>
          </ul>
        </div>
      </aside>
    </div>
  );
}

export default App;
