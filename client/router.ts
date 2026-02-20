type RouteHandler = (url: URL) => Promise<void>;

const routes: Array<{ path: string; handler: RouteHandler }> = [];
let currentPage: string | null = null;

export function registerRoute(path: string, handler: RouteHandler) {
  routes.push({ path, handler });
}

export function getCurrentPage(): string | null {
  return currentPage;
}

function matchRoute(pathname: string): { handler: RouteHandler; path: string } | null {
  for (const route of routes) {
    if (route.path === pathname) return route;
  }
  return null;
}

async function dispatch(url: URL) {
  const match = matchRoute(url.pathname);
  if (!match) return;
  currentPage = match.path;
  try {
    await match.handler(url);
  } catch (e: any) {
    if (e.name === 'AbortError') return;
    throw e;
  }
}

export function navigate(url: string, replace = false) {
  const parsed = new URL(url, window.location.origin);
  if (replace) {
    history.replaceState(null, '', parsed.href);
  } else {
    history.pushState(null, '', parsed.href);
  }
  dispatch(parsed);
}

export function initRouter() {
  // Handle popstate (back/forward)
  window.addEventListener('popstate', () => {
    dispatch(new URL(window.location.href));
  });

  // Intercept data-link clicks
  document.addEventListener('click', (e) => {
    const link = (e.target as Element).closest('a[data-link]');
    if (!link) return;
    e.preventDefault();
    const href = link.getAttribute('href');
    if (href) navigate(href);
  });

  // Dispatch initial route
  dispatch(new URL(window.location.href));
}
