import Database from "@tauri-apps/plugin-sql";

export type Note = {
  id: string;
  title: string;
  content: string;
  updatedAt: string;
};

type NoteRow = {
  id: string;
  title: string;
  content: string;
  updated_at: string;
};

let databasePromise: ReturnType<typeof Database.load> | null = null;

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
  };
}

export async function listNotes(): Promise<Note[]> {
  const database = await getDatabase();
  const rows = await database.select<NoteRow[]>(
    "SELECT id, title, content, updated_at FROM notes WHERE is_archived = 0 ORDER BY updated_at DESC",
  );
  return rows.map(toNote);
}

export async function getNote(id: string): Promise<Note | null> {
  const database = await getDatabase();
  const rows = await database.select<NoteRow[]>(
    "SELECT id, title, content, updated_at FROM notes WHERE id = $1 AND is_archived = 0",
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
}

export async function updateNote(note: Note): Promise<void> {
  const database = await getDatabase();
  await database.execute(
    "UPDATE notes SET title = $1, content = $2, updated_at = $3 WHERE id = $4",
    [note.title, note.content, note.updatedAt, note.id],
  );
}

export async function deleteNote(id: string): Promise<void> {
  const database = await getDatabase();
  await database.execute("DELETE FROM notes WHERE id = $1", [id]);
}