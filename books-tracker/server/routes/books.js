const express = require('express');
const db = require('../db');
const { setTagsForBook, getTagsForBook, listAllTags } = require('../db/tags');

const router = express.Router();

const VALID_STATUSES = ['to_read', 'reading', 'finished', 'abandoned'];

function serializeBook(row) {
  if (!row) return null;
  return { ...row, tags: getTagsForBook(row.id) };
}

// GET /api/books?status=&tag=&search=&sort=
router.get('/books', (req, res) => {
  const { status, tag, search, sort } = req.query;

  let sql = 'SELECT DISTINCT b.* FROM books b';
  const conditions = [];
  const params = [];

  if (tag) {
    sql += ' JOIN book_tags bt ON bt.book_id = b.id JOIN tags t ON t.id = bt.tag_id';
    conditions.push('t.name = ? COLLATE NOCASE');
    params.push(tag);
  }

  if (status) {
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `invalid status: ${status}` });
    }
    conditions.push('b.status = ?');
    params.push(status);
  }

  if (search) {
    conditions.push('(b.title LIKE ? OR b.author LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }

  if (conditions.length) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  const sortMap = {
    title: 'b.title COLLATE NOCASE ASC',
    author: 'b.author COLLATE NOCASE ASC',
    recent: 'b.updated_at DESC',
    finish_date: 'b.finish_date DESC',
    rating: 'b.rating DESC',
  };
  sql += ' ORDER BY ' + (sortMap[sort] || sortMap.recent);

  const rows = db.prepare(sql).all(...params);
  res.json(rows.map(serializeBook));
});

router.get('/books/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM books WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'not found' });
  res.json(serializeBook(row));
});

router.post('/books', (req, res) => {
  const b = req.body || {};
  if (!b.title || !String(b.title).trim()) {
    return res.status(400).json({ error: 'title is required' });
  }
  if (b.status && !VALID_STATUSES.includes(b.status)) {
    return res.status(400).json({ error: `invalid status: ${b.status}` });
  }
  const status = b.status || 'to_read';

  const info = db.prepare(`
    INSERT INTO books (title, author, cover_url, isbn, olid, status, rating, notes, pages, start_date, finish_date)
    VALUES (@title, @author, @cover_url, @isbn, @olid, @status, @rating, @notes, @pages, @start_date, @finish_date)
  `).run({
    title: String(b.title).trim(),
    author: b.author || null,
    cover_url: b.cover_url || null,
    isbn: b.isbn || null,
    olid: b.olid || null,
    status,
    rating: b.rating != null ? Number(b.rating) : null,
    notes: b.notes || null,
    pages: b.pages != null ? Number(b.pages) : null,
    start_date: b.start_date || null,
    finish_date: b.finish_date || null,
  });

  setTagsForBook(info.lastInsertRowid, b.tags);

  const row = db.prepare('SELECT * FROM books WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(serializeBook(row));
});

router.put('/books/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM books WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });

  const b = req.body || {};
  if (b.status && !VALID_STATUSES.includes(b.status)) {
    return res.status(400).json({ error: `invalid status: ${b.status}` });
  }

  const merged = {
    title: b.title !== undefined ? String(b.title).trim() : existing.title,
    author: b.author !== undefined ? b.author : existing.author,
    cover_url: b.cover_url !== undefined ? b.cover_url : existing.cover_url,
    isbn: b.isbn !== undefined ? b.isbn : existing.isbn,
    olid: b.olid !== undefined ? b.olid : existing.olid,
    status: b.status !== undefined ? b.status : existing.status,
    rating: b.rating !== undefined ? (b.rating === null ? null : Number(b.rating)) : existing.rating,
    notes: b.notes !== undefined ? b.notes : existing.notes,
    pages: b.pages !== undefined ? (b.pages === null ? null : Number(b.pages)) : existing.pages,
    start_date: b.start_date !== undefined ? b.start_date : existing.start_date,
    finish_date: b.finish_date !== undefined ? b.finish_date : existing.finish_date,
    id: existing.id,
  };

  db.prepare(`
    UPDATE books SET title=@title, author=@author, cover_url=@cover_url, isbn=@isbn, olid=@olid,
      status=@status, rating=@rating, notes=@notes, pages=@pages, start_date=@start_date,
      finish_date=@finish_date, updated_at=datetime('now')
    WHERE id=@id
  `).run(merged);

  if (b.tags !== undefined) {
    setTagsForBook(existing.id, b.tags);
  }

  const row = db.prepare('SELECT * FROM books WHERE id = ?').get(existing.id);
  res.json(serializeBook(row));
});

router.delete('/books/:id', (req, res) => {
  const info = db.prepare('DELETE FROM books WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'not found' });
  res.status(204).end();
});

router.get('/tags', (req, res) => {
  res.json(listAllTags());
});

module.exports = router;
