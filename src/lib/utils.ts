export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function clone<T>(value: T): T {
  return structuredClone(value);
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** plural(5, ['вопрос', 'вопроса', 'вопросов']) → 'вопросов' */
export function plural(n: number, forms: [string, string, string]): string {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return forms[2];
  if (b > 1 && b < 5) return forms[1];
  if (b === 1) return forms[0];
  return forms[2];
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  const units = ['КБ', 'МБ', 'ГБ'];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(value < 10 ? 1 : 0).replace('.', ',')} ${units[i]}`;
}

export function formatDate(ts: number): string {
  return new Date(ts).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatScore(n: number): string {
  return n.toLocaleString('ru-RU').replace('-', '−');
}

export function signed(n: number): string {
  return n > 0 ? `+${formatScore(n)}` : n < 0 ? `−${formatScore(-n)}` : '0';
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function safeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, '_').trim() || 'игра';
}

let pendingInput: HTMLInputElement | null = null;

/** Открывает выбор файлов. При отмене промис просто не выполняется. */
export function pickFiles(accept: string, multiple = false): Promise<File[]> {
  return new Promise((resolve) => {
    // Поле должно быть в документе: у оторванного от DOM поля Safari не присылает событие change.
    pendingInput?.remove();
    const input = document.createElement('input');
    pendingInput = input;
    input.type = 'file';
    input.accept = accept;
    input.multiple = multiple;
    input.hidden = true;
    document.body.appendChild(input);
    input.addEventListener(
      'change',
      () => {
        resolve(Array.from(input.files ?? []));
        input.remove();
        if (pendingInput === input) pendingInput = null;
      },
      { once: true },
    );
    input.click();
  });
}

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

export function toggleFullscreen(): void {
  const doc = document as Document & { webkitFullscreenElement?: Element; webkitExitFullscreen?: () => void };
  const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void };
  if (document.fullscreenElement || doc.webkitFullscreenElement) {
    if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
    else doc.webkitExitFullscreen?.();
  } else if (el.requestFullscreen) {
    el.requestFullscreen().catch(() => {});
  } else {
    el.webkitRequestFullscreen?.();
  }
}
