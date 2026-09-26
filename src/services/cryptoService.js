import { apiFetch } from './apiClient';

export const IVAN_CHANNEL = 'UCrYmtJBtLdtm2ov84ulV-yg';
export const CRYPTO_SELECTION_KEY = 'ytf.crypto.channels.v1';
export function initialCryptoChannels(channels) {
  let saved;
  try { saved = JSON.parse(localStorage.getItem(CRYPTO_SELECTION_KEY)); } catch { /* use default */ }
  const available = new Set(channels.map(c => c.youtubeChannelId));
  if (Array.isArray(saved)) {
    const valid = [...new Set(saved)].filter(id => available.has(id)).slice(0, 3);
    if (valid.length) return valid;
  }
  return available.has(IVAN_CHANNEL) ? [IVAN_CHANNEL] : channels.slice(0, 1).map(c => c.youtubeChannelId);
}
export function query(params) {
  return new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, Array.isArray(v) ? v.join(',') : v]))).toString();
}
async function request(path, options) {
  const response = await apiFetch(`/api/crypto${path}`, options);
  const body = await response.json().catch(() => ({ error: 'Crypto API did not return JSON. Restart the transcript server after installing this feature.' }));
  if (!response.ok) throw new Error(body.error || 'Crypto request failed');
  return body;
}
const json = (body, method = 'POST') => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
export const loadCryptoDashboard = (params, signal) => request(`/dashboard?${query(params)}`, { signal });
export const loadCryptoAnalyses = (params, signal) => request(`/analyses?${query(params)}`, { signal });
export const loadCryptoDetail = (id, signal) => request(`/analyses/${id}`, { signal });
export const loadCryptoJobs = (params, signal) => request(`/jobs?${query(params)}`, { signal });
export const startCryptoJob = (params, kind) => request('/jobs', json({ ...params, kind }));
export const controlCryptoJob = (id, action) => request(`/jobs/${id}/${action}`, json({}));
export const saveCryptoBaseline = (channelId, overrides) => request(`/calibration/${channelId}`, json({ overrides }, 'PATCH'));
