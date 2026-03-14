import React from 'react';
import { useNavigate } from 'react-router-dom';
import { DEPARTMENTS, getMonthStats } from '../data/employees';
import { sortEmployeesWithPinnedFirst } from '../utils/employeeSort';

export default function Team({ employees, selectedEmployee, onSelectEmployee, selectedMonth, deptFilter, onDeptFilter, basePath = '/admin' }) {
  const navigate = useNavigate();
  const cleanBase = basePath.replace(/\/$/, '');
  const isDark = typeof document !== 'undefined' && document.body.getAttribute('data-theme') === 'dark';
  const panelBg = 'var(--surface-bg)';
  const inputBg = 'var(--input-bg)';
  const border = 'var(--border-color)';
  const textMain = 'var(--text-main)';
  const textMuted = 'var(--text-muted)';
  const textSoft = 'var(--text-soft)';

  const filtered = sortEmployeesWithPinnedFirst(
    employees.filter(
      (e) =>
        (deptFilter === 'All' || e.dept === deptFilter) &&
        e.displayName.trim().toLowerCase() !== 'admin'
    )
  );

  return (
    <div className="fade-in">
      {/* Header row */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 22, alignItems: 'center', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: textMain, flex: 1 }}>Team Members</h2>
        {['All', ...DEPARTMENTS.map(d => d.name)].map(f => (
          <button key={f} onClick={() => onDeptFilter(f)} style={{ padding: '6px 16px', borderRadius: 20, border: `1.5px solid ${deptFilter===f?'#2563eb':border}`, cursor: 'pointer', background: deptFilter===f?(isDark ? '#1e3a8a' : '#eff6ff'):panelBg, color: deptFilter===f?(isDark ? '#bfdbfe' : '#2563eb'):textMuted, fontWeight: deptFilter===f?600:400, fontSize: 13, fontFamily: 'inherit' }}>{f}</button>
        ))}
      </div>

      {/* Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(230px,1fr))', gap: 16 }}>
        {filtered.map(emp => {
          const stats  = getMonthStats(emp, selectedMonth);
          const rate   = stats.total > 0 ? Math.round(stats.present / stats.total * 100) : 0;
          const active = selectedEmployee?.id === emp.id;
          const normalizedName = emp.displayName.trim().toLowerCase();
          const isPinnedName = normalizedName === 'raghavendra g shetty' || normalizedName === 'raghavendra g setty';
          const deptColor = emp.dept === 'MGMT' ? { bg: '#dbeafe', fg: '#1d4ed8' }
                          : emp.dept === 'IT'   ? { bg: '#f3e8ff', fg: '#7c3aed' }
                          : { bg: '#dcfce7', fg: '#16a34a' };
          return (
            <div
              key={emp.id}
              onClick={() => { onSelectEmployee(emp); navigate(`${cleanBase}/attendance`); }}
              style={{
                background: panelBg, borderRadius: 14, padding: 20, cursor: 'pointer',
                boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
                border: active ? '2px solid #2563eb' : `2px solid ${border}`,
                transition: 'transform 0.15s, box-shadow 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 18px rgba(37,99,235,0.14)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 1px 6px rgba(0,0,0,0.06)'; }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <div style={{ width: 46, height: 46, borderRadius: '50%', background: `hsl(${parseInt(emp.id)*47%360},58%,52%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 18, fontWeight: 700, flexShrink: 0 }}>
                  {emp.displayName[0]}
                </div>
                <div>
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: 14,
                      color: textMain,
                      marginBottom: 4,
                      display: 'inline-block',
                      padding: isPinnedName ? '2px 8px' : 0,
                      borderRadius: isPinnedName ? 8 : 0,
                      border: isPinnedName ? '1.5px solid #2563eb' : 'none',
                      background: isPinnedName ? (isDark ? '#1e3a8a' : '#eff6ff') : 'transparent',
                    }}
                  >
                    {emp.displayName}
                  </div>
                  <span style={{ background: deptColor.bg, color: deptColor.fg, padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>{emp.dept}</span>
                </div>
              </div>
              <div style={{ fontSize: 12, color: textSoft, marginBottom: 6 }}>Attendance this month</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ flex: 1, height: 6, background: inputBg, borderRadius: 3 }}>
                  <div style={{ width: rate + '%', height: '100%', background: rate >= 90 ? '#16a34a' : rate >= 75 ? '#f59e0b' : '#ef4444', borderRadius: 3, transition: 'width 0.5s ease' }} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: rate >= 90 ? '#16a34a' : rate >= 75 ? '#f59e0b' : '#ef4444' }}>{rate}%</span>
              </div>
              <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
                <span style={{ color: '#16a34a' }}>OK {stats.present} present</span>
                <span style={{ color: '#ef4444' }}>X {stats.absent} absent</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

