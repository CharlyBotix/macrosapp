import { Router } from 'express';
import db from '../db.js';

const router = Router();

router.get('/', (_req, res) => {
  const totalBooks = db.prepare('SELECT COUNT(*) as n FROM books').get().n;

  const byStatus = Object.fromEntries(
    db.prepare('SELECT status, COUNT(*) as n FROM books GROUP BY status').all().map((r) => [r.status, r.n])
  );

  const perYear = db
    .prepare(
      `SELECT strftime('%Y', date_finished) as year, COUNT(*) as books, SUM(COALESCE(pages, 0)) as pages
       FROM books
       WHERE status = 'finished' AND date_finished IS NOT NULL AND date_finished != ''
       GROUP BY year
       ORDER BY year DESC`
    )
    .all();

  const avgRating = db.prepare('SELECT AVG(rating) as avg FROM books WHERE rating IS NOT NULL').get().avg;

  const topTags = db
    .prepare(
      `SELECT t.name, COUNT(bt.book_id) as book_count
       FROM tags t
       JOIN book_tags bt ON bt.tag_id = t.id
       GROUP BY t.id
       ORDER BY book_count DESC, t.name COLLATE NOCASE
       LIMIT 10`
    )
    .all();

  const currentYear = String(new Date().getFullYear());
  const currentYearRow = perYear.find((r) => r.year === currentYear);

  const totalPagesRead = db
    .prepare(
      `SELECT SUM(COALESCE(pages, 0)) as total FROM books
       WHERE status = 'finished'`
    )
    .get().total || 0;

  res.json({
    totalBooks,
    byStatus,
    perYear,
    avgRating: avgRating !== null ? Math.round(avgRating * 100) / 100 : null,
    topTags,
    currentYear: {
      year: currentYear,
      books: currentYearRow ? currentYearRow.books : 0,
      pages: currentYearRow ? currentYearRow.pages : 0,
    },
    totalPagesRead,
  });
});

export default router;
