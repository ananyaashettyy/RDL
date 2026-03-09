const STORAGE_KEY = 'admin_users_v1';

const DEFAULT_ADMINS = [
  { username: 'admin', password: 'admin' },
];

function normalizeUsers(users) {
  if (!Array.isArray(users)) return [];
  const seen = new Set();
  const out = [];
  users.forEach((u) => {
    const username = String(u?.username || '').trim();
    const password = String(u?.password || '').trim();
    if (!username || !password) return;
    const key = username.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ username, password });
  });
  return out;
}

function readRaw() {
  if (typeof window === 'undefined') return DEFAULT_ADMINS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_ADMINS;
    const parsed = JSON.parse(raw);
    const users = normalizeUsers(parsed);
    return users.length ? users : DEFAULT_ADMINS;
  } catch {
    return DEFAULT_ADMINS;
  }
}

function writeRaw(users) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
}

function getUsersAndEnsureDefault() {
  let users = normalizeUsers(readRaw());
  if (!users.length) users = [...DEFAULT_ADMINS];
  writeRaw(users);
  return users;
}

export function getAdminUsers() {
  return getUsersAndEnsureDefault();
}

export function getAdminUsernames() {
  return getUsersAndEnsureDefault().map((u) => u.username);
}

export function validateAdminCredentials(username, password) {
  const u = String(username || '').trim();
  const p = String(password || '').trim();
  return getUsersAndEnsureDefault().some((item) => item.username.toLowerCase() === u.toLowerCase() && item.password === p);
}

export function addAdminUser(username, password) {
  const u = String(username || '').trim();
  const p = String(password || '').trim();
  if (!u || !p) return { ok: false, error: 'Username and password are required.' };

  const users = getUsersAndEnsureDefault();
  if (users.some((item) => item.username.toLowerCase() === u.toLowerCase())) {
    return { ok: false, error: 'Admin username already exists.' };
  }

  const next = [...users, { username: u, password: p }];
  writeRaw(next);
  return { ok: true };
}

export function updateAdminPassword(username, newPassword) {
  const u = String(username || '').trim();
  const p = String(newPassword || '').trim();
  if (!u || !p) return { ok: false, error: 'Admin and new password are required.' };

  const users = getUsersAndEnsureDefault();
  const idx = users.findIndex((item) => item.username === u);
  if (idx === -1) return { ok: false, error: 'Selected admin not found.' };

  const next = [...users];
  next[idx] = { ...next[idx], password: p };
  writeRaw(next);
  return { ok: true };
}

export function deleteAdminUser(username) {
  const u = String(username || '').trim();
  if (!u) return { ok: false, error: 'Select an admin to delete.' };

  const users = getUsersAndEnsureDefault();
  const next = users.filter((item) => item.username !== u);
  writeRaw(next.length ? next : DEFAULT_ADMINS);
  return { ok: true };
}
