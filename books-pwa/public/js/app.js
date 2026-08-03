const STATUS_LABELS = {
  to_read: 'À lire',
  reading: 'En cours',
  finished: 'Terminé',
  abandoned: 'Abandonné',
};

const state = {
  view: 'library',
  filters: { status: '', q: '', tag: '', sort: 'recent' },
  editingId: null,
  rating: 0,
};

const $ = (id) => document.getElementById(id);

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : undefined,
    ...options,
  });
  if (!res.ok) {
    let message = `Erreur ${res.status}`;
    try {
      const data = await res.json();
      message = data.error || message;
    } catch (_) {}
    throw new Error(message);
  }
  if (res.status === 204) return null;
  return res.json();
}

// ---------- View switching ----------

function switchView(view) {
  state.view = view;
  document.querySelectorAll('.view').forEach((el) => el.classList.add('hidden'));
  $(`view-${view}`).classList.remove('hidden');
  document.querySelectorAll('.nav-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });

  if (view === 'library') loadLibrary();
  if (view === 'stats') loadStats();
  if (view === 'add' && !state.editingId) resetForm();
}

document.querySelectorAll('.nav-btn').forEach((btn) => {
  btn.addEventListener('click', () => switchView(btn.dataset.view));
});

// ---------- Library ----------

async function loadTagFilterOptions() {
  const tags = await api('/api/tags');
  const select = $('tag-filter');
  const current = select.value;
  select.innerHTML = '<option value="">Tous les tags</option>' +
    tags.map((t) => `<option value="${escapeAttr(t.name)}">${escapeHtml(t.name)} (${t.book_count})</option>`).join('');
  select.value = current;

  const datalist = $('tag-suggestions');
  datalist.innerHTML = tags.map((t) => `<option value="${escapeAttr(t.name)}">`).join('');
}

async function loadLibrary() {
  const params = new URLSearchParams();
  if (state.filters.status) params.set('status', state.filters.status);
  if (state.filters.q) params.set('q', state.filters.q);
  if (state.filters.tag) params.set('tag', state.filters.tag);
  if (state.filters.sort) params.set('sort', state.filters.sort);

  const books = await api(`/api/books?${params.toString()}`);
  renderBookList(books);
}

function renderBookList(books) {
  const list = $('book-list');
  const empty = $('empty-state');
  if (books.length === 0) {
    list.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  list.innerHTML = books
    .map((b) => {
      const cover = b.cover_url
        ? `<img class="cover" src="${escapeAttr(b.cover_url)}" alt="" loading="lazy" />`
        : `<div class="cover"></div>`;
      const stars = b.rating ? `<span class="stars-display">${'★'.repeat(b.rating)}${'☆'.repeat(5 - b.rating)}</span>` : '';
      return `
        <div class="book-card" data-id="${b.id}">
          ${cover}
          <div class="title">${escapeHtml(b.title)}</div>
          <div class="author">${escapeHtml(b.author || '')}</div>
          <div class="meta">
            <span class="badge status-${b.status}">${STATUS_LABELS[b.status]}</span>
            ${stars}
          </div>
        </div>`;
    })
    .join('');

  list.querySelectorAll('.book-card').forEach((card) => {
    card.addEventListener('click', () => editBook(Number(card.dataset.id)));
  });
}

$('search-input').addEventListener('input', debounce((e) => {
  state.filters.q = e.target.value.trim();
  loadLibrary();
}, 300));

$('tag-filter').addEventListener('change', (e) => {
  state.filters.tag = e.target.value;
  loadLibrary();
});

$('sort-select').addEventListener('change', (e) => {
  state.filters.sort = e.target.value;
  loadLibrary();
});

$('status-tabs').addEventListener('click', (e) => {
  const btn = e.target.closest('.status-tab');
  if (!btn) return;
  document.querySelectorAll('.status-tab').forEach((b) => b.classList.remove('active'));
  btn.classList.add('active');
  state.filters.status = btn.dataset.status;
  loadLibrary();
});

// ---------- Add / Edit form ----------

function resetForm() {
  state.editingId = null;
  state.rating = 0;
  $('add-title').textContent = 'Ajouter un livre';
  $('book-form').reset();
  $('book-id').value = '';
  $('open-library-id').value = '';
  $('delete-btn').classList.add('hidden');
  $('cover-preview').classList.add('hidden');
  $('ol-results').innerHTML = '';
  $('ol-search-input').value = '';
  renderStars();
}

function fillForm(book) {
  state.editingId = book.id;
  state.rating = book.rating || 0;
  $('add-title').textContent = 'Modifier le livre';
  $('book-id').value = book.id;
  $('open-library-id').value = book.open_library_id || '';
  $('f-title').value = book.title || '';
  $('f-author').value = book.author || '';
  $('f-isbn').value = book.isbn || '';
  $('f-pages').value = book.pages || '';
  $('f-cover').value = book.cover_url || '';
  $('f-status').value = book.status || 'to_read';
  $('f-date-started').value = book.date_started || '';
  $('f-date-finished').value = book.date_finished || '';
  $('f-tags').value = (book.tags || []).join(', ');
  $('f-notes').value = book.notes || '';
  $('delete-btn').classList.remove('hidden');
  updateCoverPreview();
  renderStars();
}

function editBook(id) {
  api(`/api/books/${id}`).then((book) => {
    fillForm(book);
    switchView('add');
  }).catch(showError);
}

function updateCoverPreview() {
  const url = $('f-cover').value.trim();
  const img = $('cover-preview');
  if (url) {
    img.src = url;
    img.classList.remove('hidden');
  } else {
    img.classList.add('hidden');
  }
}
$('f-cover').addEventListener('input', updateCoverPreview);

function renderStars() {
  const spans = document.querySelectorAll('#f-rating span');
  spans.forEach((s) => s.classList.toggle('filled', Number(s.dataset.star) <= state.rating));
}
$('f-rating').addEventListener('click', (e) => {
  const span = e.target.closest('span');
  if (!span) return;
  const value = Number(span.dataset.star);
  state.rating = state.rating === value ? 0 : value;
  renderStars();
});

$('cancel-btn').addEventListener('click', () => {
  resetForm();
  switchView('library');
});

$('book-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    title: $('f-title').value.trim(),
    author: $('f-author').value.trim() || null,
    isbn: $('f-isbn').value.trim() || null,
    pages: $('f-pages').value ? Number($('f-pages').value) : null,
    cover_url: $('f-cover').value.trim() || null,
    open_library_id: $('open-library-id').value || null,
    status: $('f-status').value,
    rating: state.rating || null,
    date_started: $('f-date-started').value || null,
    date_finished: $('f-date-finished').value || null,
    tags: $('f-tags').value.split(',').map((t) => t.trim()).filter(Boolean),
    notes: $('f-notes').value.trim() || null,
  };

  try {
    if (state.editingId) {
      await api(`/api/books/${state.editingId}`, { method: 'PUT', body: JSON.stringify(payload) });
    } else {
      await api('/api/books', { method: 'POST', body: JSON.stringify(payload) });
    }
    resetForm();
    switchView('library');
    loadTagFilterOptions();
  } catch (err) {
    showError(err.message);
  }
});

$('delete-btn').addEventListener('click', async () => {
  if (!state.editingId) return;
  if (!confirm('Supprimer ce livre ?')) return;
  try {
    await api(`/api/books/${state.editingId}`, { method: 'DELETE' });
    resetForm();
    switchView('library');
    loadTagFilterOptions();
  } catch (err) {
    showError(err.message);
  }
});

// ---------- Open Library search ----------

async function searchOpenLibrary() {
  const q = $('ol-search-input').value.trim();
  if (!q) return;
  const results = $('ol-results');
  results.innerHTML = '<p class="hint">Recherche...</p>';
  try {
    const items = await api(`/api/openlibrary/search?q=${encodeURIComponent(q)}`);
    if (items.length === 0) {
      results.innerHTML = '<p class="hint">Aucun résultat.</p>';
      return;
    }
    results.innerHTML = items
      .map(
        (it, idx) => `
        <div class="ol-result" data-idx="${idx}">
          ${it.cover_url ? `<img src="${escapeAttr(it.cover_url)}" alt="" loading="lazy" />` : '<img alt="" />'}
          <div class="info">
            <div>${escapeHtml(it.title)}</div>
            <div class="a">${escapeHtml(it.author || '')} ${it.first_publish_year ? `· ${it.first_publish_year}` : ''}</div>
          </div>
        </div>`
      )
      .join('');
    results.querySelectorAll('.ol-result').forEach((el) => {
      el.addEventListener('click', () => {
        const item = items[Number(el.dataset.idx)];
        $('f-title').value = item.title || '';
        $('f-author').value = item.author || '';
        $('f-isbn').value = item.isbn || '';
        $('f-pages').value = item.pages || '';
        $('f-cover').value = item.cover_url || '';
        $('open-library-id').value = item.open_library_id || '';
        updateCoverPreview();
        results.innerHTML = '';
        $('ol-search-input').value = '';
      });
    });
  } catch (err) {
    results.innerHTML = `<p class="hint">Erreur : ${escapeHtml(err.message)}</p>`;
  }
}
$('ol-search-btn').addEventListener('click', searchOpenLibrary);
$('ol-search-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    searchOpenLibrary();
  }
});

// ---------- Stats ----------

async function loadStats() {
  const el = $('stats-content');
  el.innerHTML = '<p class="hint">Chargement...</p>';
  try {
    const s = await api('/api/stats');
    renderStats(s);
  } catch (err) {
    el.innerHTML = `<p class="hint">Erreur : ${escapeHtml(err.message)}</p>`;
  }
}

function renderStats(s) {
  const maxBooks = Math.max(1, ...s.perYear.map((y) => y.books));
  const yearRows = s.perYear
    .map(
      (y) => `
      <div class="bar-row">
        <span class="bar-label">${y.year}</span>
        <span class="bar-track"><span class="bar-fill" style="width:${(y.books / maxBooks) * 100}%"></span></span>
        <span class="bar-value">${y.books} livres</span>
      </div>`
    )
    .join('') || '<p class="hint">Pas encore de livre terminé.</p>';

  const tagPills = s.topTags
    .map((t) => `<span class="tag-pill">${escapeHtml(t.name)} · ${t.book_count}</span>`)
    .join('') || '<p class="hint">Aucun tag pour le moment.</p>';

  $('stats-content').innerHTML = `
    <div class="stat-cards">
      <div class="stat-card"><div class="value">${s.totalBooks}</div><div class="label">Livres au total</div></div>
      <div class="stat-card"><div class="value">${s.byStatus.finished || 0}</div><div class="label">Terminés</div></div>
      <div class="stat-card"><div class="value">${s.currentYear.books}</div><div class="label">Terminés en ${s.currentYear.year}</div></div>
      <div class="stat-card"><div class="value">${s.totalPagesRead}</div><div class="label">Pages lues</div></div>
      <div class="stat-card"><div class="value">${s.avgRating ?? '–'}</div><div class="label">Note moyenne</div></div>
    </div>
    <div class="stats-block">
      <h3>Livres terminés par an</h3>
      ${yearRows}
    </div>
    <div class="stats-block">
      <h3>Tags les plus utilisés</h3>
      <div class="tag-pill-list">${tagPills}</div>
    </div>
  `;
}

// ---------- Import ----------

$('import-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fileInput = $('import-file');
  if (!fileInput.files.length) return;

  const formData = new FormData();
  formData.append('file', fileInput.files[0]);
  const skipExisting = $('import-skip-existing').checked;

  const resultEl = $('import-result');
  resultEl.classList.remove('hidden');
  resultEl.innerHTML = '<p class="hint">Import en cours...</p>';

  try {
    const result = await api(`/api/import?skipExisting=${skipExisting}`, { method: 'POST', body: formData });
    const errRows = result.errors.map((e) => `<div class="err-row">Ligne ${e.row} : ${escapeHtml(e.reason)}</div>`).join('');
    resultEl.innerHTML = `
      <p><strong>${result.imported}</strong> livre(s) importé(s), <strong>${result.skipped}</strong> ignoré(s) sur ${result.total}.</p>
      ${errRows}
    `;
    fileInput.value = '';
    loadTagFilterOptions();
  } catch (err) {
    resultEl.innerHTML = `<p class="err-row">${escapeHtml(err.message)}</p>`;
  }
});

// ---------- Utils ----------

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function escapeAttr(str) {
  return escapeHtml(str);
}
function showError(message) {
  alert(message);
}

// ---------- Init ----------

loadTagFilterOptions();
loadLibrary();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').catch(() => {});
  });
}
