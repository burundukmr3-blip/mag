import { useSyncExternalStore } from 'react';

export type Route =
  | { name: 'home' }
  | { name: 'edit'; id: string }
  | { name: 'setup'; id?: string }
  | { name: 'play' }
  | { name: 'library' }
  | { name: 'history' }
  | { name: 'settings' };

export function parseRoute(hash: string): Route {
  const [, name, id] = hash.replace(/^#/, '').split('/');
  switch (name) {
    case 'edit':
      return id ? { name: 'edit', id } : { name: 'home' };
    case 'setup':
      return { name: 'setup', id: id || undefined };
    case 'play':
    case 'library':
    case 'history':
    case 'settings':
      return { name };
    default:
      return { name: 'home' };
  }
}

function subscribe(cb: () => void): () => void {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => location.hash);
  return parseRoute(hash);
}

export function navigate(path: string): void {
  location.hash = path.startsWith('#') ? path : `#${path}`;
}
