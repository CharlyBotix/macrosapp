import { Router } from 'express';
import db from '../db.js';
import { attachTags, syncTags, validateStatus, normalizeBookInput, STATUSES } from '../lib/books.js';

const router = Router();

// GET /api/books?status=&tag=&q=&sort=
router.get('/', (req, res) => {
  const { status, tag, q, sort } = req.query;

  const where = [];
  const params = [];

  if (status) {
    if (!validateStatus(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${STATUSES.join(', ')}` });
    }
    where.push('b.status = ?');
    params.push(status);
  }

  if (q) {
    where.push('(b.title LIKE ? OR b.author LIKE ?)');
    params.push(`%${q}%`, `%${q}%`);
  }

  let joinTag = '';
  if (tag) {
    joinTag = `JOIN book_tags bt ON bt.book_id = b.id JOIN tags t ON t.id = bt.tag_id AND t.name = ? COLLATE NOCASE`;
    params.unshift(tag);
  }

  const sortMap = {
    title: 'b.title COLLATE NOCASE ASC',
    author: 'b.author COLLATE NOCASE ASC',
    recent: 'b.updated_at DESC',
    date_finished: 'b.date_finished DESC',
    rating: 'b.rating DESC',
  };
  const orderBy = sortMap[sort] || 'b.updated_at DESC';

  const sql = `
    SELECT b.* FROM books b
    ${joinTag}
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY ${orderBy}
  `;

  const books = db.prepare(sql).all(...params);
  res.json(books.map(attachTags));
});

router.get('/:id', (req, res) => {
  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(req.params.id);
  if (!book) return res.status(404).json({ error: 'Book not found' });
  res.json(attachTags(book));
});

router.post('/', (req, res) => {
  const data = normalizeBookInput(req.body);
  if (!data.title) return res.status(400).json({ error: 'Title is required' });

  const result = db
    .prepare(
      `INSERT INTO books
        (title, author, isbn, cover_url, open_library_id, status, rating, notes, pages, date_started, date_finished)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      data.title,
      data.author,
      data.isbn,
      data.cover_url,
      data.open_library_id,
      data.status,
      data.rating,
      data.notes,
      data.pages,
      data.date_started,
      data.date_finished
    );

  const bookId = Number(result.lastInsertRowid);
  syncTags(bookId, req.body.tags);

  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(bookId);
  res.status(201).json(attachTags(book));
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM books WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Book not found' });

  const data = normalizeBookInput({ ...existing, ...req.body });
  if (!data.title) return res.status(400).json({ error: 'Title is required' });

  db.prepare(
    `UPDATE books SET
      title = ?, author = ?, isbn = ?, cover_url = ?, open_library_id = ?,
      status = ?, rating = ?, notes = ?, pages = ?, date_started = ?, date_finished = ?,
      updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    data.title,
    data.author,
    data.isbn,
    data.cover_url,
    data.open_library_id,
    data.status,
    data.rating,
    data.notes,
    data.pages,
    data.date_started,
    data.date_finished,
    req.params.id
  );

  if (req.body.tags !== undefined) {
    syncTags(Number(req.params.id), req.body.tags);
  }

  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(req.params.id);
  res.json(attachTags(book));
});

router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM books WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Book not found' });
  db.exec('DELETE FROM tags WHERE id NOT IN (SELECT DISTINCT tag_id FROM book_tags)');
  res.status(204).end();
});

export default router;
