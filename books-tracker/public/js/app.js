const STATUS_LABELS = {
  to_read: 'À lire',
  reading: 'En cours',
  finished: 'Terminé',
  abandoned: 'Abandonné',
};

const state = {
  status: '',
  tag: '',
  search: '',
  sort: 'recent',
  editingId: null,
};

async function api(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    headers: options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : undefined,
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

// ---------- Tabs (main view) ----------
document.getElementById('main-tabs').addEventListener('click', (e) => {
  const btn = e.target.closest('.tab-btn');
  if (!btn) return;
  document.querySelectorAll('#main-tabs .tab-btn').forEach((b) => b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  document.getElementById(`view-${btn.dataset.view}`).classList.add('active');

  if (btn.dataset.view === 'stats') loadStats();
});

// ---------- Library filters ----------
document.getElementById('status-filters').addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  document.querySelectorAll('#status-filters .chip').forEach((c) => c.classList.remove('active'));
  chip.classList.add('active');
  state.status = chip.dataset.status;
  loadBooks();
});

let searchDebounce;
document.getElementById('search-input').addEventListener('input', (e) => {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => {
    state.search = e.target.value.trim();
    loadBooks();
  }, 250);
});

document.getElementById('tag-filter').addEventListener('change', (e) => {
  state.tag = e.target.value;
  loadBooks();
});

document.getElementById('sort-select').addEventListener('change', (e) => {
  state.sort = e.target.value;
  loadBooks();
});

async function loadTags() {
  const tags = await api('/tags');
  const select = document.getElementById('tag-filter');
  const current = select.value;
  select.innerHTML = '<option value="">Tous les tags</option>' +
    tags.map((t) => `<option value="${escapeAttr(t.name)}">${escapeHtml(t.name)} (${t.book_count})</option>`).join('');
  select.value = current;
}

async function loadBooks() {
  const params = new URLSearchParams();
  if (state.status) params.set('status', state.status);
  if (state.tag) params.set('tag', state.tag);
  if (state.search) params.set('search', state.search);
  if (state.sort) params.set('sort', state.sort);

  const books = await api(`/books?${params.toString()}`);
  const grid = document.getElementById('book-grid');
  const empty = document.getElementById('empty-state');

  if (books.length === 0) {
    grid.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');
  grid.innerHTML = books.map(renderBookCard).join('');

  grid.querySelectorAll('.book-card').forEach((card) => {
    card.addEventListener('click', () => {
      const book = books.find((b) => String(b.id) === card.dataset.id);
      openBookModal(book);
    });
  });
}

function renderBookCard(book) {
  const cover = book.cover_url
    ? `<img src="${escapeAttr(book.cover_url)}" alt="" loading="lazy" />`
    : '📖';
  const stars = book.rating ? `<div class="stars-display">${'★'.repeat(book.rating)}${'☆'.repeat(5 - book.rating)}</div>` : '';
  return `
    <div class="book-card" data-id="${book.id}">
      <div class="cover">${cover}</div>
      <div class="info">
        <p class="title">${escapeHtml(book.title)}</p>
        <p class="author">${escapeHtml(book.author || '')}</p>
        <span class="status-badge ${book.status}">${STATUS_LABELS[book.status]}</span>
        ${stars}
      </div>
    </div>
  `;
}

// ---------- Book modal ----------
const modal = document.getElementById('book-modal');
const form = document.getElementById('book-form');

document.getElementById('fab-add').addEventListener('click', () => openBookModal(null));
document.getElementById('modal-close').addEventListener('click', closeBookModal);
document.getElementById('btn-cancel').addEventListener('click', closeBookModal);
modal.addEventListener('click', (e) => { if (e.target === modal) closeBookModal(); });

document.getElementById('modal-tabs').addEventListener('click', (e) => {
  const btn = e.target.closest('.tab-btn');
  if (!btn) return;
  document.querySelectorAll('#modal-tabs .tab-btn').forEach((b) => b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.modal-tab-content').forEach((c) => c.classList.remove('active'));
  document.getElementById(`modaltab-${btn.dataset.modaltab}`).classList.add('active');
});

function switchModalTab(tab) {
  document.querySelectorAll('#modal-tabs .tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.modaltab === tab));
  document.querySelectorAll('.modal-tab-content').forEach((c) => c.classList.toggle('active', c.id === `modaltab-${tab}`));
}

function openBookModal(book) {
  form.reset();
  document.getElementById('ol-results').innerHTML = '';
  document.getElementById('ol-search-input').value = '';
  setStars(0);
  document.getElementById('form-cover_url').dispatchEvent(new Event('input'));

  if (book) {
    state.editingId = book.id;
    document.getElementById('modal-title').textContent = book.title;
    document.getElementById('book-id').value = book.id;
    document.getElementById('form-title').value = book.title || '';
    document.getElementById('form-author').value = book.author || '';
    document.getElementById('form-cover_url').value = book.cover_url || '';
    document.getElementById('form-isbn').value = book.isbn || '';
    document.getElementById('form-pages').value = book.pages || '';
    document.getElementById('form-status').value = book.status;
    document.getElementById('form-start_date').value = book.start_date || '';
    document.getElementById('form-finish_date').value = book.finish_date || '';
    document.getElementById('form-tags').value = (book.tags || []).join(', ');
    document.getElementById('form-notes').value = book.notes || '';
    document.getElementById('form-olid').value = book.olid || '';
    setStars(book.rating || 0);
    document.getElementById('btn-delete').classList.remove('hidden');
    document.querySelector('[data-modaltab="search"]').classList.add('hidden');
    switchModalTab('manual');
  } else {
    state.editingId = null;
    document.getElementById('modal-title').textContent = 'Ajouter un livre';
    document.getElementById('btn-delete').classList.add('hidden');
    document.querySelector('[data-modaltab="search"]').classList.remove('hidden');
    switchModalTab('search');
  }

  updateCoverPreview();
  modal.classList.remove('hidden');
}

function closeBookModal() {
  modal.classList.add('hidden');
  state.editingId = null;
}

function updateCoverPreview() {
  const url = document.getElementById('form-cover_url').value.trim();
  const img = document.getElementById('form-cover-preview');
  if (url) {
    img.src = url;
    img.classList.remove('hidden');
  } else {
    img.classList.add('hidden');
  }
}
document.getElementById('form-cover_url').addEventListener('input', updateCoverPreview);

// ---------- Star picker ----------
const starPicker = document.getElementById('star-picker');
function setStars(value) {
  starPicker.dataset.value = value;
  starPicker.querySelectorAll('span').forEach((s) => {
    s.classList.toggle('filled', Number(s.dataset.star) <= value);
  });
}
starPicker.addEventListener('click', (e) => {
  const span = e.target.closest('span[data-star]');
  if (!span) return;
  const clicked = Number(span.dataset.star);
  const current = Number(starPicker.dataset.value);
  setStars(clicked === current ? 0 : clicked);
});

// ---------- Open Library search ----------
document.getElementById('ol-search-btn').addEventListener('click', runOlSearch);
document.getElementById('ol-search-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); runOlSearch(); }
});

async function runOlSearch() {
  const q = document.getElementById('ol-search-input').value.trim();
  const results = document.getElementById('ol-results');
  if (!q) return;
  results.innerHTML = '<p class="muted">Recherche...</p>';
  try {
    const items = await api(`/search/openlibrary?q=${encodeURIComponent(q)}`);
    if (items.length === 0) {
      results.innerHTML = '<p class="muted">Aucun résultat.</p>';
      return;
    }
    results.innerHTML = items.map((it, idx) => `
      <div class="ol-result-item" data-idx="${idx}">
        <img src="${it.cover_url ? escapeAttr(it.cover_url) : ''}" alt="" />
        <div class="meta">
          <div class="t">${escapeHtml(it.title)}</div>
          <div class="a">${escapeHtml(it.author || '')}${it.first_publish_year ? ' · ' + it.first_publish_year : ''}</div>
        </div>
      </div>
    `).join('');

    results.querySelectorAll('.ol-result-item').forEach((el) => {
      el.addEventListener('click', () => {
        const item = items[Number(el.dataset.idx)];
        document.getElementById('form-title').value = item.title || '';
        document.getElementById('form-author').value = item.author || '';
        document.getElementById('form-cover_url').value = item.cover_url || '';
        document.getElementById('form-isbn').value = item.isbn || '';
        document.getElementById('form-pages').value = item.pages || '';
        document.getElementById('form-olid').value = item.olid || '';
        updateCoverPreview();
        switchModalTab('manual');
      });
    });
  } catch (err) {
    results.innerHTML = `<p class="muted">Erreur: ${escapeHtml(err.message)}</p>`;
  }
}

// ---------- Save / delete ----------
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    title: document.getElementById('form-title').value.trim(),
    author: document.getElementById('form-author').value.trim() || null,
    cover_url: document.getElementById('form-cover_url').value.trim() || null,
    isbn: document.getElementById('form-isbn').value.trim() || null,
    olid: document.getElementById('form-olid').value.trim() || null,
    status: document.getElementById('form-status').value,
    rating: Number(starPicker.dataset.value) || null,
    pages: document.getElementById('form-pages').value ? Number(document.getElementById('form-pages').value) : null,
    start_date: document.getElementById('form-start_date').value || null,
    finish_date: document.getElementById('form-finish_date').value || null,
    notes: document.getElementById('form-notes').value.trim() || null,
    tags: document.getElementById('form-tags').value.split(',').map((t) => t.trim()).filter(Boolean),
  };

  try {
    if (state.editingId) {
      await api(`/books/${state.editingId}`, { method: 'PUT', body: JSON.stringify(payload) });
    } else {
      await api('/books', { method: 'POST', body: JSON.stringify(payload) });
    }
    closeBookModal();
    await Promise.all([loadBooks(), loadTags()]);
  } catch (err) {
    alert(`Erreur: ${err.message}`);
  }
});

document.getElementById('btn-delete').addEventListener('click', async () => {
  if (!state.editingId) return;
  if (!confirm('Supprimer ce livre ?')) return;
  try {
    await api(`/books/${state.editingId}`, { method: 'DELETE' });
    closeBookModal();
    await Promise.all([loadBooks(), loadTags()]);
  } catch (err) {
    alert(`Erreur: ${err.message}`);
  }
});

// ---------- Stats ----------
async function loadStats() {
  const el = document.getElementById('stats-content');
  el.innerHTML = '<p class="muted">Chargement...</p>';
  const s = await api('/stats');

  const statusOrder = ['to_read', 'reading', 'finished', 'abandoned'];
  const maxStatus = Math.max(1, ...statusOrder.map((k) => s.status_counts[k] || 0));
  const maxYearBooks = Math.max(1, ...s.per_year.map((y) => y.books));

  el.innerHTML = `
    <div class="stats-grid">
      <div class="stat-tile"><div class="num">${s.total_finished}</div><div class="label">Livres terminés</div></div>
      <div class="stat-tile"><div class="num">${s.total_pages_read}</div><div class="label">Pages lues</div></div>
      <div class="stat-tile"><div class="num">${s.average_rating ?? '–'}</div><div class="label">Note moyenne</div></div>
      <div class="stat-tile"><div class="num">${s.longest_book ? s.longest_book.pages : '–'}</div><div class="label">${s.longest_book ? escapeHtml(s.longest_book.title) : 'Livre le plus long'}</div></div>
    </div>

    <div class="stat-card">
      <h3>Par statut</h3>
      ${statusOrder.map((k) => barRow(STATUS_LABELS[k], s.status_counts[k] || 0, maxStatus)).join('')}
    </div>

    <div class="stat-card">
      <h3>Par année (livres terminés)</h3>
      ${s.per_year.length === 0 ? '<p class="muted">Pas encore de données.</p>' :
        s.per_year.map((y) => barRow(y.year, y.books, maxYearBooks, `${y.pages} pages`)).join('')}
    </div>

    <div class="stat-card">
      <h3>Tags les plus utilisés</h3>
      ${s.top_tags.length === 0 ? '<p class="muted">Aucun tag pour le moment.</p>' :
        s.top_tags.map((t) => barRow(t.name, t.count, Math.max(1, s.top_tags[0].count))).join('')}
    </div>
  `;
}

function barRow(label, value, max, rightLabel) {
  const pct = Math.round((value / max) * 100);
  return `
    <div class="bar-row">
      <div>${escapeHtml(String(label))}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
      <div>${rightLabel || value}</div>
    </div>
  `;
}

// ---------- CSV import ----------
document.getElementById('import-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fileInput = document.getElementById('import-file');
  const resultEl = document.getElementById('import-result');
  if (!fileInput.files[0]) return;

  const fd = new FormData();
  fd.append('file', fileInput.files[0]);

  resultEl.innerHTML = '<p class="muted">Import en cours...</p>';
  try {
    const res = await api('/import/csv', { method: 'POST', body: fd });
    resultEl.innerHTML = `
      <p><strong>${res.imported}</strong> livre(s) importé(s) sur ${res.total_rows} ligne(s).</p>
      ${res.skipped ? `<p>${res.skipped} ligne(s) ignorée(s).</p>` : ''}
      ${res.errors.length ? `<details><summary>Erreurs (${res.errors.length})</summary><ul>${res.errors.map((e) => `<li>Ligne ${e.row}: ${escapeHtml(e.reason)}</li>`).join('')}</ul></details>` : ''}
    `;
    await Promise.all([loadBooks(), loadTags()]);
  } catch (err) {
    resultEl.innerHTML = `<p class="muted">Erreur: ${escapeHtml(err.message)}</p>`;
  }
});

// ---------- utils ----------
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function escapeAttr(str) {
  return escapeHtml(str);
}

// ---------- init ----------
loadTags();
loadBooks();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
