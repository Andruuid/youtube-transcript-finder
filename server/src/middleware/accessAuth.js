const COOKIE_NAME = 'ytf_access';
const COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 30;

export function getAccessPassword() {
  return String(process.env.ACCESS_PASSWORD || '').trim();
}

export function isAccessRequired() {
  return getAccessPassword().length > 0;
}

function readCookie(req, name) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq);
    const value = trimmed.slice(eq + 1);
    if (key === name) return decodeURIComponent(value);
  }
  return '';
}

export function readAccessCredential(req) {
  const bearer = req.headers.authorization || '';
  if (bearer.startsWith('Bearer ')) {
    return bearer.slice(7).trim();
  }
  return readCookie(req, COOKIE_NAME);
}

export function isAuthenticated(req) {
  const expected = getAccessPassword();
  if (!expected) return true;
  return readAccessCredential(req) === expected;
}

export function isSecureRequest(req) {
  return req.secure === true || req.headers['x-forwarded-proto'] === 'https';
}

export function setAccessCookie(res, req, password) {
  const bits = [
    `${COOKIE_NAME}=${encodeURIComponent(password)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${COOKIE_MAX_AGE_SEC}`
  ];
  if (isSecureRequest(req)) bits.push('Secure');
  res.setHeader('Set-Cookie', bits.join('; '));
}

export function clearAccessCookie(res, req) {
  const bits = [`${COOKIE_NAME}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
  if (isSecureRequest(req)) bits.push('Secure');
  res.setHeader('Set-Cookie', bits.join('; '));
}

export function createAccessAuthMiddleware() {
  return (req, res, next) => {
    if (!isAccessRequired()) return next();
    if (isAuthenticated(req)) return next();
    return res.status(401).json({ error: 'Unauthorized' });
  };
}
