import { Router } from 'express';
import db from '../db.js';

const router = Router();

router.get('/', (_req, res) => {
  const tags = db
    .prepare(
      `SELECT t.id, t.name, COUNT(bt.book_id) as book_count
       FROM tags t
       LEFT JOIN book_tags bt ON bt.tag_id = t.id
       GROUP BY t.id
       ORDER BY t.name COLLATE NOCASE`
    )
    .all();
  res.json(tags);
});

export default router;
