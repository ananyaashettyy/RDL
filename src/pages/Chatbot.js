import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { DEPARTMENTS, EMPLOYEES, NATIONAL_HOLIDAYS } from '../data/attlogData';
import { getLeavesForEmployeeMonth } from '../utils/leaveStorage';
import { evaluateLateEarly, getAttendanceRuleConfig, parseTimeToMinutes } from '../utils/attendanceRules';

const MONTHS = { jan: 1, january: 1, feb: 2, february: 2, februrary: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, novemeber: 11, dec: 12, december: 12, dev: 12, decemeber: 12, decmber: 12 };
const pad = (n) => String(n).padStart(2, '0');
const mk = (y, m) => `${y}-${pad(m)}`;
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
const fmtDur = (mins) => `${String(Math.floor((mins || 0) / 60)).padStart(2, '0')}:${String((mins || 0) % 60).padStart(2, '0')}:00`;
const fmtHours = (mins) => `${((mins || 0) / 60).toFixed(2)} hrs`;
const names = (arr) => !arr.length ? 'none' : (arr.length <= 12 ? arr.map((x) => x.name).join(', ') : `${arr.slice(0, 12).map((x) => x.name).join(', ')} and ${arr.length - 12} more`);
const welcome = { role: 'bot', text: 'Hi, I am AttendIQ AI Assistant. Ask me anything about attendance, reports, or general questions.' };

const RESPONSE_LEADS = [
  'According to the system records,',
  'Based on the current attendance data,',
  'Here is the information you requested:',
  'Here is the latest attendance summary:',
  'Let me check that for you.',
];
const FOLLOW_UP_KEYS = ['late', 'early', 'attendance', 'present', 'absent', 'overtime', 'working hours', 'leave'];
const hasExplicitMonthInQuery = (q) => (
  q.includes('last month')
  || /\b20\d{2}[-/]\d{1,2}\b/.test(q)
  || Object.keys(MONTHS).some((k) => q.includes(` ${k} `) || q.startsWith(`${k} `) || q.endsWith(` ${k}`))
  || q.split(/\s+/).some((w) => getMonthFromWord(w))
);
const hasDateHint = (q) => (
  /\b\d{1,2}[-/]\d{1,2}[-/]\d{4}\b/.test(q)
  || /\b20\d{2}[-/]\d{1,2}[-/]\d{1,2}\b/.test(q)
  || /\b\d{1,2}\s+[a-z]{3,12}\b/.test(q)
  || /\b[a-z]{3,12}\s+\d{1,2}\b/.test(q)
);

const isGreeting = (q) => ['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening'].some((k) => q === k || q.includes(k));
const isNameQuestion = (q) => q.includes('your name') || q.includes('who are you') || q.includes('what are you');
const wantsMostAbsent = (q) => (
  q.includes('most absent')
  || q.includes('more absent')
  || q.includes('highest absent')
  || q.includes('maximum absent')
  || (q.includes('absent') && (q.includes('most') || q.includes('highest') || q.includes('maximum')) && (q.includes('who') || q.includes('employee')))
);
const wantsMostPresent = (q) => (
  q.includes('most present')
  || q.includes('highest present')
  || q.includes('maximum present')
  || (q.includes('present') && (q.includes('most') || q.includes('highest') || q.includes('maximum')) && (q.includes('who') || q.includes('employee')))
);
const wantsAllMonths = (q) => q.includes('all months') || q.includes('overall') || q.includes('entire period') || q.includes('all data');

const EMPLOYEE_HINTS = ['attendance for', 'details of', 'details for', 'profile for', 'find employee', 'show attendance of', 'show details of', 'show profile for', 'employee'];
const MISSING_INFO_PHRASES = ['show attendance', 'show employee details', 'show report', 'show late employees', 'show work hours'];
const AMBIGUOUS_PHRASES = ['show last attendance', 'show recent employee activity', 'show previous records', 'show last report', 'show earlier data'];
const UNSUPPORTED_FEATURE_PHRASES = ['send attendance emails automatically', 'approve leave requests', 'edit employee salary', 'change admin password', 'access external hr systems'];

const hasUnsupportedLanguage = (raw) => /[\u0900-\u097F\u0980-\u09FF\u0A00-\u0A7F\u0A80-\u0AFF\u0B80-\u0BFF\u0C80-\u0CFF\u0D00-\u0D7F]/.test(String(raw || ''));
const looksRandomInput = (q) => !q || q.length < 2 || /^[^a-z]+$/.test(q) || /^[a-z]{8,}$/.test(q);

const DOMAIN_KEYWORDS = [
  'attendance', 'absent', 'present', 'late', 'early', 'leave', 'overtime', 'work hours', 'workhour', 'department',
  'employee', 'report', 'dashboard', 'team', 'masters', 'admin', 'holiday', 'weekend', 'login', 'logout', 'punch',
  'portal', 'shift', 'rule', 'threshold',
];

const extractMathExpression = (q) => {
  const m = q.match(/(?:calculate|compute|solve|what is)\s+([0-9+\-*/().%\s]+)/);
  if (m?.[1]) return m[1];
  if (/^[0-9+\-*/().%\s]+$/.test(q)) return q;
  return null;
};

const safeEvalMath = (expr) => {
  const cleaned = String(expr || '').replace(/\s+/g, '');
  if (!cleaned) return null;
  if (/[^0-9+\-*/().%]/.test(cleaned)) return null;
  if (/^[+\-*/%]/.test(cleaned) || /[+\-*/%]$/.test(cleaned)) return null;
  try {
    const val = Function(`"use strict"; return (${cleaned});`)();
    return Number.isFinite(val) ? val : null;
  } catch (e) {
    return null;
  }
};

const getGeneralReply = (q) => {
  if (!q) return null;
  if (q === 'help' || q.includes('what can you do') || q.includes('your capabilities')) {
    return 'I can help with attendance analytics, system usage, reports/exports, leave rules, and general questions like time/date or quick calculations.';
  }
  if (q.includes('what is attendiq') || q.includes('about attendiq') || q.includes('what is this system')) {
    return 'AttendIQ is an attendance management system that tracks employee attendance, work hours, late/early entries, and generates reports.';
  }
  const wantsTime = (q.includes('time') && (q.includes('now') || q.includes('current') || q.includes('what time') || q === 'time'));
  const wantsDate = (q.includes('date') && (q.includes('today') || q.includes('current') || q.includes('now') || q === 'date'));
  const wantsDay = (q.includes('day') && (q.includes('today') || q.includes('current') || q.includes('now')));
  if (wantsTime || wantsDate || wantsDay) {
    const now = new Date();
    const out = now.toLocaleString();
    return `Current date and time: ${out}.`;
  }
  const expr = extractMathExpression(q);
  if (expr) {
    const val = safeEvalMath(expr);
    if (val !== null) return `Calculation result for ${expr.trim()}: ${Number(val.toFixed(6))}`;
  }
  return null;
};

const formatReplyText = (text) => {
  const raw = String(text || '').trim();
  if (!raw) return raw;
  return raw;
};

const parseDateStrict = (dateObj) => {
  if (!dateObj) return { valid: true, reason: null };
  const { y, m, d } = dateObj;
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return { valid: false, reason: 'invalid' };
  if (m < 1 || m > 12 || d < 1 || d > 31) return { valid: false, reason: 'invalid' };
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== (m - 1) || dt.getDate() !== d) return { valid: false, reason: 'invalid' };
  return { valid: true, reason: null };
};

const isFutureDate = (dateObj) => {
  if (!dateObj) return false;
  const dt = new Date(dateObj.y, dateObj.m - 1, dateObj.d);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return dt > now;
};

const extractNameCandidate = (q) => {
  const m = q.match(/(?:attendance for|attendance of|details of|details for|profile for|find employee|find|search employee|employee)\s+([a-z\s.]+)/);
  if (!m) return '';
  return String(m[1] || '').trim();
};

const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(String(text ?? ''));
    return true;
  } catch (e) {
    try {
      const el = document.createElement('textarea');
      el.value = String(text ?? '');
      el.setAttribute('readonly', 'true');
      el.style.position = 'fixed';
      el.style.left = '-9999px';
      document.body.appendChild(el);
      el.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(el);
      return ok;
    } catch (e2) {
      return false;
    }
  }
};

const IconCopy = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M8 8V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-2" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <path d="M6 8h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2Z" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const IconCheck = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M20 6L9 17l-5-5" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconEdit = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M12 20h9" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5Z" stroke={color} strokeWidth="2" strokeLinejoin="round" />
  </svg>
);

const levenshtein = (a, b) => {
  const aa = String(a || '');
  const bb = String(b || '');
  const dp = Array.from({ length: aa.length + 1 }, () => new Array(bb.length + 1).fill(0));
  for (let i = 0; i <= aa.length; i += 1) dp[i][0] = i;
  for (let j = 0; j <= bb.length; j += 1) dp[0][j] = j;
  for (let i = 1; i <= aa.length; i += 1) {
    for (let j = 1; j <= bb.length; j += 1) {
      const cost = aa[i - 1] === bb[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[aa.length][bb.length];
};

const similarity = (a, b) => {
  const aa = norm(a);
  const bb = norm(b);
  if (!aa || !bb) return 0;
  const dist = levenshtein(aa, bb);
  return 1 - (dist / Math.max(aa.length, bb.length, 1));
};

const CANONICAL_MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

const getMonthFromWord = (word) => {
  const w = norm(word);
  if (!w) return null;
  if (MONTHS[w]) return MONTHS[w];
  const scored = CANONICAL_MONTHS.map((m) => ({ m, score: similarity(w, m) })).sort((a, b) => b.score - a.score);
  if (scored[0]?.score >= 0.72) return MONTHS[scored[0].m];
  return null;
};

const formatMonthLabel = (monthKey) => {
  if (!monthKey) return '';
  const [y, m] = String(monthKey).split('-').map(Number);
  if (!y || !m) return String(monthKey);
  const name = CANONICAL_MONTHS[m - 1];
  if (!name) return String(monthKey);
  return `${name[0].toUpperCase()}${name.slice(1)} ${y}`;
};

const findEmployeeCandidates = (q) => {
  const query = norm(q);
  const exact = EMPLOYEES.filter((e) => query.includes(norm(e.displayName)));
  if (exact.length) {
    if (exact.length > 1) return { type: 'exact', matches: exact };
    const exactFirst = norm(exact[0].displayName).split(' ')[0];
    const firstNameMatches = EMPLOYEES.filter((e) => norm(e.displayName).split(' ')[0] === exactFirst);
    if (firstNameMatches.length > 1) return { type: 'partial', matches: firstNameMatches.slice(0, 8) };
    return { type: 'exact', matches: exact };
  }

  const candidate = extractNameCandidate(query);
  if (!candidate) {
    const tokens = query.split(' ').filter((t) => t.length >= 3);
    const firstNameMatches = EMPLOYEES.filter((e) => {
      const parts = norm(e.displayName).split(' ');
      return tokens.some((t) => parts.some((p) => p === t || p.startsWith(t)));
    });
    if (firstNameMatches.length) return { type: 'partial', matches: firstNameMatches.slice(0, 8) };
    return { type: 'none', matches: [] };
  }

  const cTokens = candidate.split(' ').filter((t) => t.length >= 3);
  const partial = EMPLOYEES.filter((e) => {
    const n = norm(e.displayName);
    return cTokens.some((t) => n.includes(t) || n.split(' ').some((p) => p.startsWith(t)));
  });
  if (partial.length) return { type: 'partial', matches: partial.slice(0, 8) };

  const scored = EMPLOYEES
    .map((e) => ({ e, score: similarity(candidate, e.displayName) }))
    .sort((a, b) => b.score - a.score);
  if (scored[0]?.score >= 0.58) {
    return { type: 'fuzzy', matches: scored.filter((x) => x.score >= scored[0].score - 0.05).slice(0, 5).map((x) => x.e) };
  }
  return { type: 'none', matches: [] };
};

const findEmployeeFromQuery = (q) => {
  const query = norm(q);
  const exact = EMPLOYEES.find((e) => query.includes(norm(e.displayName)));
  if (exact) return exact;

  const tokens = query.split(' ').filter((t) => t.length >= 3);
  const firstNameMatches = EMPLOYEES.filter((e) => {
    const parts = norm(e.displayName).split(' ');
    return tokens.some((t) => parts[0] && (parts[0] === t || parts[0].startsWith(t)));
  });
  if (firstNameMatches.length === 1) return firstNameMatches[0];
  if (firstNameMatches.length > 1) return null;

  const fuzzy = findEmployeeCandidates(query);
  if (fuzzy.matches?.length === 1) return fuzzy.matches[0];
  return null;
};

const REFUSAL_RULES = [
  {
    intent: 'personal_data_request',
    keys: ['phone number', 'address', 'salary', 'bank account', 'aadhaar', 'aadhar', 'pan number', 'personal email', 'private information', 'married', 'family information', 'where do employees live', 'age of employees', 'personal photos', 'social media', 'religion', 'caste'],
    responses: [
      'I’m sorry, but I can’t share personal details such as phone numbers, addresses, or financial information. Employee personal data is protected to maintain privacy and security.',
      'That information is considered private employee data. For privacy and data protection reasons, I’m unable to provide it.',
    ],
  },
  {
    intent: 'security_request',
    keys: ['password', 'login credentials', 'security key', 'bypass login', 'break authentication', 'admin access without login', 'restricted admin data'],
    responses: [
      'I can’t help with accessing passwords, login credentials, or security keys. Protecting system security is important, so this information is restricted.',
      'For security reasons, authentication details and system access credentials cannot be shared.',
    ],
  },
  {
    intent: 'confidential_hr_request',
    keys: ['hr records', 'hr investigation', 'disciplinary records', 'performance review', 'salary increments', 'hr complaint', 'promotion decisions', 'appraisal data'],
    responses: [
      'That information is part of confidential HR records. I’m unable to access or share sensitive HR-related information.',
      'HR decisions and employee evaluations are confidential, so I’m not able to provide those details.',
    ],
  },
  {
    intent: 'attendance_manipulation_request',
    keys: ['change my attendance', 'delete my absence', 'modify attendance secretly', 'remove late entry', 'edit attendance without admin', 'fake attendance', 'mark employees present automatically', 'delete attendance logs', 'alter attendance'],
    responses: [
      'Attendance records cannot be altered or manipulated through the chatbot. Please follow the official administrative process if corrections are required.',
      'Modifying attendance data requires authorized administrative action. I’m unable to make those changes.',
    ],
  },
  {
    intent: 'hacking_or_illegal_request',
    keys: ['hack', 'steal', 'hidden database', 'backend database', 'break into the system', 'bypass security', 'restricted system files', 'confidential logs', 'system vulnerabilities', 'forg', 'spy on employees', 'remove audit logs', 'download confidential files'],
    responses: [
      'I can’t assist with hacking, bypassing security, or accessing restricted systems. Please follow authorized system procedures.',
      'Requests involving unauthorized access or system exploitation are not permitted.',
    ],
  },
  {
    intent: 'harassment_request',
    keys: ['worst worker', 'should be fired', 'gossip', 'lazy', 'useless employee', 'insult', 'bad things about employees', 'weakest worker', 'problem in the company', 'negative comments'],
    responses: [
      'I can’t generate negative or harmful statements about employees. The system is designed to promote a respectful workplace.',
      'Providing harmful or insulting information about employees goes against workplace policies.',
    ],
  },
  {
    intent: 'identity_sensitive_request',
    keys: ['id proof', 'passport details', 'biometric data', 'fingerprints', 'facial recognition', 'medical records', 'health details', 'insurance records', 'background checks', 'identity documents'],
    responses: [
      'Sensitive identity information such as ID documents or biometric data cannot be accessed through this chatbot.',
      'Identity verification documents and biometric records are strictly protected.',
    ],
  },
  {
    intent: 'system_abuse_request',
    keys: ['spam employees', 'send fake alerts', 'delete attendance records permanently', 'block employee access', 'shut down the system', 'disable security features', 'remove system logs', 'crash the attendance system', 'disable employee accounts', 'corrupt system data'],
    responses: [
      'I can’t perform actions that could harm or misuse the system. Please use the system responsibly according to company policies.',
      'Requests that could disrupt system functionality cannot be processed.',
    ],
  },
  {
    intent: 'fake_authority_request',
    keys: ['i am the ceo', 'i am hr', 'i am admin', 'give me restricted data', 'ignore security rules', 'show hidden employee records', 'give me secret reports', 'show system secrets'],
    responses: [
      'Access to restricted information requires proper authentication and verification. I’m unable to provide that data without authorized access.',
      'Even if someone claims authority, access to sensitive data must follow official authentication procedures.',
    ],
  },
  {
    intent: 'privacy_violation_request',
    keys: ['private employee messages', 'employee chat logs', 'employee email content', 'employee browsing history', 'employee personal files', 'personal conversations', 'hr private emails', 'confidential employee communications'],
    responses: [
      'Private communications such as emails, messages, or personal files cannot be accessed through this system.',
      'Employee communication records are confidential and protected.',
    ],
  },
  {
    intent: 'financial_confidential_request',
    keys: ['payroll details', 'salary breakdown', 'bonus details', 'tax records', 'financial transactions', 'bank transfers', 'company profit data', 'financial statements', 'payroll database'],
    responses: [
      'Financial information such as payroll, salary details, and transactions is confidential and cannot be shared here.',
      'Access to financial records is restricted to authorized financial systems.',
    ],
  },
  {
    intent: 'business_confidential_request',
    keys: ['competitor data', 'partner information', 'vendor contract', 'company strategy', 'business plans', 'private company documents', 'project secrets', 'confidential contracts', 'trade secrets', 'internal business discussions'],
    responses: [
      'Confidential business information, contracts, or strategic documents are not accessible through this chatbot.',
      'Company business data and strategic information are protected and cannot be disclosed.',
    ],
  },
  {
    intent: 'ai_misuse_request',
    keys: ['generate fake attendance', 'create fake reports', 'manipulate analytics results', 'hide employee absence', 'modify attendance data secretly', 'remove overtime logs', 'change attendance percentages', 'fabricate attendance history', 'falsify reports'],
    responses: [
      'I can’t generate or modify data in a way that would create false or misleading records.',
      'The system is designed to maintain accurate records, so generating fake data is not permitted.',
    ],
  },
  {
    intent: 'system_limit_request',
    keys: ['control employee computers', 'track employees outside office', 'read employee thoughts', 'access private phones', 'record employee conversations', 'monitor employees at home', 'access personal devices', 'track employees location secretly', 'watch employees through cameras'],
    responses: [
      'The attendance system does not have the capability to access personal devices, monitor employees outside work, or perform surveillance.',
      'Those capabilities are beyond the functionality of this system.',
    ],
  },
];

const pickRefusalResponse = (q, responses) => {
  const score = q.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return responses[score % responses.length];
};

const getRefusalText = (q) => {
  for (let i = 0; i < REFUSAL_RULES.length; i += 1) {
    const r = REFUSAL_RULES[i];
    if (r.keys.some((k) => q.includes(k))) return pickRefusalResponse(q, r.responses);
  }
  return null;
};

const parseMonth = (q, selectedMonth, allMonths) => {
  const [sy, sm] = selectedMonth.split('-').map(Number);
  if (q.includes('last month')) {
    const d = new Date(sy, sm - 2, 1);
    return mk(d.getFullYear(), d.getMonth() + 1);
  }
  const ym = q.match(/\b(20\d{2})[-/](\d{1,2})\b/);
  if (ym) return mk(Number(ym[1]), Number(ym[2]));
  const words = q.split(/\s+/);
  const mword = words.find((w) => getMonthFromWord(w));
  if (mword) {
    const m = getMonthFromWord(mword);
    const y = words.find((w) => /^20\d{2}$/.test(w));
    if (y) return mk(Number(y), m);
    const sameYear = mk(sy, m);
    return allMonths.includes(sameYear) ? sameYear : (allMonths.find((k) => Number(k.split('-')[1]) === m) || selectedMonth);
  }
  return selectedMonth;
};

const parseDate = (q, fallbackMonth) => {
  const [fy, fm] = fallbackMonth.split('-').map(Number);
  const ymd = q.match(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/);
  if (ymd) return { y: Number(ymd[1]), m: Number(ymd[2]), d: Number(ymd[3]) };
  const dmy = q.match(/\b(\d{1,2})[-/](\d{1,2})[-/](20\d{2})\b/);
  if (dmy) return { y: Number(dmy[3]), m: Number(dmy[2]), d: Number(dmy[1]) };
  const mdy = q.match(/\b([a-z]{3,12})\s+(\d{1,2})(?:\s+(20\d{2}))?\b/);
  if (mdy && getMonthFromWord(mdy[1])) return { y: mdy[3] ? Number(mdy[3]) : fy, m: getMonthFromWord(mdy[1]), d: Number(mdy[2]) };
  const dmyw = q.match(/\b(\d{1,2})\s+([a-z]{3,12})(?:\s+(20\d{2}))?\b/);
  if (dmyw && getMonthFromWord(dmyw[2])) return { y: dmyw[3] ? Number(dmyw[3]) : fy, m: getMonthFromWord(dmyw[2]), d: Number(dmyw[1]) };
  const ymdw = q.match(/\b(20\d{2})\s+([a-z]{3,12})\s+(\d{1,2})\b/);
  if (ymdw && getMonthFromWord(ymdw[2])) return { y: Number(ymdw[1]), m: getMonthFromWord(ymdw[2]), d: Number(ymdw[3]) };
  return null;
};

export default function Chatbot({ selectedMonth }) {
  const [messages, setMessages] = useState([welcome]);
  const [input, setInput] = useState('');
  const [chatContext, setChatContext] = useState({ employeeId: null, monthKey: selectedMonth, dateKey: null });
  const [pendingChoice, setPendingChoice] = useState(null);
  const [activeMessageIdx, setActiveMessageIdx] = useState(null);
  const [editingMessageIdx, setEditingMessageIdx] = useState(null);
  const [copiedMessageIdx, setCopiedMessageIdx] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    setChatContext((prev) => ({ ...prev, monthKey: selectedMonth }));
  }, [selectedMonth]);

  const index = useMemo(() => {
    const rules = getAttendanceRuleConfig();
    const allMonths = [...new Set(EMPLOYEES.flatMap((e) => Object.keys(e.attendance || {})))].sort();
    const monthMap = new Map();
    const datePeople = new Map();

    const ensureMonth = (monthKey) => {
      if (monthMap.has(monthKey)) return monthMap.get(monthKey);
      const perEmp = [];
      const perDept = new Map();
      const daily = new Map();
      let present = 0; let absent = 0; let late = 0; let early = 0; let overtime = 0;
      EMPLOYEES.forEach((emp) => {
        const recs = emp.attendance[monthKey] || [];
        let ep = 0; let ea = 0; let el = 0; let ee = 0; let eot = 0; let ework = 0;
        recs.forEach((r) => {
          const dateKey = `${monthKey}-${pad(r.day)}`;
          if (!daily.has(dateKey)) daily.set(dateKey, { present: 0, absent: 0, weekend: 0, late: 0, early: 0, overtimeMins: 0, workMins: 0 });
          if (!datePeople.has(dateKey)) datePeople.set(dateKey, []);
          const day = daily.get(dateKey);
          const outMins = parseTimeToMinutes(r.logout || r.outTime);
          const earlyBefore = parseTimeToMinutes(rules.earlyBefore) ?? (17 * 60);
          const ot = outMins !== null && outMins > earlyBefore ? outMins - earlyBefore : 0;
          const wm = parseTimeToMinutes(r.work) || 0;
          const { isLateEntry, isEarlyExit } = evaluateLateEarly(r, rules);
          datePeople.get(dateKey).push({ id: emp.id, name: emp.displayName, dept: emp.dept, status: r.status, isLateEntry, isEarlyExit, workMins: wm, overtimeMins: ot });
          if (r.status === 'present') { ep += 1; present += 1; day.present += 1; if (isLateEntry) { el += 1; late += 1; day.late += 1; } if (isEarlyExit) { ee += 1; early += 1; day.early += 1; } eot += ot; overtime += ot; ework += wm; day.overtimeMins += ot; day.workMins += wm; }
          else if (r.status === 'absent') { ea += 1; absent += 1; day.absent += 1; }
          else if (r.status === 'weekend') day.weekend += 1;
        });
        const work = ep + ea;
        const row = { id: emp.id, name: emp.displayName, dept: emp.dept, present: ep, absent: ea, late: el, early: ee, overtimeMins: eot, workMins: ework, attendancePct: work ? (ep / work) * 100 : 0 };
        perEmp.push(row);
        if (!perDept.has(emp.dept)) perDept.set(emp.dept, { dept: emp.dept, present: 0, absent: 0, late: 0, early: 0, overtimeMins: 0, workMins: 0 });
        const d = perDept.get(emp.dept);
        d.present += ep; d.absent += ea; d.late += el; d.early += ee; d.overtimeMins += eot; d.workMins += ework;
      });
      const leaveByType = { paid: 0, earned: 0, training: 0 };
      const leaveByEmp = [];
      if (typeof window !== 'undefined') {
        EMPLOYEES.forEach((emp) => {
          const lv = getLeavesForEmployeeMonth(emp.id, monthKey);
          const vals = Object.values(lv);
          const paid = vals.filter((x) => x === 'paid').length;
          const earned = vals.filter((x) => x === 'earned').length;
          const training = vals.filter((x) => x === 'training').length;
          if (paid || earned || training) leaveByEmp.push({ id: emp.id, name: emp.displayName, total: paid + earned + training });
          leaveByType.paid += paid; leaveByType.earned += earned; leaveByType.training += training;
        });
      }
      const out = { monthKey, present, absent, late, early, overtimeMins: overtime, perEmp, perDept: [...perDept.values()], daily, leaveByType, leaveByEmp };
      monthMap.set(monthKey, out);
      return out;
    };
    allMonths.forEach((m) => ensureMonth(m));
    return { rules, allMonths, ensureMonth, datePeople };
  }, [selectedMonth]);

  const contextDate = (monthKey, tomorrow = false) => {
    const [y, m] = monthKey.split('-').map(Number);
    const now = new Date();
    const agg = index.ensureMonth(monthKey);
    const days = [...agg.daily.keys()].map((k) => Number(k.split('-')[2])).sort((a, b) => a - b);
    if (!days.length) return `${monthKey}-01`;
    if (now.getFullYear() === y && now.getMonth() + 1 === m) {
      const target = now.getDate() + (tomorrow ? 1 : 0);
      return `${monthKey}-${pad(days.find((d) => d >= target) || days[days.length - 1])}`;
    }
    return `${monthKey}-${pad(days[days.length - 1])}`;
  };

  const getReply = (text) => {
    const forcedEmpMatches = [...String(text).matchAll(/__empid(\d*):([a-zA-Z0-9_-]+)__/g)];
    const forcedEmpMap = forcedEmpMatches.reduce((acc, m) => {
      const slot = m[1] ? Number(m[1]) : 1;
      acc[slot] = String(m[2]);
      return acc;
    }, {});
    const forcedEmpId = forcedEmpMap[1] || null;
    const cleanedText = String(text).replace(/__empid\d*:[a-zA-Z0-9_-]+__/g, '').trim();
    const qBase = norm(cleanedText);
    const wantsChart = qBase.includes('chart') || qBase.includes('graph') || qBase.includes('pie') || qBase.includes('diagram');
    const isCompareQuery = qBase.includes('compare') || qBase.includes('vs') || qBase.includes('versus');
    const refusal = getRefusalText(qBase);
    if (refusal) return { text: refusal, chart: null };

    if (hasUnsupportedLanguage(text)) {
      return { text: 'I will try to help, but I work best in English. If possible, please rephrase in English for more accurate answers.', chart: null };
    }

    if (looksRandomInput(qBase)) {
      return { text: "I didn't understand that. Could you please rephrase your question?", chart: null };
    }

    if (AMBIGUOUS_PHRASES.some((p) => qBase.includes(p))) {
      return { text: "Do you mean yesterday's attendance or the most recent record?", chart: null };
    }

    if (UNSUPPORTED_FEATURE_PHRASES.some((p) => qBase.includes(p))) {
      return { text: 'That feature is not available in this system. I can still explain how to handle it manually or suggest a workflow.', chart: null };
    }

    if (MISSING_INFO_PHRASES.some((p) => qBase === p || qBase.startsWith(`${p} `))) {
      return { text: 'Please specify the employee name or date for the attendance report.', chart: null };
    }

    const quickCandidateMatch = forcedEmpId ? null : findEmployeeCandidates(qBase);
    const isDomainQuery = DOMAIN_KEYWORDS.some((k) => qBase.includes(k))
      || hasExplicitMonthInQuery(qBase)
      || hasDateHint(qBase)
      || (quickCandidateMatch?.matches?.length > 0);
    if (!isDomainQuery) {
      const general = getGeneralReply(qBase);
      if (general) return { text: general, chart: null };
      return { text: "I can help with general questions too. Tell me the topic or ask a specific question and I'll do my best to answer.", chart: null };
    }

    const explicitMonth = hasExplicitMonthInQuery(qBase);
    const monthKey = explicitMonth
      ? parseMonth(qBase, selectedMonth, index.allMonths)
      : (chatContext.monthKey || selectedMonth);
    const monthLabel = formatMonthLabel(monthKey);
    const agg = index.ensureMonth(monthKey);
    const overallAgg = wantsAllMonths(qBase)
      ? (() => {
        const overall = new Map();
        index.allMonths.forEach((m) => {
          const mAgg = index.ensureMonth(m);
          mAgg.perEmp.forEach((row) => {
            if (!overall.has(row.id)) overall.set(row.id, { ...row });
            else {
              const o = overall.get(row.id);
              o.present += row.present;
              o.absent += row.absent;
              o.late += row.late;
              o.early += row.early;
              o.overtimeMins += row.overtimeMins;
              o.workMins += row.workMins;
              const work = o.present + o.absent;
              o.attendancePct = work ? (o.present / work) * 100 : 0;
            }
          });
        });
        return { perEmp: [...overall.values()] };
      })()
      : null;

    const mentionedEmp = forcedEmpId
      ? EMPLOYEES.find((e) => String(e.id) === forcedEmpId)
      : findEmployeeFromQuery(qBase);
    const contextEmp = !mentionedEmp && chatContext.employeeId
      ? EMPLOYEES.find((e) => e.id === chatContext.employeeId)
      : null;
    const candidateMatch = (forcedEmpId || (isCompareQuery && (forcedEmpMap[1] || forcedEmpMap[2])))
      ? null
      : (quickCandidateMatch || findEmployeeCandidates(qBase));
    if (!isCompareQuery && candidateMatch?.matches?.length > 1) {
      return {
        text: `I found multiple employees matching that name:\n${candidateMatch.matches.map((e) => `${e.displayName} - ${e.dept}`).join('\n')}\nPlease choose the correct employee.`,
        chart: null,
        pendingChoice: { baseQuery: cleanedText || text, options: candidateMatch.matches.map((e) => ({ id: e.id, name: e.displayName, dept: e.dept })) },
      };
    }
    const fallbackEmp = (!mentionedEmp && candidateMatch?.matches?.length === 1
      && (FOLLOW_UP_KEYS.some((k) => qBase.includes(k)) || hasExplicitMonthInQuery(qBase) || hasDateHint(qBase)))
      ? candidateMatch.matches[0]
      : null;
    const resolvedEmp = mentionedEmp || fallbackEmp || contextEmp;
    const isFollowUp = FOLLOW_UP_KEYS.some((k) => qBase.includes(k));
    const hasTemporalOnlyFollowUp = hasExplicitMonthInQuery(qBase) || hasDateHint(qBase) || qBase.includes('this month') || qBase.includes('last month');
    const q = (contextEmp && (isFollowUp || hasTemporalOnlyFollowUp)) ? `${qBase} ${norm(contextEmp.displayName)}` : qBase;

    const dateFromQuery = hasDateHint(qBase) ? parseDate(qBase, monthKey) : null;
    const dateCheck = parseDateStrict(dateFromQuery);
    if (!dateCheck.valid) {
      return { text: 'That date appears to be invalid. Please enter a valid date.', chart: null };
    }
    if (
      isFutureDate(dateFromQuery)
      || qBase.includes('future date')
      || qBase.includes('next year')
      || qBase.includes('next week')
      || /\b20(3\d|[4-9]\d)\b/.test(qBase)
      || qBase.includes('tomorrow')
    ) {
      return { text: 'Attendance data for future dates is not available.', chart: null };
    }

    if (isCompareQuery) {
      const normalizeSplit = (s) => s.replace(/\bcompare\b/g, ' ').replace(/\battendance\b/g, ' ').replace(/\bof\b/g, ' ').replace(/\bbetween\b/g, ' ').trim();
      const raw = normalizeSplit(qBase);
      const parts = raw.split(/\b(?:and|vs|versus)\b/).map((p) => p.trim()).filter(Boolean);
      const pickById = (id) => EMPLOYEES.find((e) => String(e.id) === String(id));
      let emp1 = forcedEmpMap[1] ? pickById(forcedEmpMap[1]) : null;
      let emp2 = forcedEmpMap[2] ? pickById(forcedEmpMap[2]) : null;

      const resolvePart = (part) => {
        const match = findEmployeeCandidates(part);
        if (!match?.matches?.length) return { type: 'none', match: null };
        if (match.matches.length === 1) return { type: 'single', match: match.matches[0] };
        return { type: 'multi', match, part };
      };

      const part1 = parts[0] ? resolvePart(parts[0]) : { type: 'none' };
      const part2 = parts[1] ? resolvePart(parts[1]) : { type: 'none' };
      if (!emp1 && part1.type === 'single') emp1 = part1.match;
      if (!emp2 && part2.type === 'single') emp2 = part2.match;

      if (!emp1) {
        if (part1.type === 'multi') {
          const base = emp2 ? `${cleanedText} __empid2:${emp2.id}__` : (cleanedText || text);
          return {
            text: `I found multiple employees matching that name:\n${part1.match.matches.map((e) => `${e.displayName} - ${e.dept}`).join('\n')}\nPlease choose the correct employee.`,
            chart: null,
            pendingChoice: { baseQuery: base, slot: 1, options: part1.match.matches.map((e) => ({ id: e.id, name: e.displayName, dept: e.dept })) },
          };
        }
        if (part1.type === 'single') {
          return { text: 'Please specify the second employee name to compare.', chart: null };
        }
      }

      if (!emp2) {
        if (part2.type === 'multi') {
          const base = emp1 ? `${cleanedText} __empid1:${emp1.id}__` : (cleanedText || text);
          return {
            text: `I found multiple employees matching that name:\n${part2.match.matches.map((e) => `${e.displayName} - ${e.dept}`).join('\n')}\nPlease choose the correct employee.`,
            chart: null,
            pendingChoice: { baseQuery: base, slot: 2, options: part2.match.matches.map((e) => ({ id: e.id, name: e.displayName, dept: e.dept })) },
          };
        }
        if (part2.type === 'single') {
          return { text: 'Please specify the second employee name to compare.', chart: null };
        }
      }

      if (emp1 && emp2) {
        const r1 = agg.perEmp.find((x) => x.id === emp1.id);
        const r2 = agg.perEmp.find((x) => x.id === emp2.id);
        if (!r1 || !r2) return { text: 'The requested information is not available in the current dataset.', chart: null };
        return {
          text: `Compare ${emp1.displayName} vs ${emp2.displayName} (${monthLabel}):\n${emp1.displayName}:\nPresent Days: ${r1.present}\nAbsent Days: ${r1.absent}\nAttendance %: ${r1.attendancePct.toFixed(1)}%\nLate Entries: ${r1.late}\nEarly Exits: ${r1.early}\nOvertime: ${fmtDur(r1.overtimeMins)}\n\n${emp2.displayName}:\nPresent Days: ${r2.present}\nAbsent Days: ${r2.absent}\nAttendance %: ${r2.attendancePct.toFixed(1)}%\nLate Entries: ${r2.late}\nEarly Exits: ${r2.early}\nOvertime: ${fmtDur(r2.overtimeMins)}`,
          chart: wantsChart ? {
            type: qBase.includes('pie') ? 'pie' : 'bar',
            title: `Attendance % Comparison ${monthLabel}`,
            data: [
              { name: emp1.displayName, value: Number(r1.attendancePct.toFixed(1)), color: '#16a34a' },
              { name: emp2.displayName, value: Number(r2.attendancePct.toFixed(1)), color: '#2563eb' },
            ],
          } : null,
        };
      }
    }

    const employeeIntent = EMPLOYEE_HINTS.some((h) => qBase.includes(h));
    if (employeeIntent && !mentionedEmp && !contextEmp) {
      const match = findEmployeeCandidates(qBase);
      if (match.type === 'fuzzy' && match.matches.length === 1) {
        return { text: `Did you mean ${match.matches[0].displayName}? Please confirm.`, chart: null, pendingChoice: { baseQuery: text, options: match.matches.map((e) => ({ id: e.id, name: e.displayName, dept: e.dept })) } };
      }
      if (match.type === 'fuzzy' && match.matches.length > 1) {
        return { text: `Did you mean one of these employees?\n${match.matches.map((e) => `${e.displayName} - ${e.dept}`).join('\n')}\nPlease select the correct employee.`, chart: null, pendingChoice: { baseQuery: text, options: match.matches.map((e) => ({ id: e.id, name: e.displayName, dept: e.dept })) } };
      }
      if (match.type === 'partial' && match.matches.length > 0) {
        return { text: `Did you mean one of these employees?\n${match.matches.map((e) => `${e.displayName} - ${e.dept}`).join('\n')}\nPlease select the correct employee.`, chart: null, pendingChoice: { baseQuery: text, options: match.matches.map((e) => ({ id: e.id, name: e.displayName, dept: e.dept })) } };
      }
      return { text: "I couldn't find any employee with that name. Please check the spelling or try another name.", chart: null };
    }

    if (isGreeting(q)) return { text: 'Good to see you. Ask me anything about attendance, leave, late/early, overtime, trends, or general questions.', chart: null };
    if (isNameQuestion(q)) return { text: 'I am AttendIQ AI Assistant. I can answer attendance analytics and also help with general questions.', chart: null };
    if (q.includes('predict') || q.includes('future') || q.includes('forecast')) return { text: 'I rely on existing data only, so I cannot predict future values.', chart: null };

    if (q.includes('how many employees') || q.includes('total employees')) return { text: `Total employees in system: ${EMPLOYEES.length}.`, chart: null };
    if (q.includes('how many departments') || q.includes('total departments')) return { text: `Departments: ${DEPARTMENTS.length} (${DEPARTMENTS.map((d) => d.name).join(', ')}).`, chart: null };
    if (q.includes('working days this month')) return { text: `Working days in ${monthLabel}: ${[...agg.daily.values()].filter((d) => d.weekend === 0).length}.`, chart: null };

    if (q.includes('overview') || q.includes('dashboard') || q.includes('overall attendance') || q.includes('attendance summary for this month')) {
      return { text: `${monthLabel} overview:\nPresent Days: ${agg.present}\nAbsent Days: ${agg.absent}\nLate Entries: ${agg.late}\nEarly Exits: ${agg.early}\nOvertime: ${fmtDur(agg.overtimeMins)}`, chart: wantsChart ? { type: q.includes('pie') ? 'pie' : 'bar', title: `Attendance ${monthLabel}`, data: [{ name: 'Present', value: agg.present, color: '#16a34a' }, { name: 'Absent', value: agg.absent, color: '#ef4444' }, { name: 'Late', value: agg.late, color: '#334155' }, { name: 'Early', value: agg.early, color: '#a16207' }] } : null };
    }

    if (q.includes('today') || q.includes('tomorrow')) {
      const dk = contextDate(monthKey, q.includes('tomorrow'));
      const day = agg.daily.get(dk) || { present: 0, absent: 0, weekend: 0, late: 0, early: 0, overtimeMins: 0, workMins: 0 };
      const ppl = index.datePeople.get(dk) || [];
      if (q.includes('present')) return { text: `${dk} present employees (${ppl.filter((x) => x.status === 'present').length}): ${names(ppl.filter((x) => x.status === 'present'))}.`, chart: null };
      if (q.includes('absent')) return { text: `${dk} absent employees (${ppl.filter((x) => x.status === 'absent').length}): ${names(ppl.filter((x) => x.status === 'absent'))}.`, chart: null };
      if (q.includes('late')) return { text: `${dk} late entries (${ppl.filter((x) => x.isLateEntry).length}): ${names(ppl.filter((x) => x.isLateEntry))}.`, chart: null };
      if (q.includes('early')) return { text: `${dk} early exits (${ppl.filter((x) => x.isEarlyExit).length}): ${names(ppl.filter((x) => x.isEarlyExit))}.`, chart: null };
      if (q.includes('overtime')) return { text: `${dk} overtime employees (${ppl.filter((x) => x.overtimeMins > 0).length}).`, chart: null };
      return { text: `${dk} summary: Present ${day.present}, Absent ${day.absent}, Weekend ${day.weekend}, Late ${day.late}, Early Exit ${day.early}, Overtime ${fmtDur(day.overtimeMins)}.`, chart: null };
    }

    const d = parseDate(q, monthKey);
    const contextDateKey = (!d && chatContext.dateKey && (q.includes('that day') || q.includes('that date') || q.includes('on that day'))) ? chatContext.dateKey : null;
    if (d || contextDateKey) {
      const dk = d ? `${mk(d.y, d.m)}-${pad(d.d)}` : contextDateKey;
      const mkForDate = dk.split('-').slice(0, 2).join('-');
      const magg = index.ensureMonth(mkForDate);
      const day = magg.daily.get(dk);
      const ppl = index.datePeople.get(dk) || [];
      if (!day) return { text: `I couldn't find records for ${dk}. Please check the date and try again.`, chart: null };
      if ((q.includes('who') || q.includes('list') || q.includes('name')) && q.includes('absent')) return { text: `${dk} absent (${ppl.filter((x) => x.status === 'absent').length}): ${names(ppl.filter((x) => x.status === 'absent'))}.`, chart: null };
      if ((q.includes('who') || q.includes('list') || q.includes('name')) && q.includes('present')) return { text: `${dk} present (${ppl.filter((x) => x.status === 'present').length}): ${names(ppl.filter((x) => x.status === 'present'))}.`, chart: null };
      return { text: `${dk}: Present ${day.present}, Absent ${day.absent}, Weekend ${day.weekend}, Late ${day.late}, Early Exit ${day.early}.`, chart: wantsChart ? { type: q.includes('pie') ? 'pie' : 'bar', title: `Status on ${dk}`, data: [{ name: 'Present', value: day.present, color: '#16a34a' }, { name: 'Absent', value: day.absent, color: '#ef4444' }, { name: 'Weekend', value: day.weekend, color: '#6b7280' }] } : null };
    }

    const emp = resolvedEmp || candidateMatch?.matches?.[0];
    if (emp) {
      const row = agg.perEmp.find((x) => x.id === emp.id);
      if (row) {
        if (q.includes('leave history')) {
          const lv = getLeavesForEmployeeMonth(emp.id, monthKey);
          const lines = Object.entries(lv).map(([k, v]) => `${k} (${v})`);
          return { text: `${emp.displayName} leave history in ${monthLabel}:\n${lines.length ? lines.join(', ') : 'No approved leaves.'}`, chart: null };
        }
        if (q.includes('late')) return { text: `${emp.displayName} in ${monthLabel}:\nLate Entries: ${row.late}`, chart: null };
        if (q.includes('early')) return { text: `${emp.displayName} in ${monthLabel}:\nEarly Exits: ${row.early}`, chart: null };
        if (q.includes('working hours')) return { text: `${emp.displayName} in ${monthLabel}:\nTotal Working Hours: ${fmtHours(row.workMins)}`, chart: null };
        return {
          text: `${emp.displayName} in ${formatMonthLabel(monthKey)}:\nPresent Days: ${row.present}\nAbsent Days: ${row.absent}\nAttendance %: ${row.attendancePct.toFixed(1)}%\nLate Entries: ${row.late}\nEarly Exits: ${row.early}\nOvertime: ${fmtDur(row.overtimeMins)}`,
          chart: wantsChart ? {
            type: q.includes('pie') ? 'pie' : 'bar',
            title: `${emp.displayName} Attendance ${formatMonthLabel(monthKey)}`,
            data: [
              { name: 'Present', value: row.present, color: '#16a34a' },
              { name: 'Absent', value: row.absent, color: '#ef4444' },
              { name: 'Late', value: row.late, color: '#334155' },
              { name: 'Early', value: row.early, color: '#a16207' },
            ],
          } : null,
        };
      }
    }

    if (q.includes('perfect attendance')) return { text: `Perfect attendance in ${monthLabel}:\n${names(agg.perEmp.filter((x) => x.absent === 0 && x.present + x.absent > 0))}.`, chart: null };
    if (q.includes('below 80') || q.includes('low attendance')) return { text: `Employees below 80% attendance in ${monthLabel}:\n${agg.perEmp.filter((x) => x.attendancePct < 80).map((x) => `${x.name} (${x.attendancePct.toFixed(1)}%)`).join(', ') || 'none'}.`, chart: null };
    if (q.includes('highest attendance') || q.includes('attendance ranking')) return { text: `Top attendance in ${monthLabel}:\n${[...agg.perEmp].sort((a, b) => b.attendancePct - a.attendancePct).slice(0, 5).map((x) => `${x.name} (${x.attendancePct.toFixed(1)}%)`).join(', ')}`, chart: null };
    if (wantsMostAbsent(q)) {
      const source = overallAgg ? overallAgg.perEmp : agg.perEmp;
      const label = overallAgg ? 'Overall (all months)' : monthLabel;
      const eligible = source.filter((x) => (x.present + x.absent) > 0);
      const sorted = [...eligible].sort((a, b) => (b.absent - a.absent) || a.name.localeCompare(b.name));
      const topAbsent = sorted[0]?.absent ?? 0;
      if (!sorted.length || topAbsent === 0) return { text: `No absence records found in ${label}.`, chart: null };
      const tied = sorted.filter((x) => x.absent === topAbsent);
      const top5 = sorted.slice(0, 5).map((x) => `${x.name} (${x.absent})`).join(', ');
      const base = tied.length === 1
        ? `Most absent in ${label}: ${tied[0].name} (${topAbsent} days).`
        : `Most absent in ${label} is a tie at ${topAbsent} days: ${names(tied)}.`;
      return {
        text: `${base} Top 5 absences: ${top5}.`,
        chart: wantsChart
          ? { type: 'bar', title: `Most Absent ${label}`, data: sorted.slice(0, 8).map((x) => ({ name: x.name, value: x.absent, color: '#ef4444' })) }
          : null,
      };
    }
    if (wantsMostPresent(q)) {
      const source = overallAgg ? overallAgg.perEmp : agg.perEmp;
      const label = overallAgg ? 'Overall (all months)' : monthLabel;
      const eligible = source.filter((x) => (x.present + x.absent) > 0);
      const sorted = [...eligible].sort((a, b) => (b.present - a.present) || a.name.localeCompare(b.name));
      const topPresent = sorted[0]?.present ?? 0;
      if (!sorted.length || topPresent === 0) return { text: `No presence records found in ${label}.`, chart: null };
      const tied = sorted.filter((x) => x.present === topPresent);
      const top5 = sorted.slice(0, 5).map((x) => `${x.name} (${x.present})`).join(', ');
      const base = tied.length === 1
        ? `Most present in ${label}: ${tied[0].name} (${topPresent} days).`
        : `Most present in ${label} is a tie at ${topPresent} days: ${names(tied)}.`;
      return {
        text: `${base} Top 5 presence: ${top5}.`,
        chart: wantsChart
          ? { type: 'bar', title: `Most Present ${label}`, data: sorted.slice(0, 8).map((x) => ({ name: x.name, value: x.present, color: '#16a34a' })) }
          : null,
      };
    }

    if (q.includes('late rule')) return { text: `Late entry rule: after ${index.rules.lateAfter}.`, chart: null };
    if (q.includes('early rule')) return { text: `Early exit rule: before ${index.rules.earlyBefore}.`, chart: null };
    if (q.includes('attendance rule')) return { text: `Attendance rules: Late after ${index.rules.lateAfter}, Early exit before ${index.rules.earlyBefore}.`, chart: null };

    if (q.includes('most late')) return { text: `Most late entries in ${monthLabel}:\n${[...agg.perEmp].sort((a, b) => b.late - a.late)[0]?.name || 'N/A'}.`, chart: null };
    if (q.includes('most early')) return { text: `Most early exits in ${monthLabel}:\n${[...agg.perEmp].sort((a, b) => b.early - a.early)[0]?.name || 'N/A'}.`, chart: null };
    if (q.includes('late entries by department')) return { text: `Late by department (${monthLabel}):\n${[...agg.perDept].map((d2) => `${d2.dept} ${d2.late}`).join(', ')}`, chart: null };
    if (q.includes('early exits by department')) return { text: `Early by department (${monthLabel}):\n${[...agg.perDept].map((d2) => `${d2.dept} ${d2.early}`).join(', ')}`, chart: null };

    if (q.includes('highest overtime') || q.includes('most overtime')) return { text: `Highest overtime in ${monthLabel}:\n${[...agg.perEmp].sort((a, b) => b.overtimeMins - a.overtimeMins)[0]?.name || 'N/A'} (${fmtDur([...agg.perEmp].sort((a, b) => b.overtimeMins - a.overtimeMins)[0]?.overtimeMins || 0)})`, chart: null };
    if (q.includes('lowest overtime')) {
      const low = [...agg.perEmp].filter((x) => x.overtimeMins > 0).sort((a, b) => a.overtimeMins - b.overtimeMins)[0];
      return { text: `Lowest overtime (>0) in ${monthLabel}:\n${low?.name || 'N/A'} (${fmtDur(low?.overtimeMins || 0)})`, chart: null };
    }
    if (q.includes('total overtime')) return { text: `Total overtime in ${monthLabel}:\n${fmtDur(agg.overtimeMins)}`, chart: null };
    if (q.includes('overtime by department')) return { text: `Overtime by department (${monthLabel}):\n${[...agg.perDept].map((d2) => `${d2.dept} ${fmtDur(d2.overtimeMins)}`).join(', ')}`, chart: null };

    if (q.includes('worked more than 9 hours') || q.includes('less than 8 hours')) {
      const dk = contextDate(monthKey, false);
      const ppl = (index.datePeople.get(dk) || []).filter((x) => x.status === 'present');
      const f = q.includes('more than 9') ? ppl.filter((x) => x.workMins > 9 * 60) : ppl.filter((x) => x.workMins > 0 && x.workMins < 8 * 60);
      return { text: `${dk} ${q.includes('more than 9') ? 'more than 9 hours' : 'less than 8 hours'} (${f.length}): ${names(f)}.`, chart: null };
    }
    if (q.includes('average working hours')) {
      const tp = agg.perEmp.reduce((s, r) => s + r.present, 0);
      const tw = agg.perEmp.reduce((s, r) => s + r.workMins, 0);
      return { text: `Average working hours in ${monthLabel}:\n${fmtHours(tp ? tw / tp : 0)} per present day.`, chart: null };
    }

    if (q.includes('leave types')) return { text: 'Leave types: Paid Leave, Earned Leave, Training/Other Work Leave.', chart: null };
    if (q.includes('leave report') || q.includes('leave statistics')) return { text: `Leave report ${monthLabel}:\nPaid: ${agg.leaveByType.paid}\nEarned: ${agg.leaveByType.earned}\nTraining/Other: ${agg.leaveByType.training}`, chart: wantsChart ? { type: q.includes('bar') ? 'bar' : 'pie', title: `Leave Types ${monthLabel}`, data: [{ name: 'Paid', value: agg.leaveByType.paid, color: '#7c3aed' }, { name: 'Earned', value: agg.leaveByType.earned, color: '#ec4899' }, { name: 'Training/Other', value: agg.leaveByType.training, color: '#0ea5e9' }] } : null };
    if (q.includes('most leaves')) return { text: `Most leaves in ${monthLabel}:\n${[...agg.leaveByEmp].sort((a, b) => b.total - a.total)[0]?.name || 'None'}.`, chart: null };

    if (q.includes('holiday') || q.includes('weekend')) {
      const h = Object.entries(NATIONAL_HOLIDAYS);
      if (q.includes('christmas')) return { text: h.some(([, n]) => norm(n).includes('christmas')) ? `Yes, Christmas is listed as a holiday.` : 'Christmas is not listed.', chart: null };
      if (q.includes('upcoming')) return { text: `Upcoming holidays: ${h.filter(([k]) => new Date(k) >= new Date()).sort((a, b) => a[0].localeCompare(b[0])).slice(0, 8).map(([k, n]) => `${k} ${n}`).join(', ') || 'none'}.`, chart: null };
      if (q.includes('national') || q.includes('holiday list')) return { text: `National holidays: ${h.slice(0, 15).map(([k, n]) => `${k} ${n}`).join(', ')}.`, chart: null };
      const [yy, mm] = monthKey.split('-');
      const inMonth = h.filter(([k]) => k.startsWith(`${yy}-${mm}-`));
      if (inMonth.length) return { text: `Holidays in ${monthLabel}:\n${inMonth.map(([k, n]) => `${k} ${n}`).join(', ')}`, chart: null };
      return { text: `Weekend days in ${monthLabel}:\n${[...agg.daily.keys()].filter((k) => new Date(k).getDay() === 0).map((k) => k.split('-')[2]).join(', ') || 'none'}.`, chart: null };
    }

    if (q.includes('department')) {
      const rates = agg.perDept.map((d2) => ({ ...d2, rate: (d2.present + d2.absent) ? (d2.present / (d2.present + d2.absent)) * 100 : 0 }));
      if (q.includes('highest attendance')) return { text: `Highest department attendance in ${monthLabel}:\n${[...rates].sort((a, b) => b.rate - a.rate)[0]?.dept || 'N/A'}.`, chart: null };
      if (q.includes('lowest attendance')) return { text: `Lowest department attendance in ${monthLabel}:\n${[...rates].sort((a, b) => a.rate - b.rate)[0]?.dept || 'N/A'}.`, chart: null };
      if (q.includes('compare')) return { text: `Department comparison ${monthLabel}:\n${rates.map((r) => `${r.dept} ${r.rate.toFixed(1)}%`).join(' | ')}`, chart: null };
      return { text: `Department report ${monthLabel}:\n${rates.map((r) => `${r.dept} attendance ${r.rate.toFixed(1)}%, present ${r.present}, absent ${r.absent}`).join(' | ')}`, chart: wantsChart ? { type: 'bar', title: `Department Attendance ${monthLabel}`, data: rates.map((r) => ({ name: r.dept, value: Number(r.rate.toFixed(1)), color: '#2563eb' })) } : null };
    }

    if (q.includes('trend') || q.includes('analytics') || q.includes('this year') || q.includes('last 6 months') || q.includes('comparison between months')) {
      const series = index.allMonths.map((m) => {
        const a = index.ensureMonth(m);
        const w = a.present + a.absent;
        return { name: formatMonthLabel(m), rate: w ? Number(((a.present / w) * 100).toFixed(1)) : 0, absent: a.absent, late: a.late };
      });
      if (q.includes('which month had highest absences') || q.includes('highest absences month')) {
        const top = [...series].sort((a, b) => b.absent - a.absent)[0];
        return { text: `Month with highest absences: ${top?.name || 'N/A'} (${top?.absent || 0}).`, chart: null };
      }
      if (q.includes('which month had more late entries') || q.includes('highest late entries month')) {
        const top = [...series].sort((a, b) => b.late - a.late)[0];
        return { text: `Month with highest late entries: ${top?.name || 'N/A'} (${top?.late || 0}).`, chart: null };
      }
      if (q.includes('absenteeism')) return { text: `Absenteeism trend: ${series.map((s) => `${s.name} absent ${s.absent}`).join(', ')}.`, chart: wantsChart ? { type: 'bar', title: 'Absenteeism Trend', data: series.map((s) => ({ name: s.name, value: s.absent, color: '#ef4444' })) } : null };
      if (q.includes('punctuality')) return { text: `Punctuality trend (lower late is better): ${series.map((s) => `${s.name} late ${s.late}`).join(', ')}.`, chart: wantsChart ? { type: 'bar', title: 'Late Entries Trend', data: series.map((s) => ({ name: s.name, value: s.late, color: '#334155' })) } : null };
      return { text: `Monthly attendance % trend: ${series.map((s) => `${s.name} ${s.rate}%`).join(', ')}.`, chart: wantsChart ? { type: 'bar', title: 'Attendance % Trend', data: series.map((s) => ({ name: s.name, value: s.rate, color: '#16a34a' })) } : null };
    }

    if (q.includes('compare')) {
      const months = index.allMonths.filter((m) => q.includes(m));
      if (months.length >= 2) {
        const a1 = index.ensureMonth(months[0]); const a2 = index.ensureMonth(months[1]);
        return { text: `Compare ${formatMonthLabel(months[0])} vs ${formatMonthLabel(months[1])}:\nPresent Days: ${a1.present} vs ${a2.present}\nAbsent Days: ${a1.absent} vs ${a2.absent}\nLate Entries: ${a1.late} vs ${a2.late}`, chart: null };
      }
      const emps = EMPLOYEES.filter((e) => q.includes(norm(e.displayName)));
      if (emps.length >= 2) {
        const e1 = agg.perEmp.find((x) => x.id === emps[0].id); const e2 = agg.perEmp.find((x) => x.id === emps[1].id);
        if (e1 && e2) return { text: `Compare ${e1.name} vs ${e2.name} (${monthLabel}):\nAttendance %: ${e1.attendancePct.toFixed(1)} vs ${e2.attendancePct.toFixed(1)}\nLate Entries: ${e1.late} vs ${e2.late}\nOvertime: ${fmtDur(e1.overtimeMins)} vs ${fmtDur(e2.overtimeMins)}`, chart: null };
      }
      return { text: 'For comparison, include two employee names, two departments, or two month keys (YYYY-MM).', chart: null };
    }

    if (q.includes('generate') || q.includes('export') || q.includes('download') || q.includes('pdf') || q.includes('csv')) return { text: 'Use the Reports page to generate attendance summaries. PDF/CSV automation is not fully enabled in this build yet.', chart: null };
    if (q.includes('how does the system detect late') || q.includes('how is overtime calculated') || q.includes('how are work hours calculated') || q.includes('track lunch')) return { text: `System logic: Late when in-time > ${index.rules.lateAfter}; Early exit when out-time < ${index.rules.earlyBefore}; Overtime is out-time beyond ${index.rules.earlyBefore}; Attendance % = present / (present + absent) * 100.`, chart: null };
    if (q.includes('admin') && (q.includes('edit') || q.includes('update') || q.includes('correct') || q.includes('add new employee') || q.includes('remove employee') || q.includes('monitor'))) return { text: 'Admin can monitor dashboards/reports and update attendance workflows in the portal. Employee master and audit controls can be extended from Admin/Masters modules.', chart: null };
    if (q.includes('technologies') || q.includes('developed this system') || q.includes('integrate with hr') || q.includes('biometric') || q.includes('remote employees') || q.includes('mobile access') || q.includes('attendance alerts')) return { text: 'Current system is React-based with local JSON + browser storage. It can be extended for HR/biometric integrations, alerts, and remote tracking via API services.', chart: null };
    if (q.includes('improvements can be added') || q.includes('what new features')) return { text: 'Possible upgrades: API-backed data sync, role-based permissions, scheduled PDF/CSV reports, email/WhatsApp alerts, anomaly detection, geofence/biometric integrations, and advanced BI dashboards.', chart: null };
    if (q.includes('attendance of') || q.includes('show attendance of')) return { text: "I couldn't find records for that employee. Please check the employee name or try searching again.", chart: null };

    return {
      text: `I can answer attendance questions across all available months/years in this dataset (${index.allMonths.join(', ')}). You can ask direct or indirect queries about attendance, leave, holidays, late/early, overtime, departments, trends, dates, and comparisons. If your question is general (not tied to attendance data), I can still help with a high-level answer. If you want a specific month, ask like "December 2025" or "December_2025".`,
      chart: null,
    };
  };

  const deriveContextFromMessages = (msgs) => {
    let ctx = { employeeId: null, monthKey: selectedMonth, dateKey: null };
    msgs.forEach((m) => {
      if (!m || m.role !== 'user') return;
      const q = norm(m.text);
      const mentionedEmp = EMPLOYEES.find((e) => q.includes(norm(e.displayName)));
      const monthKeyForCtx = hasExplicitMonthInQuery(q) ? parseMonth(q, selectedMonth, index.allMonths) : (ctx.monthKey || selectedMonth);
      const dateFromQuery = hasDateHint(q) ? parseDate(q, monthKeyForCtx) : null;
      const dateKeyForCtx = dateFromQuery ? `${mk(dateFromQuery.y, dateFromQuery.m)}-${pad(dateFromQuery.d)}` : (q.includes('today') || q.includes('tomorrow') ? contextDate(monthKeyForCtx, q.includes('tomorrow')) : ctx.dateKey);
      ctx = {
        employeeId: mentionedEmp?.id || ctx.employeeId,
        monthKey: monthKeyForCtx || ctx.monthKey,
        dateKey: dateKeyForCtx || ctx.dateKey,
      };
    });
    return ctx;
  };

  const startEditMessage = (idx) => {
    const m = messages[idx];
    if (!m || m.role !== 'user') return;
    setEditingMessageIdx(idx);
    setInput(m.text || '');
    setActiveMessageIdx(null);
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      }
    }, 0);
  };

  const onCopyMessage = async (idx) => {
    const m = messages[idx];
    if (!m) return;
    const ok = await copyToClipboard(m.text);
    if (!ok) return;
    setCopiedMessageIdx(idx);
    setTimeout(() => setCopiedMessageIdx(null), 900);
  };

  const finalizeMessage = (text, isEditing, displayText) => {
    const userText = displayText || text;
    const q = norm(text);
    const reply = getReply(text);

    const baseContext = isEditing ? deriveContextFromMessages(messages.slice(0, editingMessageIdx)) : chatContext;
    const mentionedEmp = findEmployeeFromQuery(q);
    const monthKeyForCtx = hasExplicitMonthInQuery(q) ? parseMonth(q, selectedMonth, index.allMonths) : (baseContext.monthKey || selectedMonth);
    const dateFromQuery = hasDateHint(q) ? parseDate(q, monthKeyForCtx) : null;
    const dateKeyForCtx = dateFromQuery ? `${mk(dateFromQuery.y, dateFromQuery.m)}-${pad(dateFromQuery.d)}` : (q.includes('today') || q.includes('tomorrow') ? contextDate(monthKeyForCtx, q.includes('tomorrow')) : baseContext.dateKey);

    const nextContext = {
      employeeId: mentionedEmp?.id || baseContext.employeeId,
      monthKey: monthKeyForCtx || baseContext.monthKey,
      dateKey: dateKeyForCtx || baseContext.dateKey,
    };
    setChatContext(nextContext);

    const normalizedText = formatReplyText(reply.text);
    const needsLead = !normalizedText.startsWith('I can')
      && !normalizedText.startsWith('I’m')
      && !normalizedText.startsWith('I am')
      && !normalizedText.startsWith('Good to see')
      && !normalizedText.startsWith('That question is outside');
    const lead = RESPONSE_LEADS[q.length % RESPONSE_LEADS.length];
    const botText = needsLead ? `${lead}\n\n${normalizedText}` : normalizedText;

    setMessages((prev) => (isEditing
      ? [...prev.slice(0, editingMessageIdx), { role: 'user', text: userText }, { role: 'bot', text: botText, chart: reply.chart }]
      : [...prev, { role: 'user', text: userText }, { role: 'bot', text: botText, chart: reply.chart }]
    ));
    if (reply?.pendingChoice) setPendingChoice(reply.pendingChoice);
    if (isEditing) {
      setEditingMessageIdx(null);
      setPendingChoice(null);
    }
    setActiveMessageIdx(null);
    setInput('');
  };

  const send = () => {
    let text = input.trim();
    if (!text) return;

    const isEditing = Number.isInteger(editingMessageIdx);

    if (!isEditing && pendingChoice?.options?.length) {
      const qPick = norm(text);
      let chosen = null;
      if (qPick.includes('first') || qPick.includes('1')) chosen = pendingChoice.options[0];
      else if ((qPick.includes('second') || qPick.includes('2')) && pendingChoice.options[1]) chosen = pendingChoice.options[1];
      else if (qPick.includes('third') && pendingChoice.options[2]) chosen = pendingChoice.options[2];
      else if (qPick.includes('new employee')) chosen = pendingChoice.options[pendingChoice.options.length - 1];
      else {
        chosen = pendingChoice.options.find((o) => qPick.includes(norm(o.dept)) || qPick.includes(norm(o.name)));
      }

      if (!chosen) {
        setMessages((prev) => [...prev, { role: 'user', text }, { role: 'bot', text: 'Please choose one option (for example: first, second, or department name).', chart: null }]);
        setInput('');
        return;
      }
      text = `${pendingChoice.baseQuery} ${chosen.name}`;
      setPendingChoice(null);
    }

    finalizeMessage(text, isEditing);
  };

  const selectPendingOption = (opt) => {
    if (!pendingChoice?.options?.length || !opt) return;
    const baseClean = String(pendingChoice.baseQuery || '').replace(/__empid\d*:[a-zA-Z0-9_-]+__/g, '').trim();
    const baseNorm = norm(baseClean);
    const optNorm = norm(opt.name);
    const displayText = (baseNorm && optNorm && baseNorm.includes(optNorm))
      ? baseClean
      : `${baseClean} ${opt.name}`.trim();
    const slot = pendingChoice.slot || 1;
    const text = `${displayText} __empid${slot}:${opt.id}__`;
    setPendingChoice(null);
    finalizeMessage(text, false, displayText);
  };

  const renderChart = (chart) => {
    if (!chart) return null;
    const legendItems = Array.isArray(chart.data) ? chart.data.map((d) => ({ name: d.name, color: d.color })) : [];
    return (
      <div style={{ marginTop: 8, border: '1px solid var(--border-color)', borderRadius: 8, padding: 8, background: 'var(--input-bg)' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>{chart.title}</div>
        <div style={{ width: 260, height: 150 }}>
          <ResponsiveContainer width="100%" height="100%">
            {chart.type === 'pie' ? (
              <PieChart>
                <Pie data={chart.data} dataKey="value" nameKey="name" outerRadius={52} innerRadius={18} paddingAngle={2}>{chart.data.map((d) => <Cell key={d.name} fill={d.color} />)}</Pie>
                <Tooltip />
              </PieChart>
            ) : (
              <BarChart data={chart.data}>
                <XAxis dataKey="name" hide />
                <YAxis hide />
                <Tooltip />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>{chart.data.map((d) => <Cell key={d.name} fill={d.color} />)}</Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
        {legendItems.length ? (
          <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-muted)' }}>
            {legendItems.map((item) => (
              <div key={`${item.name}-${item.color}`} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: item.color, display: 'inline-block' }} />
                <span>{item.name}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="fade-in">
      <div style={{ background: 'var(--surface-bg)', border: '1px solid var(--border-color)', borderRadius: 14, boxShadow: '0 1px 6px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', fontSize: 15, fontWeight: 700, color: 'var(--text-main)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Chatbot Assistant</span>
          <button type="button" onClick={() => { setMessages([welcome]); setInput(''); setPendingChoice(null); setChatContext({ employeeId: null, monthKey: selectedMonth, dateKey: null }); setActiveMessageIdx(null); setEditingMessageIdx(null); setCopiedMessageIdx(null); }} style={{ height: 28, border: '1px solid var(--border-color)', borderRadius: 8, background: 'var(--input-bg)', color: 'var(--text-main)', padding: '0 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>New Chat</button>
        </div>
        <div style={{ padding: 14, height: 360, overflowY: 'auto', background: 'var(--input-bg)' }} onClick={() => setActiveMessageIdx(null)}>
          {messages.map((m, idx) => (
            <div key={idx} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: activeMessageIdx === idx ? 42 : 10 }}>
                <div
                role="button"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); setActiveMessageIdx((v) => (v === idx ? null : idx)); }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveMessageIdx((v) => (v === idx ? null : idx)); } }}
                style={{
                  position: 'relative',
                  maxWidth: '78%',
                  borderRadius: 10,
                  padding: '8px 10px',
                  fontSize: 13,
                  background: m.role === 'user' ? '#2563eb' : 'var(--surface-bg)',
                  color: m.role === 'user' ? '#fff' : 'var(--text-main)',
                  border: m.role === 'user' ? 'none' : '1px solid var(--border-color)',
                  cursor: 'pointer',
                  whiteSpace: 'pre-line',
                  outline: 'none',
                }}
              >
                <div>{m.text}</div>
                {m.role === 'bot' ? renderChart(m.chart) : null}
                {activeMessageIdx === idx ? (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: -36,
                      display: 'flex',
                      gap: 8,
                      ...(m.role === 'user' ? { right: 6 } : { left: 6 }),
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      title={copiedMessageIdx === idx ? 'Copied' : 'Copy'}
                      onClick={() => onCopyMessage(idx)}
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 8,
                        border: '1px solid var(--border-color)',
                        background: 'var(--surface-bg)',
                        color: 'var(--text-main)',
                        display: 'grid',
                        placeItems: 'center',
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      {copiedMessageIdx === idx ? <IconCheck size={16} color="#16a34a" /> : <IconCopy size={16} />}
                    </button>
                    {m.role === 'user' ? (
                      <button
                        type="button"
                        title="Edit message"
                        onClick={() => startEditMessage(idx)}
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: 8,
                          border: '1px solid var(--border-color)',
                          background: 'var(--surface-bg)',
                          color: 'var(--text-main)',
                          display: 'grid',
                          placeItems: 'center',
                          cursor: 'pointer',
                          padding: 0,
                        }}
                      >
                        <IconEdit size={16} />
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
        {pendingChoice?.options?.length ? (
          <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border-color)', background: 'var(--surface-bg)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {pendingChoice.options.map((o) => (
              <button
                key={`${o.id}-${o.name}`}
                type="button"
                onClick={() => selectPendingOption(o)}
                style={{
                  border: '1px solid var(--border-color)',
                  borderRadius: 999,
                  background: 'var(--input-bg)',
                  color: 'var(--text-main)',
                  padding: '6px 10px',
                  fontSize: 12,
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                {o.name}{o.dept ? ` · ${o.dept}` : ''}
              </button>
            ))}
          </div>
        ) : null}
        <div style={{ display: 'flex', gap: 8, padding: 12, borderTop: '1px solid var(--border-color)', background: 'var(--surface-bg)' }}>
          <input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') send(); }} placeholder="Type your queries here..." style={{ flex: 1, height: 36, borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-main)', padding: '0 10px', fontSize: 13, fontFamily: 'inherit' }} />
          <button type="button" onClick={send} style={{ height: 36, border: 'none', borderRadius: 8, background: '#2563eb', color: '#fff', padding: '0 14px', cursor: 'pointer', fontWeight: 700 }}>Send</button>
        </div>
      </div>
    </div>
  );
}








