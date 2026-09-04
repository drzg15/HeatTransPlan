/**
 * Generates a v4 UUID.
 *
 * `crypto.randomUUID()` is only defined in a secure context — HTTPS, or
 * localhost. Opening the app over plain HTTP on a LAN address (the usual way
 * to test it from a phone on the same wifi) leaves it undefined, and calling
 * it throws. That took down the whole analysis page, because the first pinch
 * result mints a scenario id.
 *
 * `crypto.getRandomValues()` has no such restriction, so the fallback is still
 * cryptographically sound; the last resort only matters for ancient browsers.
 */
export function newId(): string {
  const c = globalThis.crypto;

  if (typeof c?.randomUUID === 'function') return c.randomUUID();

  if (typeof c?.getRandomValues === 'function') {
    const b = c.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 0x0f) | 0x40; // version 4
    b[8] = (b[8] & 0x3f) | 0x80; // variant 10
    const hex = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  return `id-${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`;
}
