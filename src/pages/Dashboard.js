import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  LineChart, Line, ResponsiveContainer,
} from 'recharts';
import { EMPLOYEES, DEPARTMENTS, MONTHS, getMonthStats } from '../data/attlogData';
import { sortEmployeesWithPinnedFirst } from '../utils/employeeSort';

const pad = (n) => String(n).padStart(2, '0');

export default function Dashboard({ selectedMonth, onSelectEmployee, onMonthChange }) {
  const navigate = useNavigate();
  const isDark = typeof document !== 'undefined' && document.body.getAttribute('data-theme') === 'dark';
  const panelBg = 'var(--surface-bg)';
  const inputBg = 'var(--input-bg)';
  const border = 'var(--border-color)';
  const textMain = 'var(--text-main)';
  const textMuted = 'var(--text-muted)';
  const textSoft = 'var(--text-soft)';
  const gridStroke = isDark ? '#334155' : '#f1f5f9';
  const chartTick = isDark ? '#cbd5e1' : '#64748b';
  const tableHover = isDark ? '#1f2937' : '#f8fafc';

  const [mYear, mMonth] = selectedMonth.split('-').map(Number);
  const monthLabel = `${MONTHS[mMonth - 1]} ${mYear}`;
  const years = Array.from({ length: 5 }, (_, i) => mYear - 2 + i);

  const handleYearChange = (e) => {
    onMonthChange?.(`${e.target.value}-${pad(mMonth)}`);
  };

  const handleMonthChange = (e) => {
    onMonthChange?.(`${mYear}-${pad(Number(e.target.value))}`);
  };

  const stats = useMemo(() => {
    let present = 0, absent = 0;
    EMPLOYEES.forEach(e => {
      const s = getMonthStats(e, selectedMonth);
      present += s.present;
      absent  += s.absent;
    });
    const total = present + absent;
    return { present, absent, rate: total > 0 ? (present / total * 100).toFixed(1) : '0.0' };
  }, [selectedMonth]);

  const topByMonth = useMemo(() => {
    const rows = EMPLOYEES.map((emp) => {
      const s = getMonthStats(emp, selectedMonth);
      return { emp, ...s };
    });
    const rowsWithData = rows.filter((r) => r.total > 0);
    if (rowsWithData.length === 0) {
      return {
        mostPresentName: 'N/A',
        mostPresentDays: 0,
        mostAbsentName: 'N/A',
        mostAbsentDays: 0,
      };
    }

    const mostPresent = rowsWithData.reduce((best, curr) => curr.present > best.present ? curr : best, rowsWithData[0]);
    const mostAbsent = rowsWithData.reduce((best, curr) => curr.absent > best.absent ? curr : best, rowsWithData[0]);

    return {
      mostPresentName: mostPresent.emp.displayName,
      mostPresentDays: mostPresent.present,
      mostAbsentName: mostAbsent.emp.displayName,
      mostAbsentDays: mostAbsent.absent,
    };
  }, [selectedMonth]);

  const deptStats = useMemo(() => DEPARTMENTS.map(d => {
    const emps = EMPLOYEES.filter(e => e.dept === d.name);
    const p = emps.reduce((a, e) => a + getMonthStats(e, selectedMonth).present, 0);
    const ab = emps.reduce((a, e) => a + getMonthStats(e, selectedMonth).absent, 0);
    return { name: d.name, Present: p, Absent: ab };
  }), [selectedMonth]);

  const trend = useMemo(() => {
    const keys = [];
    for (let i = 6; i >= 0; i--) {
      let y = mYear;
      let m = mMonth - i;
      while (m <= 0) {
        m += 12;
        y -= 1;
      }
      keys.push(`${y}-${pad(m)}`);
    }

    return keys.map((monthKey) => {
      const p = EMPLOYEES.reduce((a, e) => a + getMonthStats(e, monthKey).present, 0);
      const ab = EMPLOYEES.reduce((a, e) => a + getMonthStats(e, monthKey).absent, 0);
      const total = p + ab;
      const [y, m] = monthKey.split('-').map(Number);
      return {
        month: `${MONTHS[m - 1].slice(0, 3)} ${y}`,
        rate: total > 0 ? +(p / total * 100).toFixed(1) : 0,
      };
    });
  }, [mMonth, mYear]);

  const kpis = [
    { label: 'Total Employees',    value: EMPLOYEES.length,  color: '#2563eb', bg: '#eff6ff' },
    { label: 'Departments',        value: DEPARTMENTS.length, color: '#7c3aed', bg: '#f5f3ff' },
    { label: 'Most Present',       value: topByMonth.mostPresentName, detail: `${topByMonth.mostPresentDays} days`, color: '#16a34a', bg: '#f0fdf4' },
    { label: 'Most Absent',        value: topByMonth.mostAbsentName, detail: `${topByMonth.mostAbsentDays} days`, color: '#ef4444', bg: '#fef2f2' },
  ];

  const sortedEmployees = useMemo(() => sortEmployeesWithPinnedFirst(EMPLOYEES), []);

  return (
    <div className="fade-in">
      <div style={{ margin: '0 0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: textMain }}>
          Attendance Dashboard
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <select
            value={mMonth}
            onChange={handleMonthChange}
            style={{
              padding: '6px 10px', borderRadius: 8, border: `1px solid ${border}`,
              fontSize: 13, color: textMuted, background: inputBg, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {MONTHS.map((month, idx) => (
              <option key={month} value={idx + 1}>{month}</option>
            ))}
          </select>
          <select
            value={mYear}
            onChange={handleYearChange}
            style={{
              padding: '6px 10px', borderRadius: 8, border: `1px solid ${border}`,
              fontSize: 13, color: textMuted, background: inputBg, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {years.map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 16, marginBottom: 24 }}>
        {kpis.map((k, i) => (
          <div key={i} style={{ background: panelBg, borderRadius: 14, padding: '18px 20px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)', borderLeft: `4px solid ${k.color}`, border: `1px solid ${border}` }}>
            <div style={{ fontSize: 12, color: textSoft, fontWeight: 500, marginBottom: 8 }}>{k.label}</div>
            <div style={{ fontSize: typeof k.value === 'number' ? 30 : 20, fontWeight: 700, color: k.color, lineHeight: 1.2 }}>{k.value}</div>
            {k.detail && <div style={{ marginTop: 4, fontSize: 12, color: textMuted }}>{k.detail}</div>}
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ background: panelBg, borderRadius: 14, padding: 20, boxShadow: '0 1px 6px rgba(0,0,0,0.06)', border: `1px solid ${border}` }}>
          <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 600, color: textMain }}>Department-wise Attendance</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={deptStats}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: chartTick }} />
              <YAxis tick={{ fontSize: 12, fill: chartTick }} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 13, background: panelBg, border: `1px solid ${border}`, color: textMain }} />
              <Legend wrapperStyle={{ fontSize: 12, color: chartTick }} />
              <Bar dataKey="Present" fill="#2563eb" radius={[4,4,0,0]} />
              <Bar dataKey="Absent"  fill="#fca5a5" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Trend */}
      <div style={{ background: panelBg, borderRadius: 14, padding: 20, boxShadow: '0 1px 6px rgba(0,0,0,0.06)', marginBottom: 20, border: `1px solid ${border}` }}>
        <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 600, color: textMain }}>Monthly Attendance Trend (%)</h3>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={trend}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: chartTick }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: chartTick }} />
            <Tooltip formatter={v => v + '%'} contentStyle={{ borderRadius: 8, fontSize: 13, background: panelBg, border: `1px solid ${border}`, color: textMain }} />
            <Line type="monotone" dataKey="rate" stroke="#2563eb" strokeWidth={2.5} dot={{ fill: '#2563eb', r: 4 }} name="Attendance %" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Employee table */}
      <div style={{ background: panelBg, borderRadius: 14, padding: 20, boxShadow: '0 1px 6px rgba(0,0,0,0.06)', border: `1px solid ${border}` }}>
        <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 600, color: textMain }}>Employee Attendance Overview</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${border}` }}>
                {['ID','Name','Department','Present','Absent','Rate'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: textMuted, fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedEmployees.slice(0, 12).map(emp => {
                const s    = getMonthStats(emp, selectedMonth);
                const rate = s.total > 0 ? Math.round(s.present / s.total * 100) : 0;
                return (
                  <tr key={emp.id}
                    onClick={() => { onSelectEmployee(emp); navigate('/attendance'); }}
                    style={{ borderBottom: `1px solid ${border}`, cursor: 'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.background = tableHover}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '10px 12px', color: textSoft }}>{emp.id}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 500, color: textMain }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: `hsl(${parseInt(emp.id)*47%360},58%,52%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 700 }}>{emp.displayName[0]}</div>
                        {emp.displayName}
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ background: emp.dept === 'MGMT' ? '#dbeafe' : emp.dept === 'IT' ? '#f3e8ff' : '#dcfce7', color: emp.dept === 'MGMT' ? '#1d4ed8' : emp.dept === 'IT' ? '#7c3aed' : '#16a34a', padding: '2px 8px', borderRadius: 6, fontSize: 12, fontWeight: 500 }}>{emp.dept}</span>
                    </td>
                    <td style={{ padding: '10px 12px', color: '#16a34a', fontWeight: 600 }}>{s.present}</td>
                    <td style={{ padding: '10px 12px', color: s.absent > 2 ? '#ef4444' : textMuted, fontWeight: s.absent > 2 ? 600 : 400 }}>{s.absent}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 6, background: isDark ? '#334155' : '#e2e8f0', borderRadius: 3 }}>
                          <div style={{ width: rate + '%', height: '100%', background: rate >= 90 ? '#16a34a' : rate >= 75 ? '#f59e0b' : '#ef4444', borderRadius: 3 }} />
                        </div>
                        <span style={{ fontSize: 12, color: textMuted, minWidth: 34 }}>{rate}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

