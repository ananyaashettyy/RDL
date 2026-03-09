import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const TABS = [
  { path: '/home',       label: 'Dashboard'  },
  { path: '/attendance', label: 'Attendance' },
  { path: '/report',     label: 'Report' },
  { path: '/masters',    label: 'Masters'    },
  { path: '/team',       label: 'Team'       },
  { path: '/admin',      label: 'Admin'      },
];

export default function TopBar({ search, onSearch, selectedMonth, onMonthChange, theme, onToggleTheme }) {
  const navigate  = useNavigate();
  const location  = useLocation();
  const isDark = theme === 'dark';

  const [currentYear, currentMonth] = selectedMonth.split('-').map(Number);
  // Generate year and month options
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  const handleYearChange = (e) => {
    const newMonth = String(currentMonth).padStart(2, '0');
    onMonthChange(`${e.target.value}-${newMonth}`);
  };

  const handleMonthChange = (e) => {
    const newMonth = String(e.target.value).padStart(2, '0');
    onMonthChange(`${currentYear}-${newMonth}`);
  };

  return (
    <div style={{
      background: 'var(--surface-bg)', borderBottom: '1px solid var(--border-color)',
      padding: '0 24px', display: 'flex', alignItems: 'center', gap: 4,
      height: 56, position: 'sticky', top: 0, zIndex: 100, flexShrink: 0,
    }}>
      {TABS.map(t => (
        <button
          key={t.path}
          onClick={() => navigate(t.path)}
          style={{
            padding: '6px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: location.pathname === t.path
              ? (t.path === '/admin' ? (isDark ? '#1e3a8a' : '#dbeafe') : '#2563eb')
              : (t.path === '/admin' ? (isDark ? '#172554' : '#eff6ff') : 'transparent'),
            color: location.pathname === t.path
              ? (t.path === '/admin' ? (isDark ? '#bfdbfe' : '#1d4ed8') : '#fff')
              : (t.path === '/admin' ? (isDark ? '#93c5fd' : '#2563eb') : 'var(--text-muted)'),
            border: t.path === '/admin'
              ? `1.5px solid ${location.pathname === t.path ? (isDark ? '#3b82f6' : '#93c5fd') : (isDark ? '#1d4ed8' : '#bfdbfe')}`
              : 'none',
            fontWeight: location.pathname === t.path ? 600 : 500,
            fontSize: 13, fontFamily: 'inherit',
          }}
        >{t.label}</button>
      ))}

      <div style={{ flex: 1 }} />

      {/* Search */}
      <div style={{ position: 'relative', marginRight: 8 }}>
        <svg style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-soft)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          value={search}
          onChange={e => onSearch(e.target.value)}
          placeholder="Search employee..."
          style={{
            paddingLeft: 30, paddingRight: 12, height: 34, borderRadius: 8,
            border: '1px solid var(--border-color)', outline: 'none', fontSize: 13,
            background: 'var(--input-bg)', color: 'var(--text-main)', width: 190, fontFamily: 'inherit',
          }}
        />
      </div>

      {/* Month/Year pickers */}
      <select
        value={currentMonth}
        onChange={handleMonthChange}
        style={{
          padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border-color)',
          fontSize: 13, color: 'var(--text-muted)', background: 'var(--input-bg)', cursor: 'pointer',
          fontFamily: 'inherit', marginRight: 8,
        }}
      >
        {months.map(m => (
          <option key={m} value={m}>
            {['January','February','March','April','May','June','July','August','September','October','November','December'][m - 1]}
          </option>
        ))}
      </select>

      <select
        value={currentYear}
        onChange={handleYearChange}
        style={{
          padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border-color)',
          fontSize: 13, color: 'var(--text-muted)', background: 'var(--input-bg)', cursor: 'pointer',
          fontFamily: 'inherit', marginRight: 8,
        }}
      >
        {years.map(y => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>

      {/* Theme toggle */}
      <button
        type="button"
        onClick={onToggleTheme}
        title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        style={{
          width: 34,
          height: 34,
          borderRadius: '50%',
          border: '1px solid var(--border-color)',
          background: isDark ? '#0f172a' : '#eff6ff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
        }}
      >
        {isDark ? (
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#f8fafc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.8A9 9 0 1111.2 3 7 7 0 0021 12.8z" />
          </svg>
        ) : (
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
          </svg>
        )}
      </button>
    </div>
  );
}

