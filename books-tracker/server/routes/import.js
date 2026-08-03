const express = require('express');
const multer = require('multer');
const db = require('../db');
const { setTagsForBook } = require('../db/tags');
const { parseCSVToObjects } = require('../utils/csv');
const {
  buildHeaderMap, normalizeStatus, normalizeDate, normalizeRating, normalizeTags,
} = require('../utils/importMapping');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const insertBook = db.prepare(`
  INSERT INTO books (title, author, cover_url, isbn, olid, status, rating, notes, pages, start_date, finish_date)
  VALUES (@title, @author, @cover_url, @isbn, @olid, @status, @rating, @notes, @pages, @start_date, @finish_date)
`);

// POST /api/import/csv  (multipart/form-data, field name "file")
router.post('/import/csv', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'no file uploaded (field name must be "file")' });

  const text = req.file.buffer.toString('utf8');
  const rows = parseCSVToObjects(text);
  if (rows.length === 0) {
    return res.status(400).json({ error: 'CSV appears empty or has no header row' });
  }

  const headers = Object.keys(rows[0]);
  const map = buildHeaderMap(headers);

  if (!map.title) {
    return res.status(400).json({
      error: 'could not find a "title" column in the CSV',
      detected_headers: headers,
    });
  }

  let imported = 0;
  const errors = [];

  const importAll = db.transaction((records) => {
    records.forEach((record, idx) => {
      const title = map.title ? record[map.title].trim() : '';
      if (!title) {
        errors.push({ row: idx + 2, reason: 'missing title' });
        return;
      }

      try {
        const info = insertBook.run({
          title,
          author: map.author ? (record[map.author] || null) : null,
          cover_url: map.cover_url ? (record[map.cover_url] || null) : null,
          isbn: map.isbn ? (record[map.isbn] || null) : null,
          olid: map.olid ? (record[map.olid] || null) : null,
          status: map.status ? normalizeStatus(record[map.status]) : 'to_read',
          rating: map.rating ? normalizeRating(record[map.rating]) : null,
          notes: map.notes ? (record[map.notes] || null) : null,
          pages: map.pages ? (Number(record[map.pages]) || null) : null,
          start_date: map.start_date ? normalizeDate(record[map.start_date]) : null,
          finish_date: map.finish_date ? normalizeDate(record[map.finish_date]) : null,
        });

        if (map.tags) {
          setTagsForBook(info.lastInsertRowid, normalizeTags(record[map.tags]));
        }
        imported++;
      } catch (err) {
        errors.push({ row: idx + 2, reason: err.message });
      }
    });
  });

  importAll(rows);

  res.json({
    imported,
    total_rows: rows.length,
    skipped: rows.length - imported,
    detected_columns: map,
    errors: errors.slice(0, 50),
  });
});

module.exports = router;
