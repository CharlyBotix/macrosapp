import db from '../db.js';

const STATUSES = ['to_read', 'reading', 'finished', 'abandoned'];

function getTagsForBook(bookId) {
  const rows = db
    .prepare(
      `SELECT t.name FROM tags t
       JOIN book_tags bt ON bt.tag_id = t.id
       WHERE bt.book_id = ?
       ORDER BY t.name COLLATE NOCASE`
    )
    .all(bookId);
  return rows.map((r) => r.name);
}

function attachTags(book) {
  if (!book) return book;
  return { ...book, tags: getTagsForBook(book.id) };
}

function upsertTag(name) {
  const clean = name.trim();
  if (!clean) return null;
  db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)').run(clean);
  const row = db.prepare('SELECT id FROM tags WHERE name = ? COLLATE NOCASE').get(clean);
  return row.id;
}

function syncTags(bookId, tagNames) {
  db.prepare('DELETE FROM book_tags WHERE book_id = ?').run(bookId);
  if (!Array.isArray(tagNames)) return;
  const seen = new Set();
  for (const raw of tagNames) {
    if (typeof raw !== 'string') continue;
    const clean = raw.trim();
    if (!clean || seen.has(clean.toLowerCase())) continue;
    seen.add(clean.toLowerCase());
    const tagId = upsertTag(clean);
    if (tagId) {
      db.prepare('INSERT OR IGNORE INTO book_tags (book_id, tag_id) VALUES (?, ?)').run(bookId, tagId);
    }
  }
  // drop tags nobody references anymore
  db.exec('DELETE FROM tags WHERE id NOT IN (SELECT DISTINCT tag_id FROM book_tags)');
}

function validateStatus(status) {
  return STATUSES.includes(status) ? status : null;
}

function normalizeBookInput(body) {
  const status = validateStatus(body.status) || 'to_read';
  const rating =
    body.rating === null || body.rating === undefined || body.rating === ''
      ? null
      : Math.max(0, Math.min(5, Number(body.rating)));

  return {
    title: String(body.title || '').trim(),
    author: body.author ? String(body.author).trim() : null,
    isbn: body.isbn ? String(body.isbn).trim() : null,
    cover_url: body.cover_url ? String(body.cover_url).trim() : null,
    open_library_id: body.open_library_id ? String(body.open_library_id).trim() : null,
    status,
    rating,
    notes: body.notes ? String(body.notes) : null,
    pages: body.pages === null || body.pages === undefined || body.pages === '' ? null : Number(body.pages),
    date_started: body.date_started || null,
    date_finished: body.date_finished || null,
  };
}

export { STATUSES, attachTags, syncTags, validateStatus, normalizeBookInput };
