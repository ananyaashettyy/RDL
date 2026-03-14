const STORAGE_KEY = 'attendance_rules_v1';

export const DEFAULT_ATTENDANCE_RULES = {
  lateAfter: '09:00',
  earlyBefore: '17:00',
};

const clampTimePart = (value, min, max) => {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
};

const normalizeTime = (value, fallback) => {
  const raw = String(value || '').trim();
  const match = raw.match(/^(\d{1,2}):(\d{1,2})$/);
  if (!match) return fallback;
  const h = clampTimePart(Number(match[1]), 0, 23);
  const m = clampTimePart(Number(match[2]), 0, 59);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

export const parseTimeToMinutes = (timeValue) => {
  const raw = String(timeValue || '').trim();
  if (!raw || raw === '--') return null;
  const match = raw.match(/^(\d{1,2}):(\d{1,2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return (hours * 60) + minutes;
};

export const getAttendanceRuleConfig = () => {
  if (typeof window === 'undefined') return { ...DEFAULT_ATTENDANCE_RULES };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_ATTENDANCE_RULES };
    const parsed = JSON.parse(raw);
    return {
      lateAfter: normalizeTime(parsed?.lateAfter, DEFAULT_ATTENDANCE_RULES.lateAfter),
      earlyBefore: normalizeTime(parsed?.earlyBefore, DEFAULT_ATTENDANCE_RULES.earlyBefore),
    };
  } catch {
    return { ...DEFAULT_ATTENDANCE_RULES };
  }
};

export const saveAttendanceRuleConfig = (rules = {}) => {
  const next = {
    lateAfter: normalizeTime(rules.lateAfter, DEFAULT_ATTENDANCE_RULES.lateAfter),
    earlyBefore: normalizeTime(rules.earlyBefore, DEFAULT_ATTENDANCE_RULES.earlyBefore),
  };
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  return next;
};

export const evaluateLateEarly = (record, rules = DEFAULT_ATTENDANCE_RULES) => {
  if (!record || record.status !== 'present') {
    return { isLateEntry: false, isEarlyExit: false };
  }

  const inMinutes = parseTimeToMinutes(record.inTime);
  const outMinutes = parseTimeToMinutes(record.logout || record.outTime);
  const lateAfterMinutes = parseTimeToMinutes(rules.lateAfter);
  const earlyBeforeMinutes = parseTimeToMinutes(rules.earlyBefore);

  const isLateEntry = inMinutes !== null
    && lateAfterMinutes !== null
    && inMinutes > lateAfterMinutes;

  const isEarlyExit = outMinutes !== null
    && earlyBeforeMinutes !== null
    && outMinutes < earlyBeforeMinutes;

  return { isLateEntry, isEarlyExit };
};

