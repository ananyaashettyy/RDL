import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const NAV = [];

export default function Sidebar({ employees, selectedEmployee, onSelectEmployee, collapsed, onToggle, onLogout, theme }) {
  const location = useLocation();
  const navigate = useNavigate();
  const isDark = theme === 'dark';

  return (
    <div style={{
      width: collapsed ? 64 : 220,
      minWidth: collapsed ? 64 : 220,
      background: 'var(--surface-bg)',
      borderRight: '1px solid var(--border-color)',
      display: 'flex',
      flexDirection: 'column',
      transition: 'width 0.22s ease',
      overflow: 'hidden',
    }}>
      {/* Logo */}
      <div style={{ padding: '16px 14px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--border-color)' }}>
        <img
          src="/logo.jpg"
          alt="AttendIQ Logo"
          style={{ width: 36, height: 36, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }}
        />
        {!collapsed && <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>AttendIQ</span>}
        <div style={{ marginLeft: 'auto' }}>
          <button
            onClick={onLogout}
            title="Logout"
            style={{
              border: 'none',
              background: '#ef4444',
              color: '#fff',
              borderRadius: 8,
              padding: collapsed ? '7px 8px' : '7px 10px',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 700,
              lineHeight: 1,
            }}
          >
            {collapsed ? '↪' : 'Logout'}
          </button>
        </div>
      </div>

      {/* Team label */}
      {!collapsed && (
        <div style={{ padding: '10px 16px 4px', fontSize: 11, fontWeight: 600, color: 'var(--text-soft)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Team</div>
      )}

      {/* Employee list */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        {employees.map(emp => {
          const active = selectedEmployee?.id === emp.id;
          return (
            <div
              key={emp.id}
              onClick={() => { onSelectEmployee(emp); navigate('/attendance'); }}
              title={emp.displayName}
              style={{
                padding: collapsed ? '10px 14px' : '8px 14px',
                cursor: 'pointer', borderRadius: 8, margin: '1px 6px',
                background: active ? (isDark ? '#1e3a8a' : '#eff6ff') : 'transparent',
                color: active ? (isDark ? '#bfdbfe' : '#2563eb') : 'var(--text-muted)',
                fontSize: 13, fontWeight: active ? 600 : 400,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                display: 'flex', alignItems: 'center', gap: 8,
                transition: 'background 0.12s',
              }}
            >
              <div style={{
                width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                background: `hsl(${parseInt(emp.id) * 47 % 360},58%,52%)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 11, fontWeight: 700,
              }}>{emp.displayName[0]}</div>
              {!collapsed && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{emp.displayName}</span>}
            </div>
          );
        })}
      </div>

      {/* Nav links */}
      <div style={{ borderTop: '1px solid var(--border-color)', padding: '8px 6px' }}>
        {NAV.map(item => {
          const active = location.pathname === item.path;
          return (
            <div
              key={item.path}
              onClick={() => navigate(item.path)}
              title={item.label}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 10px', borderRadius: 8, cursor: 'pointer',
                background: active ? (isDark ? '#1e3a8a' : '#eff6ff') : 'transparent',
                color: active ? (isDark ? '#bfdbfe' : '#2563eb') : 'var(--text-muted)',
                fontSize: 13, fontWeight: active ? 600 : 400,
                transition: 'background 0.12s', marginBottom: 2,
              }}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d={item.icon} />
              </svg>
              {!collapsed && item.label}
            </div>
          );
        })}
        {/* Collapse toggle */}
        <div
          onClick={onToggle}
          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 8, cursor: 'pointer', color: 'var(--text-soft)', fontSize: 13, marginTop: 2 }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d={collapsed ? 'M9 18l6-6-6-6' : 'M15 18l-6-6 6-6'} />
          </svg>
          {!collapsed && 'Collapse'}
        </div>
      </div>
    </div>
  );
}
