import { Router } from 'express';
import multer from 'multer';
import db from '../db.js';
import { parseBooksCsv } from '../lib/csvImport.js';
import { syncTags } from '../lib/books.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const router = Router();

function findExisting(isbn, title, author) {
  if (isbn) {
    const byIsbn = db.prepare('SELECT id FROM books WHERE isbn = ? AND isbn IS NOT NULL').get(isbn);
    if (byIsbn) return byIsbn;
  }
  return db
    .prepare('SELECT id FROM books WHERE title = ? COLLATE NOCASE AND (author = ? COLLATE NOCASE OR (author IS NULL AND ? IS NULL))')
    .get(title, author, author);
}

router.post('/', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded (field name must be "file")' });

  let parsed;
  try {
    parsed = parseBooksCsv(req.file.buffer.toString('utf-8'));
  } catch (err) {
    return res.status(400).json({ error: 'Could not parse CSV', details: err.message });
  }

  const { books, headerMap } = parsed;
  const skipExisting = req.query.skipExisting !== 'false';

  let imported = 0;
  let skipped = 0;
  const errors = [];

  const insertStmt = db.prepare(
    `INSERT INTO books
      (title, author, isbn, status, rating, notes, pages, date_started, date_finished)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  books.forEach((book, idx) => {
    if (!book.title) {
      errors.push({ row: idx + 2, reason: 'Missing title' });
      skipped++;
      return;
    }

    if (skipExisting) {
      const existing = findExisting(book.isbn, book.title, book.author);
      if (existing) {
        skipped++;
        return;
      }
    }

    try {
      const result = insertStmt.run(
        book.title,
        book.author,
        book.isbn,
        book.status,
        book.rating,
        book.notes,
        book.pages,
        book.date_started,
        book.date_finished
      );
      syncTags(Number(result.lastInsertRowid), book.tags);
      imported++;
    } catch (err) {
      errors.push({ row: idx + 2, reason: err.message });
      skipped++;
    }
  });

  res.json({
    total: books.length,
    imported,
    skipped,
    errors: errors.slice(0, 50),
    recognizedColumns: headerMap,
  });
});

export default router;
