import { useEffect, useRef, type ReactNode } from 'react';

let depth = 0;
/** Открыт ли сейчас диалог: горячие клавиши игры в это время не работают. */
export function isModalOpen(): boolean {
  return depth > 0;
}

interface Props {
  title?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  full?: boolean;
  className?: string;
}

export function Modal({ title, onClose, children, footer, wide, full, className }: Props) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    depth++;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        e.preventDefault();
        // Закрываем только верхний диалог.
        const panels = document.querySelectorAll('.modal-panel');
        if (panels[panels.length - 1] === panelRef.current) closeRef.current();
      }
    };
    window.addEventListener('keydown', onKey, true);
    const prev = document.activeElement as HTMLElement | null;
    panelRef.current?.querySelector<HTMLElement>('[autofocus], input, textarea, select, button')?.focus();
    return () => {
      depth--;
      window.removeEventListener('keydown', onKey, true);
      prev?.focus?.();
    };
  }, []);

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={panelRef} className={`modal-panel${wide ? ' wide' : ''}${full ? ' full' : ''} ${className ?? ''}`} role="dialog" aria-modal="true">
        {title !== undefined && (
          <header className="modal-head">
            <h2>{title}</h2>
            <button className="icon-btn" onClick={onClose} aria-label="Закрыть" title="Закрыть (Esc)">
              ✕
            </button>
          </header>
        )}
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>
  );
}
