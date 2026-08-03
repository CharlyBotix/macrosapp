const express = require('express');

const router = express.Router();

const OL_SEARCH_URL = 'https://openlibrary.org/search.json';
const OL_COVER_URL = 'https://covers.openlibrary.org/b/id';

// GET /api/search/openlibrary?q=...
// Proxies Open Library search so the frontend doesn't need CORS/keys, and
// trims the response down to what the "add book" UI actually needs.
router.get('/search/openlibrary', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.status(400).json({ error: 'query param "q" is required' });

  const url = new URL(OL_SEARCH_URL);
  url.searchParams.set('q', q);
  url.searchParams.set('limit', '20');
  url.searchParams.set('fields', [
    'key', 'title', 'author_name', 'first_publish_year',
    'isbn', 'cover_i', 'number_of_pages_median',
  ].join(','));

  try {
    const upstream = await fetch(url, {
      headers: { 'User-Agent': 'books-tracker-self-hosted/1.0' },
    });
    if (!upstream.ok) {
      return res.status(502).json({ error: `Open Library returned ${upstream.status}` });
    }
    const data = await upstream.json();

    const results = (data.docs || []).map((doc) => ({
      olid: (doc.key || '').replace('/works/', ''),
      title: doc.title,
      author: (doc.author_name || [])[0] || null,
      first_publish_year: doc.first_publish_year || null,
      isbn: (doc.isbn || [])[0] || null,
      pages: doc.number_of_pages_median || null,
      cover_url: doc.cover_i ? `${OL_COVER_URL}/${doc.cover_i}-M.jpg` : null,
    }));

    res.json(results);
  } catch (err) {
    res.status(502).json({ error: 'failed to reach Open Library', details: err.message });
  }
});

module.exports = router;
