const db = require('./index');

const insertTag = db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)');
const findTagByName = db.prepare('SELECT id, name FROM tags WHERE name = ? COLLATE NOCASE');
const linkTag = db.prepare('INSERT OR IGNORE INTO book_tags (book_id, tag_id) VALUES (?, ?)');
const unlinkAllForBook = db.prepare('DELETE FROM book_tags WHERE book_id = ?');
const tagsForBook = db.prepare(`
  SELECT t.name FROM tags t
  JOIN book_tags bt ON bt.tag_id = t.id
  WHERE bt.book_id = ?
  ORDER BY t.name COLLATE NOCASE
`);

// Replaces the full tag set for a book with the given list of tag name strings.
function setTagsForBook(bookId, tagNames) {
  unlinkAllForBook.run(bookId);
  const clean = [...new Set((tagNames || [])
    .map((t) => String(t).trim())
    .filter(Boolean))];

  for (const name of clean) {
    insertTag.run(name);
    const tag = findTagByName.get(name);
    linkTag.run(bookId, tag.id);
  }
}

function getTagsForBook(bookId) {
  return tagsForBook.all(bookId).map((r) => r.name);
}

function listAllTags() {
  return db.prepare(`
    SELECT t.name, COUNT(bt.book_id) as book_count
    FROM tags t
    LEFT JOIN book_tags bt ON bt.tag_id = t.id
    GROUP BY t.id
    ORDER BY t.name COLLATE NOCASE
  `).all();
}

module.exports = { setTagsForBook, getTagsForBook, listAllTags };
