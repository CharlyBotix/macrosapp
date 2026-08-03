import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'data', 'books.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new DatabaseSync(DB_PATH);

db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
  CREATE TABLE IF NOT EXISTS books (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    author TEXT,
    isbn TEXT,
    cover_url TEXT,
    open_library_id TEXT,
    status TEXT NOT NULL DEFAULT 'to_read' CHECK (status IN ('to_read', 'reading', 'finished', 'abandoned')),
    rating INTEGER CHECK (rating IS NULL OR (rating BETWEEN 0 AND 5)),
    notes TEXT,
    pages INTEGER,
    date_started TEXT,
    date_finished TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS book_tags (
    book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (book_id, tag_id)
  );
`);

db.exec('CREATE INDEX IF NOT EXISTS idx_books_status ON books(status);');
db.exec('CREATE INDEX IF NOT EXISTS idx_books_date_finished ON books(date_finished);');

export default db;
