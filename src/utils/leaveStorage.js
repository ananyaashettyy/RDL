const STORAGE_KEY = 'attendance_leaves_v1';

function readStore() {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore(store) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Ignore storage write failures to avoid blocking UI actions.
  }
}

function keyFor(employeeId, dateStr) {
  return `${employeeId}:${dateStr}`;
}

export function getLeavesForEmployeeMonth(employeeId, monthKey) {
  const store = readStore();
  const out = {};
  const prefix = `${employeeId}:${monthKey}-`;
  Object.entries(store).forEach(([k, v]) => {
    if (k.startsWith(prefix) && typeof v === 'string') {
      out[k.split(':')[1]] = v;
    }
  });
  return out;
}

export function setLeaveForDate(employeeId, dateStr, leaveType) {
  const store = readStore();
  const key = keyFor(employeeId, dateStr);
  if (leaveType) store[key] = leaveType;
  else delete store[key];
  writeStore(store);
}
