import { Router } from 'express';

const router = Router();

const SEARCH_FIELDS = 'key,title,author_name,first_publish_year,isbn,cover_i,number_of_pages_median';

function coverUrl(coverId) {
  return coverId ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg` : null;
}

// GET /api/openlibrary/search?q=...
router.get('/search', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.status(400).json({ error: 'Query parameter "q" is required' });

  const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&fields=${SEARCH_FIELDS}&limit=20`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'books-pwa (self-hosted)' } });
    if (!response.ok) {
      return res.status(502).json({ error: `Open Library returned ${response.status}` });
    }
    const data = await response.json();

    const results = (data.docs || []).map((doc) => ({
      open_library_id: doc.key ? doc.key.replace('/works/', '') : null,
      title: doc.title || '',
      author: Array.isArray(doc.author_name) ? doc.author_name.join(', ') : null,
      first_publish_year: doc.first_publish_year || null,
      isbn: Array.isArray(doc.isbn) ? doc.isbn[0] : null,
      pages: doc.number_of_pages_median || null,
      cover_url: coverUrl(doc.cover_i),
    }));

    res.json(results);
  } catch (err) {
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'Open Library request timed out' });
    }
    res.status(502).json({ error: 'Failed to reach Open Library', details: err.message });
  } finally {
    clearTimeout(timeout);
  }
});

export default router;
