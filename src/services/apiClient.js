/** Shared fetch for same-origin API routes; sends session cookie set at login. */
export async function apiFetch(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    credentials: 'include'
  });

  if (res.status === 401) {
    window.dispatchEvent(new Event('ytf-unauthorized'));
  }

  return res;
}
