async function parseJsonResponse(res, fallbackMessage) {
  const raw = await res.text();
  let body = {};
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    body = {};
  }
  if (!res.ok) {
    throw new Error(body.error || raw || fallbackMessage);
  }
  return body;
}

export async function fetchAuthSession() {
  const res = await fetch('/api/auth/session', { credentials: 'include' });
  return parseJsonResponse(res, 'Failed to check sign-in status');
}

export async function login(password) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ password })
  });
  return parseJsonResponse(res, 'Sign in failed');
}

export async function logout() {
  const res = await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'include'
  });
  return parseJsonResponse(res, 'Sign out failed');
}
