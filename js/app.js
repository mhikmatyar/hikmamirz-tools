(function () {
  const nav = document.getElementById('tool-nav');
  const view = document.getElementById('view');
  const sidebar = document.getElementById('sidebar');
  const scrim = document.getElementById('scrim');
  const toggle = document.getElementById('sidebar-toggle');

  let cleanup = null;

  function renderNav(activeId) {
    nav.innerHTML = HT.tools
      .map(
        (t) => `
        <li>
          <a href="#/${t.id}" class="nav-item${t.id === activeId ? ' is-active' : ''}"${t.id === activeId ? ' aria-current="page"' : ''}>
            <span class="nav-icon">${t.icon}</span>
            <span>${t.name}</span>
          </a>
        </li>`
      )
      .join('');
  }

  function route() {
    const id = location.hash.replace(/^#\/?/, '');
    const tool = HT.find(id) || HT.tools[0];

    if (!tool) {
      view.innerHTML = '<p class="empty">Belum ada tool.</p>';
      return;
    }
    if (tool.id !== id) {
      history.replaceState(null, '', '#/' + tool.id);
    }

    if (typeof cleanup === 'function') cleanup();
    view.innerHTML = '';
    cleanup = tool.mount(view);

    document.title = `${tool.name} · Hikmamirz Tools`;
    renderNav(tool.id);
    closeSidebar();
    view.focus({ preventScroll: true });
  }

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
  document.addEventListener('keydown', (e) => e.key === 'Escape' && closeSidebar());

  view.tabIndex = -1;
  window.addEventListener('hashchange', route);
  route();
})();
