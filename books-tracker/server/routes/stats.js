const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/stats', (req, res) => {
  const statusCounts = db.prepare(`
    SELECT status, COUNT(*) as count FROM books GROUP BY status
  `).all();

  const perYear = db.prepare(`
    SELECT substr(finish_date, 1, 4) as year,
           COUNT(*) as books,
           SUM(COALESCE(pages, 0)) as pages
    FROM books
    WHERE status = 'finished' AND finish_date IS NOT NULL AND finish_date != ''
    GROUP BY year
    ORDER BY year DESC
  `).all();

  const totals = db.prepare(`
    SELECT
      COUNT(*) as finished_count,
      SUM(COALESCE(pages, 0)) as total_pages,
      AVG(rating) as avg_rating
    FROM books
    WHERE status = 'finished'
  `).get();

  const topTags = db.prepare(`
    SELECT t.name, COUNT(*) as count
    FROM tags t
    JOIN book_tags bt ON bt.tag_id = t.id
    GROUP BY t.id
    ORDER BY count DESC, t.name COLLATE NOCASE
    LIMIT 10
  `).all();

  const longestBook = db.prepare(`
    SELECT title, author, pages FROM books
    WHERE pages IS NOT NULL
    ORDER BY pages DESC LIMIT 1
  `).get() || null;

  res.json({
    status_counts: Object.fromEntries(statusCounts.map((r) => [r.status, r.count])),
    per_year: perYear,
    total_finished: totals.finished_count || 0,
    total_pages_read: totals.total_pages || 0,
    average_rating: totals.avg_rating ? Math.round(totals.avg_rating * 100) / 100 : null,
    top_tags: topTags,
    longest_book: longestBook,
  });
});

module.exports = router;
