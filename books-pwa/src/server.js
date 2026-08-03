import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import './db.js';

import booksRouter from './routes/books.js';
import tagsRouter from './routes/tags.js';
import openlibraryRouter from './routes/openlibrary.js';
import statsRouter from './routes/stats.js';
import importRouter from './routes/import.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/api/books', booksRouter);
app.use('/api/tags', tagsRouter);
app.use('/api/openlibrary', openlibraryRouter);
app.use('/api/stats', statsRouter);
app.use('/api/import', importRouter);

app.use(express.static(PUBLIC_DIR));

// SPA fallback for any non-API route
app.get(/^(?!\/api\/).*/, (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`books-pwa listening on port ${PORT}`);
});
