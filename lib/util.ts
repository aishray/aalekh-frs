import clsx, { type ClassValue } from 'clsx';

export const cn = (...v: ClassValue[]) => clsx(v);

export const nowIso = () => new Date().toISOString();

export function uid(prefix = 'id') {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`;
}

export function fmtDate(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function fmtDateTime(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function inr(n: number) {
  return '₹' + n.toLocaleString('en-IN');
}

/** Next free sequential id: nextId(['RES-1','RES-3'], 'RES') -> 'RES-4' */
export function nextId(existing: string[], prefix: string, pad = 0) {
  let max = 0;
  const re = new RegExp(`^${prefix.replace(/[-]/g, '\\-')}-(\\d+)$`);
  for (const id of existing) {
    const m = id.match(re);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  const n = String(max + 1);
  return `${prefix}-${pad ? n.padStart(pad, '0') : n}`;
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function unique<T>(arr: T[]) {
  return Array.from(new Set(arr));
}

/** Display form of a ref: "GO-4.2" -> "GO 4.2" */
export function refLabel(ref: string) {
  return ref.replace(/^([A-Z0-9]+)-/, '$1 ');
}

export function download(filename: string, data: Blob | string, type = 'text/plain') {
  const blob = typeof data === 'string' ? new Blob([data], { type }) : data;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
