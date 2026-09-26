import { prisma } from '../db/prismaClient.js';
import { ASSETS, DAY, dayStart, cryptoError } from './cryptoMath.js';

export function parseCandles(body, asset, from, to) {
  if (!Array.isArray(body)) throw cryptoError('Invalid Coinbase price response.', 502, 'PRICE_ERROR');
  const unique = new Map();
  for (const row of body) {
    if (!Array.isArray(row) || row.length < 6 || !row.every(Number.isFinite)) throw cryptoError('Invalid Coinbase candle.', 502, 'PRICE_ERROR');
    const [seconds, low, high, open, close, volume] = row;
    const time = seconds * 1000;
    if (time < from || time >= to) continue;
    if (time % DAY || Math.min(low, high, open, close) <= 0 || low > Math.min(open, close) || high < Math.max(open, close) || volume < 0) throw cryptoError('Invalid Coinbase candle values.', 502, 'PRICE_ERROR');
    unique.set(time, { asset, day: new Date(time), open, high, low, close, volume, source: 'coinbase' });
  }
  return [...unique.values()].sort((a, b) => a.day - b.day);
}

export async function refreshPrices({ signal, onProgress = async () => {}, fetchImpl = fetch } = {}) {
  const today = dayStart(Date.now());
  const first = Date.parse('2021-01-01');
  for (const [asset, product] of Object.entries(ASSETS)) {
    for (let start = first; start < today; start += 250 * DAY) {
      signal?.throwIfAborted();
      const end = Math.min(start + 250 * DAY, today);
      const key = { asset, start: new Date(start), end: new Date(end) };
      const cached = await prisma.cryptoPriceWindow.findUnique({ where: { asset_start_end: key } });
      if (cached && (end < today || Date.now() - cached.fetchedAt.getTime() < DAY)) continue;
      await onProgress(`${asset} · fetching daily prices from ${new Date(start).toISOString().slice(0, 10)}`);
      let body;
      for (let attempt = 0; attempt < 3; attempt++) {
        const response = await fetchImpl(`https://api.exchange.coinbase.com/products/${product}/candles?${new URLSearchParams({ granularity: '86400', start: new Date(start).toISOString(), end: new Date(end).toISOString() })}`, {
          signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(30000)]) : AbortSignal.timeout(30000)
        });
        if (response.ok) { body = await response.json(); break; }
        if (attempt === 2 || (response.status !== 429 && response.status < 500)) throw cryptoError(`Coinbase ${asset} prices unavailable (${response.status}). Cached prices remain available.`, 502, 'PRICE_ERROR');
        await new Promise(resolve => setTimeout(resolve, 1000 * 2 ** attempt));
      }
      const candles = parseCandles(body, asset, start, end);
      await prisma.$transaction([
        ...candles.map(c => prisma.cryptoCandle.upsert({ where: { asset_day: { asset, day: c.day } }, create: c, update: { ...c, fetchedAt: new Date() } })),
        prisma.cryptoPriceWindow.upsert({ where: { asset_start_end: key }, create: key, update: { fetchedAt: new Date() } })
      ]);
      await new Promise(resolve => setTimeout(resolve, 350));
    }
  }
}
