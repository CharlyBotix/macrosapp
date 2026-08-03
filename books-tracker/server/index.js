const path = require('path');
const express = require('express');

const booksRouter = require('./routes/books');
const openlibraryRouter = require('./routes/openlibrary');
const statsRouter = require('./routes/stats');
const importRouter = require('./routes/import');

const app = express();
const PORT = process.env.PORT || 3300;

app.use(express.json({ limit: '1mb' }));

app.use('/api', booksRouter);
app.use('/api', openlibraryRouter);
app.use('/api', statsRouter);
app.use('/api', importRouter);

app.get('/healthz', (req, res) => res.json({ ok: true }));

app.use(express.static(path.join(__dirname, '..', 'public')));

// SQLite CHECK constraint violations, multer errors, etc. -> 400 instead of a raw 500.
app.use((err, req, res, next) => {
  if (err && err.code && String(err.code).startsWith('SQLITE_CONSTRAINT')) {
    return res.status(400).json({ error: 'invalid data', details: err.message });
  }
  if (err && err.name === 'MulterError') {
    return res.status(400).json({ error: err.message });
  }
  console.error(err);
  res.status(500).json({ error: 'internal server error' });
});

app.listen(PORT, () => {
  console.log(`books-tracker listening on :${PORT}`);
});
