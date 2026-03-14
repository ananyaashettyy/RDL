const STORAGE_KEY = 'employee_credentials_v1';

function normalizeUsers(users) {
  if (!Array.isArray(users)) return [];
  const seen = new Set();
  const out = [];
  users.forEach((u) => {
    const employeeId = String(u?.employeeId ?? u?.id ?? '').trim();
    const name = String(u?.name || '').trim();
    const username = String(u?.username || '').trim();
    const password = String(u?.password || '').trim();
    if (!employeeId || !username || !password) return;
    if (seen.has(employeeId)) return;
    seen.add(employeeId);
    out.push({ employeeId, name, username, password });
  });
  return out;
}

function readRaw() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return normalizeUsers(JSON.parse(raw));
  } catch {
    return [];
  }
}

function writeRaw(users) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
}

export function getEmployeeCreds() {
  const users = normalizeUsers(readRaw());
  writeRaw(users);
  return users;
}

export function upsertEmployeeCred({ employeeId, name, username, password }) {
  const id = String(employeeId || '').trim();
  const u = String(username || '').trim();
  const p = String(password || '').trim();
  const n = String(name || '').trim();
  if (!id || !u || !p) return { ok: false, error: 'Employee id, username and password are required.' };

  const users = getEmployeeCreds();
  const idx = users.findIndex((item) => item.employeeId === id);
  const entry = { employeeId: id, name: n, username: u, password: p };
  const next = [...users];
  if (idx === -1) next.push(entry);
  else next[idx] = entry;
  writeRaw(next);
  return { ok: true };
}

export function updateEmployeeCred(employeeId, username, password) {
  const id = String(employeeId || '').trim();
  const u = String(username || '').trim();
  const p = String(password || '').trim();
  if (!id || !u || !p) return { ok: false, error: 'Employee id, username and password are required.' };

  const users = getEmployeeCreds();
  const idx = users.findIndex((item) => item.employeeId === id);
  if (idx === -1) return { ok: false, error: 'Employee credentials not found.' };
  const next = [...users];
  next[idx] = { ...next[idx], username: u, password: p };
  writeRaw(next);
  return { ok: true };
}

export function deleteEmployeeCred(employeeId) {
  const id = String(employeeId || '').trim();
  if (!id) return { ok: false, error: 'Employee id is required.' };
  const users = getEmployeeCreds();
  const next = users.filter((item) => item.employeeId !== id);
  writeRaw(next);
  return { ok: true };
}

