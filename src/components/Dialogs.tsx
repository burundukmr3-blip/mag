// Свои диалоги вместо window.confirm: системные окна выкидывают из полноэкранного режима.
import { useState, useSyncExternalStore } from 'react';
import { Modal } from './Modal.tsx';

type Request =
  | { type: 'confirm'; title: string; text?: string; ok?: string; danger?: boolean; resolve: (v: boolean) => void }
  | { type: 'prompt'; title: string; label?: string; value: string; ok?: string; resolve: (v: string | null) => void }
  | { type: 'alert'; title: string; text?: string; resolve: () => void };

let queue: (Request & { id: number })[] = [];
let counter = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function push(r: Request) {
  queue = [...queue, { ...r, id: ++counter }];
  emit();
}
function pop() {
  queue = queue.slice(1);
  emit();
}

export function confirmDialog(opts: { title: string; text?: string; ok?: string; danger?: boolean }): Promise<boolean> {
  return new Promise((resolve) => push({ type: 'confirm', ...opts, resolve }));
}

export function promptDialog(opts: { title: string; label?: string; value?: string; ok?: string }): Promise<string | null> {
  return new Promise((resolve) => push({ type: 'prompt', value: '', ...opts, resolve }));
}

export function alertDialog(opts: { title: string; text?: string }): Promise<void> {
  return new Promise((resolve) => push({ type: 'alert', ...opts, resolve }));
}

export function DialogHost() {
  const current = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => queue[0],
  );
  if (!current) return null;
  return <DialogView key={current.id} req={current} />;
}

function DialogView({ req }: { req: Request }) {
  const [value, setValue] = useState(req.type === 'prompt' ? req.value : '');
  const done = (result: boolean) => {
    pop();
    if (req.type === 'confirm') req.resolve(result);
    else if (req.type === 'prompt') req.resolve(result ? value.trim() || null : null);
    else req.resolve();
  };
  return (
    <Modal
      title={req.title}
      onClose={() => done(false)}
      footer={
        <>
          {req.type !== 'alert' && (
            <button className="btn" onClick={() => done(false)}>
              Отмена
            </button>
          )}
          <button
            className={`btn ${req.type === 'confirm' && req.danger ? 'danger' : 'primary'}`}
            onClick={() => done(true)}
            autoFocus={req.type !== 'prompt'}
          >
            {req.type === 'alert' ? 'Понятно' : (req.ok ?? 'OK')}
          </button>
        </>
      }
    >
      {req.type !== 'prompt' && req.text && <p className="dialog-text">{req.text}</p>}
      {req.type === 'prompt' && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            done(true);
          }}
        >
          <label className="field">
            {req.label && <span>{req.label}</span>}
            <input autoFocus value={value} onChange={(e) => setValue(e.target.value)} onFocus={(e) => e.target.select()} />
          </label>
        </form>
      )}
    </Modal>
  );
}
