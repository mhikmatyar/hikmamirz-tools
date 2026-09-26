(function () {
  const byId = (id) => document.getElementById(id);
  const nav = byId('tool-nav');
  const view = byId('view');
  const sidebar = byId('sidebar');
  const scrim = byId('scrim');
  const toggle = byId('sidebar-toggle');
  const search = byId('tool-search');
  const { icon, escapeHtml } = HTUtil;

  const store = {
    get(key, fallback) {
      try {
        return JSON.parse(localStorage.getItem(key)) ?? fallback;
      } catch (_) {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (_) {
        /* mode privat: abaikan */
      }
    },
  };

  let current = null;
  let cleanup = null;
  let routeToken = 0;
  let closedGroups = store.get('ht-groups', []);

  // ---------- sidebar ----------
  function renderNav() {
    const q = search.value.trim().toLowerCase();
    const match = (t) => !q || [t.name, t.tagline, t.description].some((s) => s.toLowerCase().includes(q));

    const html = HT.groups
      .map((group) => {
        const tools = HT.tools.filter((t) => t.group === group && match(t));
        if (!tools.length) return '';
        const closed = !q && closedGroups.includes(group);
        return `
          <div class="nav-group${closed ? ' is-closed' : ''}">
            <button class="nav-group-head" data-group="${escapeHtml(group)}" aria-expanded="${!closed}">
              ${icon('chevronDown', 16)}<span>${escapeHtml(group)}</span><span class="nav-count">${tools.length}</span>
            </button>
            <ul>
              ${tools
                .map((t) => {
                  const active = current && t.id === current.id;
                  return `<li><a href="#/${t.id}" class="nav-item${active ? ' is-active' : ''}" data-id="${t.id}" title="${escapeHtml(`${t.name} · ${t.tagline}`)}"${
                    active ? ' aria-current="page"' : ''
                  }>${icon(t.icon)}<span class="nav-text">${escapeHtml(t.name)}</span></a></li>`;
                })
                .join('')}
            </ul>
          </div>`;
      })
      .join('');

    nav.innerHTML = html || '<p class="nav-empty">Tidak ada tool yang cocok.</p>';
  }

  nav.addEventListener('click', (e) => {
    const head = e.target.closest('.nav-group-head');
    if (!head || search.value.trim()) return;
    const group = head.dataset.group;
    closedGroups = closedGroups.includes(group) ? closedGroups.filter((g) => g !== group) : [...closedGroups, group];
    store.set('ht-groups', closedGroups);
    renderNav();
  });

  // Muat kode tool lebih dulu saat kursor mengarah ke menunya.
  function prefetch(e) {
    const tool = HT.find(e.target.closest?.('.nav-item')?.dataset.id);
    if (tool && !tool.mount) HT.load(tool).catch(() => {});
  }
  nav.addEventListener('pointerover', prefetch);
  nav.addEventListener('focusin', prefetch);

  search.addEventListener('input', renderNav);
  search.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const first = nav.querySelector('.nav-item');
      if (first) location.hash = first.getAttribute('href');
    } else if (e.key === 'Escape' && search.value) {
      e.stopPropagation();
      search.value = '';
      renderNav();
    }
  });

  const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  byId('search-kbd').textContent = isMac ? '⌘K' : 'Ctrl K';
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (matchMedia('(max-width: 900px)').matches) openSidebar();
      setCollapsed(false);
      search.focus();
      search.select();
    } else if (e.key === 'Escape') {
      closeSidebar();
    }
  });

  function setCollapsed(on) {
    document.documentElement.classList.toggle('sidebar-collapsed', on);
    byId('collapse').setAttribute('aria-label', on ? 'Buka sidebar' : 'Ciutkan sidebar');
    byId('collapse').title = on ? 'Buka sidebar' : 'Ciutkan sidebar';
    try {
      localStorage.setItem('ht-collapsed', on ? '1' : '0');
    } catch (_) {
      /* abaikan */
    }
  }
  byId('collapse').addEventListener('click', () => setCollapsed(!document.documentElement.classList.contains('sidebar-collapsed')));

  function openSidebar() {
    sidebar.classList.add('is-open');
    scrim.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
  }
  function closeSidebar() {
    sidebar.classList.remove('is-open');
    scrim.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
  }
  toggle.addEventListener('click', () => (sidebar.classList.contains('is-open') ? closeSidebar() : openSidebar()));
  scrim.addEventListener('click', closeSidebar);

  // ---------- slider: isi warna track ----------
  document.addEventListener('input', (e) => {
    if (e.target.matches?.('input[type="range"]')) HTUtil.syncRange(e.target);
  });

  // ---------- route ----------
  async function route() {
    const id = location.hash.replace(/^#\/?/, '');
    const tool = HT.find(id) || HT.tools[0];
    if (tool.id !== id) history.replaceState(null, '', '#/' + tool.id);
    if (current === tool && view.childElementCount) return;

    const token = ++routeToken;
    if (typeof cleanup === 'function') cleanup();
    cleanup = null;
    current = tool;

    byId('page-crumb').textContent = `${tool.group} / ${tool.tagline}`;
    byId('page-title').textContent = tool.name;
    byId('page-desc').textContent = tool.description;
    document.title = `${tool.name} · ${tool.tagline} · Mirz Labs`;
    renderNav();
    closeSidebar();

    if (!tool.mount) view.innerHTML = '<div class="loading"><span class="spinner"></span> Memuat tool…</div>';
    try {
      await HT.load(tool);
    } catch (err) {
      if (token === routeToken) view.innerHTML = `<div class="notice notice-warn">${escapeHtml(err.message)}</div>`;
      return;
    }
    if (token !== routeToken) return; // sudah pindah ke tool lain

    view.innerHTML = '';
    cleanup = tool.mount(view);
    view.querySelectorAll('input[type="range"]').forEach(HTUtil.syncRange);
    view.focus({ preventScroll: true });
  }

  window.addEventListener('hashchange', route);
  setCollapsed(document.documentElement.classList.contains('sidebar-collapsed'));
  route();

  // Cache aplikasi dan library supaya kunjungan berikutnya instan (tidak aktif di localhost).
  if ('serviceWorker' in navigator && location.protocol !== 'file:' && location.hostname !== 'localhost') {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
})();
