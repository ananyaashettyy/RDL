const STORAGE_KEY = 'attendance_leaves_v1';
const LEAVE_EVENT = 'attendance_leaves_updated';
const NOTIF_STORAGE_KEY = 'attendance_leave_notifications_v1';
const NOTIF_EVENT = 'attendance_leave_notifications_updated';

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
    window.dispatchEvent(new CustomEvent(LEAVE_EVENT));
  } catch {
    // Ignore storage write failures to avoid blocking UI actions.
  }
}

function readNotifications() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(NOTIF_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeNotification(n) {
  const seen = !!n.seen;
  return {
    ...n,
    status: n.status || 'pending',
    seenByAdmin: typeof n.seenByAdmin === 'boolean' ? n.seenByAdmin : seen,
    seenByUser: typeof n.seenByUser === 'boolean' ? n.seenByUser : seen,
    hiddenByAdmin: !!n.hiddenByAdmin,
    hiddenByUser: !!n.hiddenByUser,
  };
}

function writeNotifications(notifications) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(notifications));
    window.dispatchEvent(new CustomEvent(NOTIF_EVENT));
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

export function addLeaveNotification(payload) {
  const notifications = readNotifications();
  notifications.push({
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    ...payload,
    status: 'pending',
    seenByAdmin: false,
    seenByUser: true,
  });
  writeNotifications(notifications);
}

export function getLeaveNotifications() {
  return readNotifications()
    .map(normalizeNotification)
    .sort((a, b) => (b.appliedAt || '').localeCompare(a.appliedAt || ''));
}

export function markAllLeaveNotificationsSeen(viewer, username = '') {
  const notifications = getLeaveNotifications();
  const updated = notifications.map((n) => {
    if (viewer === 'ADMIN') {
      return { ...n, seenByAdmin: true };
    }
    if (viewer === 'USER' && n.username === username) {
      return { ...n, seenByUser: true };
    }
    return n;
  });
  writeNotifications(updated);
}

export function resolveLeaveNotification(id, decision, decidedBy = 'admin') {
  if (decision !== 'accepted' && decision !== 'declined') return;
  const notifications = getLeaveNotifications();
  const leaveTypeMap = {
    'Paid Leave': 'paid',
    'Earned Leave': 'earned',
    'Training/Other Work Leave': 'training',
  };
  const updated = notifications.map((n) => {
    if (n.id !== id) return n;
    const leaveCode = leaveTypeMap[n.leaveType];
    if (n.employeeId && n.date) {
      if (decision === 'accepted' && leaveCode) {
        setLeaveForDate(n.employeeId, n.date, leaveCode);
      }
      if (decision === 'declined') {
        setLeaveForDate(n.employeeId, n.date, null);
      }
    }
    return {
      ...n,
      status: decision,
      decidedBy,
      decidedAt: new Date().toISOString(),
      seenByAdmin: true,
      seenByUser: false,
    };
  });
  writeNotifications(updated);
}

export function hideLeaveNotification(id, viewer, username = '') {
  const notifications = getLeaveNotifications();
  const updated = notifications.map((n) => {
    if (n.id !== id) return n;
    if (viewer === 'ADMIN') return { ...n, hiddenByAdmin: true };
    if (viewer === 'USER' && n.username === username) return { ...n, hiddenByUser: true };
    return n;
  });
  writeNotifications(updated);
}

export function subscribeLeaves(listener) {
  if (typeof window === 'undefined') return () => {};
  const handleStorage = (e) => {
    if (e.key === STORAGE_KEY) listener();
  };
  const handleCustom = () => listener();
  window.addEventListener('storage', handleStorage);
  window.addEventListener(LEAVE_EVENT, handleCustom);
  return () => {
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener(LEAVE_EVENT, handleCustom);
  };
}

export function subscribeLeaveNotifications(listener) {
  if (typeof window === 'undefined') return () => {};
  const handleStorage = (e) => {
    if (e.key === NOTIF_STORAGE_KEY) listener();
  };
  const handleCustom = () => listener();
  window.addEventListener('storage', handleStorage);
  window.addEventListener(NOTIF_EVENT, handleCustom);
  return () => {
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener(NOTIF_EVENT, handleCustom);
  };
}
