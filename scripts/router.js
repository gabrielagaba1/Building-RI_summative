export const ROUTES = {
  dashboard: 'Dashboard',
  ledger: 'Ledger',
  issue: 'New entry',
  settings: 'Settings',
  about: 'About'
};

let current = null;
let pendingFocus = null;
let onRoute = () => {};

function show(name, moveFocus) {
  current = name;
  document.querySelectorAll('[data-view]').forEach(view => {
    view.hidden = view.dataset.view !== name;
  });
  document.querySelectorAll('[data-route]').forEach(link => {
    if (link.dataset.route === name) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  document.title = `${ROUTES[name]} · Amafaranga`;
  onRoute(name);

  if (moveFocus) {
    window.scrollTo(0, 0);
    const target = document.querySelector(pendingFocus || `[data-view="${name}"] h1`);
    target?.focus();
  }
  pendingFocus = null;
}

function resolve(moveFocus) {
  const name = location.hash.slice(1);
  if (ROUTES[name]) show(name, moveFocus);
  else if (!current) show('dashboard', false);
}

export function startRouter(listener) {
  onRoute = listener;
  window.addEventListener('hashchange', () => resolve(true));
  resolve(false);
}

export function go(name, focusSelector = null) {
  pendingFocus = focusSelector;
  if (current === name) show(name, true);
  else location.hash = name;
}

export const currentRoute = () => current;
