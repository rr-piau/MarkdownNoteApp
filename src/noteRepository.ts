import Database from "@tauri-apps/plugin-sql";

export type Note = {
  id: string;
  title: string;
  content: string;
  updatedAt: string;
  tags: string[];
};

type NoteRow = {
  id: string;
  title: string;
  content: string;
  updated_at: string;
  tags: string | null;
};

const LEGACY_STORAGE_KEY = "secbrain.notes.v1";
let databasePromise: ReturnType<typeof Database.load> | null = null;
let migrationPromise: Promise<void> | null = null;

function getDatabase() {
  databasePromise ??= Database.load("sqlite:notes.db");
  return databasePromise;
}

function toNote(row: NoteRow): Note {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    updatedAt: row.updated_at,
    tags: row.tags ? row.tags.split(",") : [],
  };
}

const noteSelect = `
  SELECT notes.id, notes.title, notes.content, notes.updated_at,
    GROUP_CONCAT(tags.name) AS tags
  FROM notes
  LEFT JOIN note_tags ON note_tags.note_id = notes.id
  LEFT JOIN tags ON tags.id = note_tags.tag_id
`;

async function replaceTags(noteId: string, tags: string[]) {
  const database = await getDatabase();
  await database.execute("DELETE FROM note_tags WHERE note_id = $1", [noteId]);

  for (const tag of [...new Set(tags.map((item) => item.trim()).filter(Boolean))]) {
    await database.execute("INSERT OR IGNORE INTO tags (name) VALUES ($1)", [tag]);
    const rows = await database.select<{ id: number }[]>(
      "SELECT id FROM tags WHERE name = $1",
      [tag],
    );
    if (rows[0]) {
      await database.execute(
        "INSERT OR IGNORE INTO note_tags (note_id, tag_id) VALUES ($1, $2)",
        [noteId, rows[0].id],
      );
    }
  }
}

export async function listNotes(): Promise<Note[]> {
  const database = await getDatabase();
  const rows = await database.select<NoteRow[]>(
    `${noteSelect} WHERE notes.is_archived = 0 GROUP BY notes.id ORDER BY notes.updated_at DESC`,
  );
  return rows.map(toNote);
}

function toFtsQuery(query: string) {
  return query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => `"${token.replace(/"/g, '""')}"`)
    .join(" AND ");
}

export async function searchNotes(query: string): Promise<Note[]> {
  const normalizedQuery = toFtsQuery(query);
  if (!normalizedQuery) return listNotes();

  const database = await getDatabase();
  const rows = await database.select<NoteRow[]>(
    `${noteSelect}
     INNER JOIN notes_fts ON notes_fts.note_id = notes.id
     WHERE notes.is_archived = 0 AND notes_fts MATCH $1
     GROUP BY notes.id
     ORDER BY notes.updated_at DESC`,
    [normalizedQuery],
  );
  return rows.map(toNote);
}

export async function getNote(id: string): Promise<Note | null> {
  const database = await getDatabase();
  const rows = await database.select<NoteRow[]>(
    `${noteSelect} WHERE notes.id = $1 AND notes.is_archived = 0 GROUP BY notes.id`,
    [id],
  );
  return rows[0] ? toNote(rows[0]) : null;
}

export async function createNote(note: Note): Promise<void> {
  const database = await getDatabase();
  await database.execute(
    "INSERT INTO notes (id, title, content, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)",
    [note.id, note.title, note.content, note.updatedAt, note.updatedAt],
  );
  await replaceTags(note.id, note.tags);
}

export async function updateNote(note: Note): Promise<void> {
  const database = await getDatabase();
  await database.execute(
    "UPDATE notes SET title = $1, content = $2, updated_at = $3 WHERE id = $4",
    [note.title, note.content, note.updatedAt, note.id],
  );
  await replaceTags(note.id, note.tags);
}

export async function deleteNote(id: string): Promise<void> {
  const database = await getDatabase();
  await database.execute("DELETE FROM note_tags WHERE note_id = $1", [id]);
  await database.execute("DELETE FROM notes WHERE id = $1", [id]);
}

export async function migrateLegacyLocalStorage(notes: Note[]): Promise<void> {
  if (!migrationPromise) {
    migrationPromise = (async () => {
      const saved = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (!saved || notes.length > 0) return;

      let legacyNotes: Note[];
      try {
        legacyNotes = JSON.parse(saved) as Note[];
      } catch {
        return;
      }

      if (
        !Array.isArray(legacyNotes) ||
        legacyNotes.length === 0 ||
        legacyNotes.some(
          (note) =>
            typeof note?.id !== "string" ||
            typeof note?.title !== "string" ||
            typeof note?.content !== "string" ||
            typeof note?.updatedAt !== "string",
        )
      ) {
        return;
      }

      const database = await getDatabase();
      for (const note of legacyNotes) {
        await database.execute(
          "INSERT OR IGNORE INTO notes (id, title, content, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)",
          [note.id, note.title, note.content, note.updatedAt, note.updatedAt],
        );
      }
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    })();
  }

  await migrationPromise;
}