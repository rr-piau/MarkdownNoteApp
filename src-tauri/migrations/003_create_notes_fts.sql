CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
  note_id UNINDEXED,
  title,
  content,
  tags
);

INSERT INTO notes_fts (note_id, title, content, tags)
SELECT notes.id,
       notes.title,
       notes.content,
       COALESCE(GROUP_CONCAT(tags.name, ' '), '')
FROM notes
LEFT JOIN note_tags ON note_tags.note_id = notes.id
LEFT JOIN tags ON tags.id = note_tags.tag_id
GROUP BY notes.id;

CREATE TRIGGER IF NOT EXISTS notes_fts_after_insert
AFTER INSERT ON notes
BEGIN
  INSERT INTO notes_fts (note_id, title, content, tags)
  VALUES (NEW.id, NEW.title, NEW.content, '');
END;

CREATE TRIGGER IF NOT EXISTS notes_fts_after_update
AFTER UPDATE OF title, content ON notes
BEGIN
  UPDATE notes_fts
  SET title = NEW.title, content = NEW.content
  WHERE note_id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS notes_fts_after_delete
AFTER DELETE ON notes
BEGIN
  DELETE FROM notes_fts WHERE note_id = OLD.id;
END;

CREATE TRIGGER IF NOT EXISTS notes_fts_after_tag_insert
AFTER INSERT ON note_tags
BEGIN
  UPDATE notes_fts
  SET tags = COALESCE(
    (SELECT GROUP_CONCAT(tags.name, ' ')
     FROM note_tags
     JOIN tags ON tags.id = note_tags.tag_id
     WHERE note_tags.note_id = NEW.note_id),
    ''
  )
  WHERE note_id = NEW.note_id;
END;

CREATE TRIGGER IF NOT EXISTS notes_fts_after_tag_delete
AFTER DELETE ON note_tags
BEGIN
  UPDATE notes_fts
  SET tags = COALESCE(
    (SELECT GROUP_CONCAT(tags.name, ' ')
     FROM note_tags
     JOIN tags ON tags.id = note_tags.tag_id
     WHERE note_tags.note_id = OLD.note_id),
    ''
  )
  WHERE note_id = OLD.note_id;
END;