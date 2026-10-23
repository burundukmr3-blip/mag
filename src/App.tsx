import { Component, useEffect, type ReactNode } from 'react';
import { DialogHost } from './components/Dialogs.tsx';
import { Toasts } from './components/Toasts.tsx';
import { useRoute } from './lib/router.ts';
import { initStore, useStore } from './lib/store.ts';
import { Editor } from './screens/editor/Editor.tsx';
import { History } from './screens/History.tsx';
import { Home } from './screens/Home.tsx';
import { Library } from './screens/Library.tsx';
import { Play } from './screens/play/Play.tsx';
import { Settings } from './screens/Settings.tsx';
import { Setup } from './screens/Setup.tsx';

export function App() {
  const ready = useStore((s) => s.ready);
  const loadError = useStore((s) => s.loadError);
  const route = useRoute();

  useEffect(() => {
    initStore();
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route.name]);

  if (!ready) return <div className="center-note">Загрузка…</div>;
  if (loadError) {
    return (
      <div className="center-note">
        <h1>Не удалось открыть хранилище</h1>
        <p>{loadError}</p>
        <p className="muted">
          Приложению нужен IndexedDB. В режиме инкогнито или при запрете хранения данных сайта игры не сохраняются. Откройте страницу в обычном окне браузера.
        </p>
      </div>
    );
  }

  let screen: ReactNode;
  switch (route.name) {
    case 'edit':
      screen = <Editor key={route.id} id={route.id} />;
      break;
    case 'setup':
      screen = <Setup key={route.id ?? ''} id={route.id} />;
      break;
    case 'play':
      screen = <Play />;
      break;
    case 'library':
      screen = <Library />;
      break;
    case 'history':
      screen = <History />;
      break;
    case 'settings':
      screen = <Settings />;
      break;
    default:
      screen = <Home />;
  }

  return (
    <ErrorBoundary key={route.name}>
      {screen}
      <DialogHost />
      <Toasts />
    </ErrorBoundary>
  );
}

/** Ошибка в одном экране не должна обрывать игру: данные уже сохранены, достаточно перезагрузить. */
class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error(error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="center-note">
        <h1>Что-то пошло не так</h1>
        <p className="muted">{this.state.error.message}</p>
        <p>Все данные сохранены. Обновите страницу, чтобы продолжить с того же места.</p>
        <div className="row-actions">
          <button className="btn primary" onClick={() => location.reload()}>
            Обновить страницу
          </button>
          <button
            className="btn"
            onClick={() => {
              location.hash = '#/';
              location.reload();
            }}
          >
            На главную
          </button>
        </div>
      </div>
    );
  }
}
