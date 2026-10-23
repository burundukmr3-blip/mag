// Минимальное чтение первого листа .xlsx: только значения ячеек, без формул и форматирования.
import { strFromU8, unzipSync } from 'fflate';

function columnIndex(ref: string): number {
  const letters = ref.replace(/\d+/g, '').toUpperCase();
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function textOf(el: Element): string {
  return Array.from(el.getElementsByTagName('t'))
    .map((t) => t.textContent ?? '')
    .join('');
}

export function parseXlsx(buffer: ArrayBuffer): string[][] {
  const files = unzipSync(new Uint8Array(buffer), {
    filter: (f) => f.name.startsWith('xl/') && f.name.endsWith('.xml') && !f.name.includes('/theme'),
  });
  const parse = (name: string) => (files[name] ? new DOMParser().parseFromString(strFromU8(files[name]), 'application/xml') : null);

  const shared = parse('xl/sharedStrings.xml');
  const strings = shared ? Array.from(shared.getElementsByTagName('si')).map(textOf) : [];

  let sheetPath = 'xl/worksheets/sheet1.xml';
  const workbook = parse('xl/workbook.xml');
  const rels = parse('xl/_rels/workbook.xml.rels');
  const firstSheet = workbook?.getElementsByTagName('sheet')[0];
  const relId = firstSheet?.getAttribute('r:id') ?? firstSheet?.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
  if (rels && relId) {
    const rel = Array.from(rels.getElementsByTagName('Relationship')).find((r) => r.getAttribute('Id') === relId);
    const target = rel?.getAttribute('Target');
    if (target) sheetPath = target.startsWith('/') ? target.slice(1) : `xl/${target}`;
  }
  if (!files[sheetPath]) sheetPath = Object.keys(files).find((n) => n.startsWith('xl/worksheets/sheet')) ?? sheetPath;
  const sheet = parse(sheetPath);
  if (!sheet) throw new Error('В файле Excel не найден лист с данными');

  const rows: string[][] = [];
  for (const rowEl of Array.from(sheet.getElementsByTagName('row'))) {
    const row: string[] = [];
    let next = 0;
    for (const c of Array.from(rowEl.getElementsByTagName('c'))) {
      const ref = c.getAttribute('r');
      const idx = ref ? columnIndex(ref) : next;
      next = idx + 1;
      const type = c.getAttribute('t');
      const v = c.getElementsByTagName('v')[0]?.textContent ?? '';
      let value: string;
      if (type === 's') value = strings[Number(v)] ?? '';
      else if (type === 'inlineStr') value = textOf(c);
      else if (type === 'b') value = v === '1' ? 'ИСТИНА' : 'ЛОЖЬ';
      else value = v;
      row[idx] = value;
    }
    rows.push(Array.from(row, (x) => x ?? ''));
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}
