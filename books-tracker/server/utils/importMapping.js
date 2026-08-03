// Column-name aliases used to map an arbitrary CSV export (OpenReads, Goodreads-style
// exports, etc.) onto our book fields. Matching is case-insensitive and ignores
// surrounding whitespace. If your export uses different headers, just add them
// to the relevant array below -- no other code needs to change.
const FIELD_ALIASES = {
  title: ['title', 'book title', 'name'],
  author: ['author', 'authors', 'author name'],
  isbn: ['isbn', 'isbn13', 'isbn10', 'isbn-13', 'isbn-10'],
  olid: ['olid', 'open library id', 'openlibraryid', 'open library key'],
  cover_url: ['cover', 'cover url', 'cover_url', 'cover image', 'coverimage', 'image url'],
  status: ['status', 'reading status', 'shelf'],
  rating: ['rating', 'my rating', 'score', 'stars'],
  notes: ['notes', 'review', 'my review', 'blurb', 'description', 'comments'],
  pages: ['pages', 'page count', 'number of pages', 'num pages'],
  start_date: ['start date', 'date started', 'started', 'start_date', 'reading started'],
  finish_date: ['finish date', 'date finished', 'date read', 'finished', 'finish_date', 'reading finished'],
  tags: ['tags', 'genres', 'shelves', 'bookshelves', 'categories'],
};

// Values found in the CSV "status" column, normalized to our four statuses.
const STATUS_ALIASES = {
  to_read: ['to read', 'to-read', 'unread', 'want to read', 'wishlist', 'planned', 'toread'],
  reading: ['reading', 'currently reading', 'in progress', 'in_progress', 'inprogress'],
  finished: ['read', 'finished', 'completed', 'done', 'completed reading'],
  abandoned: ['abandoned', 'dnf', 'did not finish', 'dropped', 'paused', 'on hold'],
};

function normalizeHeader(h) {
  return String(h || '').trim().toLowerCase();
}

// Builds a map from our internal field name -> actual CSV header found in `headers`.
function buildHeaderMap(headers) {
  const normalized = headers.map(normalizeHeader);
  const map = {};
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    const idx = normalized.findIndex((h) => aliases.includes(h));
    if (idx !== -1) map[field] = headers[idx];
  }
  return map;
}

function normalizeStatus(raw) {
  const v = normalizeHeader(raw);
  if (!v) return 'to_read';
  for (const [status, aliases] of Object.entries(STATUS_ALIASES)) {
    if (aliases.includes(v)) return status;
  }
  return 'to_read';
}

// Best-effort conversion of common date formats to ISO yyyy-mm-dd.
// Returns null (rather than throwing) when the format isn't recognized,
// so a single bad date doesn't fail the whole row.
function normalizeDate(raw) {
  const v = String(raw || '').trim();
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;

  const parsed = new Date(v);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return null;
}

function normalizeRating(raw) {
  const v = String(raw || '').trim();
  if (!v) return null;
  const n = Number(v);
  if (Number.isNaN(n)) return null;
  const rounded = Math.round(n);
  return Math.min(5, Math.max(0, rounded));
}

function normalizeTags(raw) {
  const v = String(raw || '').trim();
  if (!v) return [];
  return v.split(/[,;|]/).map((t) => t.trim()).filter(Boolean);
}

module.exports = { buildHeaderMap, normalizeStatus, normalizeDate, normalizeRating, normalizeTags };
