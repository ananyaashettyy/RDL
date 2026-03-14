import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  LineChart, Line, ResponsiveContainer,
} from 'recharts';
import { EMPLOYEES, DEPARTMENTS, MONTHS, getMonthStats } from '../data/attlogData';
import { sortEmployeesWithPinnedFirst } from '../utils/employeeSort';
import { evaluateLateEarly, getAttendanceRuleConfig, parseTimeToMinutes } from '../utils/attendanceRules';

const pad = (n) => String(n).padStart(2, '0');

export default function Dashboard({ selectedMonth, onSelectEmployee, onMonthChange, basePath = '/admin', authPortal, employee }) {
  const isDark = typeof document !== 'undefined' && document.body.getAttribute('data-theme') === 'dark';
  const panelBg = 'var(--surface-bg)';
  const border = 'var(--border-color)';
  const textMain = 'var(--text-main)';
  const textMuted = 'var(--text-muted)';
  const textSoft = 'var(--text-soft)';
  const adminCardLabelColor = isDark ? '#334155' : '#cbd5e1';
  const adminCardNameColor = isDark ? '#0f172a' : '#e2e8f0';
  const gridStroke = isDark ? '#334155' : '#f1f5f9';
  const chartTick = isDark ? '#cbd5e1' : '#64748b';
  const ruleConfig = getAttendanceRuleConfig();
  const isUserPortal = authPortal === 'USER';

  const [mYear, mMonth] = selectedMonth.split('-').map(Number);
  const [eventView, setEventView] = useState(null);
  const [overtimeVisibleCount, setOvertimeVisibleCount] = useState(5);
  const eventPanelRef = useRef(null);

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
  const adminLateEarlyData = useMemo(() => sortedEmployees.map((emp) => {
    const recs = emp.attendance[selectedMonth] || [];
    return recs.reduce((acc, rec) => {
      if (rec.status !== 'present') return acc;
      const { isLateEntry, isEarlyExit } = evaluateLateEarly(rec, ruleConfig);
      const eventDate = new Date(mYear, mMonth - 1, rec.day);
      const entry = {
        day: eventDate.toLocaleDateString(undefined, { weekday: 'short' }),
        date: eventDate.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' }),
        lateTime: rec.inTime || '--',
        earlyTime: rec.logout || rec.outTime || '--',
      };

      if (isLateEntry) {
        acc.lateEvents.push({ day: entry.day, date: entry.date, time: entry.lateTime });
      }
      if (isEarlyExit) {
        acc.earlyEvents.push({ day: entry.day, date: entry.date, time: entry.earlyTime });
      }
      return acc;
    }, {
      empId: emp.id,
      name: emp.displayName,
      lateEvents: [],
      earlyEvents: [],
    });
  }), [mMonth, mYear, ruleConfig, selectedMonth, sortedEmployees]);
  const adminTopLate = useMemo(() => {
    if (!adminLateEarlyData.length) return null;
    return adminLateEarlyData.reduce(
      (best, row) => (row.lateEvents.length > best.lateEvents.length ? row : best),
      adminLateEarlyData[0]
    );
  }, [adminLateEarlyData]);
  const adminTopEarly = useMemo(() => {
    if (!adminLateEarlyData.length) return null;
    return adminLateEarlyData.reduce(
      (best, row) => (row.earlyEvents.length > best.earlyEvents.length ? row : best),
      adminLateEarlyData[0]
    );
  }, [adminLateEarlyData]);
  const adminOvertimeData = useMemo(() => sortedEmployees.map((emp) => {
    const recs = emp.attendance[selectedMonth] || [];
    const thresholdMins = parseTimeToMinutes(ruleConfig.earlyBefore) ?? (17 * 60);
    const totalMinutes = recs.reduce((sum, rec) => {
      if (rec.status !== 'present') return sum;
      const outMins = parseTimeToMinutes(rec.logout || rec.outTime);
      if (outMins === null || outMins <= thresholdMins) return sum;
      return sum + (outMins - thresholdMins);
    }, 0);
    const hh = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
    const mm = String(totalMinutes % 60).padStart(2, '0');
    return {
      empId: emp.id,
      name: emp.displayName,
      totalMinutes,
      duration: `${hh}:${mm}:00`,
    };
  }), [ruleConfig.earlyBefore, selectedMonth, sortedEmployees]);
  const adminTopOvertime = useMemo(() => {
    if (!adminOvertimeData.length) return null;
    return adminOvertimeData.reduce(
      (best, row) => (row.totalMinutes > best.totalMinutes ? row : best),
      adminOvertimeData[0]
    );
  }, [adminOvertimeData]);
  const adminLowestOvertime = useMemo(() => {
    const positive = adminOvertimeData.filter((row) => row.totalMinutes > 0);
    if (!positive.length) return null;
    return positive.reduce(
      (best, row) => (row.totalMinutes < best.totalMinutes ? row : best),
      positive[0]
    );
  }, [adminOvertimeData]);
  const myLateEarly = useMemo(() => {
    const recs = employee?.attendance?.[selectedMonth] || [];
    return recs.reduce((acc, rec) => {
      if (rec.status !== 'present') return acc;
      const { isLateEntry, isEarlyExit } = evaluateLateEarly(rec, ruleConfig);
      return {
        late: acc.late + (isLateEntry ? 1 : 0),
        early: acc.early + (isEarlyExit ? 1 : 0),
      };
    }, { late: 0, early: 0 });
  }, [employee, selectedMonth, ruleConfig]);

  const myOvertimeRows = useMemo(() => {
    const recs = employee?.attendance?.[selectedMonth] || [];
    const thresholdMins = parseTimeToMinutes(ruleConfig.earlyBefore) ?? (17 * 60);
    return recs.reduce((acc, rec) => {
      if (rec.status !== 'present') return acc;
      const outMins = parseTimeToMinutes(rec.logout || rec.outTime);
      if (outMins === null || outMins <= thresholdMins) return acc;
      const extra = outMins - thresholdMins;
      const hh = String(Math.floor(extra / 60)).padStart(2, '0');
      const mm = String(extra % 60).padStart(2, '0');
      const eventDate = new Date(mYear, mMonth - 1, rec.day);
      acc.push({
        key: `ot-${rec.day}`,
        day: eventDate.toLocaleDateString(undefined, { weekday: 'short' }),
        date: eventDate.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' }),
        duration: `${hh}:${mm}:00`,
      });
      return acc;
    }, []);
  }, [employee, mMonth, mYear, ruleConfig.earlyBefore, selectedMonth]);

  useEffect(() => {
    setOvertimeVisibleCount(5);
  }, [selectedMonth, employee?.id]);

  const myLateEarlyEvents = useMemo(() => {
    const recs = employee?.attendance?.[selectedMonth] || [];
    return recs.reduce((acc, rec) => {
      if (rec.status !== 'present') return acc;
      const { isLateEntry, isEarlyExit } = evaluateLateEarly(rec, ruleConfig);
      const eventDate = new Date(mYear, mMonth - 1, rec.day);
      const day = eventDate.toLocaleDateString(undefined, { weekday: 'short' });
      const date = eventDate.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
      if (isLateEntry) {
        acc.late.push({ day, date, time: rec.inTime || '--' });
      }
      if (isEarlyExit) {
        acc.early.push({ day, date, time: rec.logout || rec.outTime || '--' });
      }
      return acc;
    }, { late: [], early: [] });
  }, [employee, mMonth, mYear, ruleConfig, selectedMonth]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (!eventPanelRef.current) return;
      if (!eventPanelRef.current.contains(event.target)) {
        setEventView(null);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  return (
    <div className="fade-in">
      <div style={{ margin: '0 0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: textMain }}>
          Attendance Dashboard
        </h2>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 24 }}>
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
      {isUserPortal ? (
        <div style={{ background: panelBg, borderRadius: 14, padding: 20, boxShadow: '0 1px 6px rgba(0,0,0,0.06)', border: `1px solid ${border}` }}>
          <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 600, color: textMain }}>Late Entry / Early Exit</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
            <div style={{ border: `1px solid ${border}`, borderRadius: 12, padding: 16, background: isDark ? '#111827' : '#fff7ed' }}>
              <div style={{ fontSize: 12, color: textMuted, marginBottom: 8 }}>Late Entries</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#f59e0b' }}>{myLateEarly.late}</div>
            </div>
            <div style={{ border: `1px solid ${border}`, borderRadius: 12, padding: 16, background: isDark ? '#111827' : '#fff1f2' }}>
              <div style={{ fontSize: 12, color: textMuted, marginBottom: 8 }}>Early Exits</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#ea580c' }}>{myLateEarly.early}</div>
            </div>
          </div>
          <div style={{ marginTop: 10, fontSize: 12, color: textMuted }}>
            Rule: late after <strong>{ruleConfig.lateAfter}</strong>, early exit before <strong>{ruleConfig.earlyBefore}</strong>.
          </div>
          <div ref={eventPanelRef} style={{ marginTop: 14 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setEventView('late')}
              style={{ border: 'none', borderRadius: 8, background: eventView === 'late' ? '#f59e0b' : '#e2e8f0', color: eventView === 'late' ? '#fff' : '#334155', padding: '8px 12px', fontWeight: 600, cursor: 'pointer' }}
            >
              Show Late Entry
            </button>
            <button
              type="button"
              onClick={() => setEventView('early')}
              style={{ border: 'none', borderRadius: 8, background: eventView === 'early' ? '#ea580c' : '#e2e8f0', color: eventView === 'early' ? '#fff' : '#334155', padding: '8px 12px', fontWeight: 600, cursor: 'pointer' }}
            >
              Show Early Exit
            </button>
            </div>
            {eventView && (
              <div style={{ marginTop: 10, border: `1px solid ${border}`, borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 100px', background: isDark ? '#1e293b' : '#f8fafc', fontSize: 12, fontWeight: 700, color: textMuted }}>
                  <div style={{ padding: '8px 10px' }}>Day</div>
                  <div style={{ padding: '8px 10px' }}>Date</div>
                  <div style={{ padding: '8px 10px' }}>Time</div>
                </div>
                {(eventView === 'late' ? myLateEarlyEvents.late : myLateEarlyEvents.early).length === 0 ? (
                  <div style={{ padding: '10px', fontSize: 12, color: textMuted }}>
                    No {eventView === 'late' ? 'late entry' : 'early exit'} records in this month.
                  </div>
                ) : (
                  (eventView === 'late' ? myLateEarlyEvents.late : myLateEarlyEvents.early).map((row, idx) => (
                    <div key={`${eventView}-${row.date}-${idx}`} style={{ display: 'grid', gridTemplateColumns: '100px 1fr 100px', fontSize: 12, borderTop: `1px solid ${border}` }}>
                      <div style={{ padding: '8px 10px', color: textMain }}>{row.day}</div>
                      <div style={{ padding: '8px 10px', color: textMain }}>{row.date}</div>
                      <div style={{ padding: '8px 10px', color: textMain, fontWeight: 600 }}>{row.time}</div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
          <div style={{ marginTop: 16, borderTop: `1px solid ${border}`, paddingTop: 12 }}>
            <h4 style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: textMain }}>Overtime</h4>
            <div style={{ fontSize: 12, color: textMuted, marginBottom: 8 }}>
              Extra time after <strong>{ruleConfig.earlyBefore}</strong> (HH:MM:SS)
            </div>
            <div style={{ border: `1px solid ${border}`, borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr 110px', background: isDark ? '#1e293b' : '#f8fafc', fontSize: 12, fontWeight: 700, color: textMuted }}>
                <div style={{ padding: '8px 10px' }}>Day</div>
                <div style={{ padding: '8px 10px' }}>Date</div>
                <div style={{ padding: '8px 10px' }}>Duration</div>
              </div>
              {myOvertimeRows.length === 0 ? (
                <div style={{ padding: '10px', fontSize: 12, color: textMuted }}>No overtime records in this month.</div>
              ) : (
                myOvertimeRows.slice(0, overtimeVisibleCount).map((row) => (
                  <div key={row.key} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 110px', borderTop: `1px solid ${border}`, fontSize: 12 }}>
                    <div style={{ padding: '8px 10px', color: textMain }}>{row.day}</div>
                    <div style={{ padding: '8px 10px', color: textMain }}>{row.date}</div>
                    <div style={{ padding: '8px 10px', color: textMain, fontWeight: 700 }}>{row.duration}</div>
                  </div>
                ))
              )}
            </div>
            {myOvertimeRows.length > overtimeVisibleCount && (
              <div style={{ marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setOvertimeVisibleCount((c) => c + 5)}
                  style={{ border: '1px solid #cbd5e1', borderRadius: 8, background: '#f8fafc', color: '#334155', padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                >
                  Load More
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div style={{ background: panelBg, borderRadius: 14, padding: 20, boxShadow: '0 1px 6px rgba(0,0,0,0.06)', border: `1px solid ${border}` }}>
          <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 600, color: textMain }}>Employee Late Entry / Early Exit</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
            <div style={{ border: `1px solid ${border}`, borderRadius: 12, padding: 14, background: isDark ? '#fef3c7' : '#1f2937' }}>
              <div style={{ fontSize: 12, color: adminCardLabelColor, marginBottom: 6 }}>Highest Late Entry</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: adminCardNameColor, marginBottom: 4 }}>
                {adminTopLate?.name || 'N/A'}
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#f59e0b' }}>
                {adminTopLate?.lateEvents.length ?? 0}
              </div>
            </div>
            <div style={{ border: `1px solid ${border}`, borderRadius: 12, padding: 14, background: isDark ? '#fee2e2' : '#1f2937' }}>
              <div style={{ fontSize: 12, color: adminCardLabelColor, marginBottom: 6 }}>Highest Early Exit</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: adminCardNameColor, marginBottom: 4 }}>
                {adminTopEarly?.name || 'N/A'}
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#dc2626' }}>
                {adminTopEarly?.earlyEvents.length ?? 0}
              </div>
            </div>
            <div style={{ border: `1px solid ${border}`, borderRadius: 12, padding: 14, background: isDark ? '#dcfce7' : '#0f172a' }}>
              <div style={{ fontSize: 12, color: adminCardLabelColor, marginBottom: 6 }}>Highest Overtime</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: adminCardNameColor, marginBottom: 4 }}>
                {adminTopOvertime?.name || 'N/A'}
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#16a34a' }}>
                {adminTopOvertime?.duration || '00:00:00'}
              </div>
            </div>
            <div style={{ border: `1px solid ${border}`, borderRadius: 12, padding: 14, background: isDark ? '#e0f2fe' : '#111827' }}>
              <div style={{ fontSize: 12, color: adminCardLabelColor, marginBottom: 6 }}>Lowest Overtime</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: adminCardNameColor, marginBottom: 4 }}>
                {adminLowestOvertime?.name || 'N/A'}
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#0284c7' }}>
                {adminLowestOvertime?.duration || '00:00:00'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

