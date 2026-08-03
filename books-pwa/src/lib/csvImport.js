import { parse } from 'csv-parse/sync';

// Column name aliases (lowercased) mapped to our internal fields.
// Covers the standard Goodreads export format (which OpenReads reads/writes
// for compatibility) as well as a handful of generic alternatives.
const FIELD_ALIASES = {
  title: ['title', 'book title', 'name'],
  author: ['author', 'authors', 'author l-f'],
  isbn: ['isbn13', 'isbn', 'isbn/uid'],
  pages: ['number of pages', 'pages', 'page count'],
  rating: ['my rating', 'star rating', 'rating'],
  status: ['exclusive shelf', 'read status', 'status', 'shelf'],
  date_started: ['date started', 'started reading', 'date_started'],
  date_finished: ['date read', 'last date read', 'date finished', 'date_finished'],
  date_added: ['date added'],
  tags: ['bookshelves', 'tags', 'shelves'],
  notes: ['my review', 'review', 'private notes', 'notes'],
};

const RESERVED_SHELF_NAMES = new Set(['to-read', 'currently-reading', 'read', 'to_read', 'reading', 'finished']);

function buildHeaderMap(headers) {
  const lowerHeaders = headers.map((h) => h.trim().toLowerCase());
  const map = {};
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    for (const alias of aliases) {
      const idx = lowerHeaders.indexOf(alias);
      if (idx !== -1) {
        map[field] = headers[idx];
        break;
      }
    }
  }
  return map;
}

function cleanIsbn(value) {
  if (!value) return null;
  // Goodreads wraps ISBNs as ="0123456789" to stop spreadsheet apps mangling them.
  const stripped = String(value).replace(/^="?|"?$/g, '').trim();
  return stripped || null;
}

function cleanDate(value) {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  // Accept YYYY/MM/DD or YYYY-MM-DD, normalize to YYYY-MM-DD.
  const match = trimmed.match(/^(\d{4})[/-](\d{2})[/-](\d{2})/);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  return trimmed;
}

function mapStatus(rawStatus, dateStarted, dateFinished) {
  const s = (rawStatus || '').trim().toLowerCase();
  if (['read', 'finished', 'gelesen'].includes(s)) return 'finished';
  if (['currently-reading', 'reading', 'currently reading'].includes(s)) return 'reading';
  if (['to-read', 'to_read', 'want to read', 'to read'].includes(s)) return 'to_read';
  if (['abandoned', 'did-not-finish', 'dnf', 'paused'].includes(s)) return 'abandoned';

  if (dateFinished) return 'finished';
  if (dateStarted) return 'reading';
  return 'to_read';
}

function parseRating(raw) {
  if (raw === undefined || raw === null || raw === '') return null;
  const n = Number(raw);
  if (Number.isNaN(n) || n <= 0) return null;
  return Math.max(0, Math.min(5, Math.round(n)));
}

function parseTags(raw) {
  if (!raw) return [];
  return String(raw)
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t && !RESERVED_SHELF_NAMES.has(t.toLowerCase()));
}

/**
 * Parses a Goodreads/OpenReads-style CSV buffer into normalized book objects.
 * Returns { books: [...], unmappedFields: [...] }
 */
function parseBooksCsv(csvContent) {
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    bom: true,
  });

  if (records.length === 0) {
    return { books: [], headerMap: {} };
  }

  const headers = Object.keys(records[0]);
  const headerMap = buildHeaderMap(headers);

  const books = records.map((row) => {
    const get = (field) => (headerMap[field] ? row[headerMap[field]] : undefined);

    const dateStarted = cleanDate(get('date_started'));
    const dateFinished = cleanDate(get('date_finished'));
    const pagesRaw = get('pages');

    return {
      title: (get('title') || '').trim(),
      author: (get('author') || '').trim() || null,
      isbn: cleanIsbn(get('isbn')),
      status: mapStatus(get('status'), dateStarted, dateFinished),
      rating: parseRating(get('rating')),
      notes: (get('notes') || '').trim() || null,
      pages: pagesRaw ? Number(String(pagesRaw).replace(/[^\d]/g, '')) || null : null,
      date_started: dateStarted,
      date_finished: dateFinished,
      tags: parseTags(get('tags')),
    };
  });

  return { books, headerMap };
}

export { parseBooksCsv, FIELD_ALIASES };
