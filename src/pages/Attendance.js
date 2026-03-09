import React, { useEffect, useRef, useState } from 'react';
import { MONTHS, NATIONAL_HOLIDAYS } from '../data/employees';
import { getLeavesForEmployeeMonth, setLeaveForDate } from '../utils/leaveStorage';

const pad = (n) => String(n).padStart(2, '0');
const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function Attendance({ employee, selectedMonth, onMonthChange }) {
  const [year, setYear] = useState(2025);
  const [month, setMonth] = useState(12);
  const [leaves, setLeaves] = useState({});
  const lastTapRef = useRef({});

  useEffect(() => {
    const [y, m] = selectedMonth.split('-').map(Number);
    setYear(y);
    setMonth(m);
  }, [selectedMonth]);

  useEffect(() => {
    if (!employee?.id) return;
    setLeaves(getLeavesForEmployeeMonth(employee.id, selectedMonth));
  }, [employee?.id, selectedMonth]);

  if (!employee) {
    return <div style={{ padding: 40, color: '#94a3b8' }}>Select an employee from the sidebar.</div>;
  }

  const [yr, mo] = selectedMonth.split('-').map(Number);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const records = employee.attendance[selectedMonth] || [];
  const daysInMonth = new Date(yr, mo, 0).getDate();
  const firstDay = new Date(yr, mo - 1, 1).getDay();
  const calendarDays = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  const handleDateDoubleClick = (day) => {
    const dateStr = `${yr}-${pad(mo)}-${pad(day)}`;
    const choice = window.prompt('Select leave type:\n1 - Paid Leave\n2 - Training/Other Work Leave\n3 - Earned Leave\n0 - Clear leave mark', '1');
    if (choice === null) return;

    setLeaves((prev) => {
      const next = { ...prev };
      if (choice === '1') {
        next[dateStr] = 'paid';
        setLeaveForDate(employee.id, dateStr, 'paid');
      } else if (choice === '2') {
        next[dateStr] = 'training';
        setLeaveForDate(employee.id, dateStr, 'training');
      } else if (choice === '3') {
        next[dateStr] = 'earned';
        setLeaveForDate(employee.id, dateStr, 'earned');
      } else if (choice === '0') {
        delete next[dateStr];
        setLeaveForDate(employee.id, dateStr, null);
      }
      return next;
    });
  };

  const handleDateTouchEnd = (day) => {
    const now = Date.now();
    const last = lastTapRef.current[day] || 0;
    if (now - last < 300) {
      handleDateDoubleClick(day);
      lastTapRef.current[day] = 0;
      return;
    }
    lastTapRef.current[day] = now;
  };

  const getDateStatus = (day) => {
    const dateStr = `${yr}-${pad(mo)}-${pad(day)}`;
    const date = new Date(yr, mo - 1, day);
    const rec = records.find((r) => r.day === day);

    if (NATIONAL_HOLIDAYS[dateStr]) return 'national-holiday';
    // Weekend policy: only Sunday is a weekend (Saturday is a working day)
    if (date.getDay() === 0 || rec?.status === 'weekend') return 'weekend';
    if (date > today) return 'future';
    if (leaves[dateStr] === 'paid') return 'paid-leave';
    if (leaves[dateStr] === 'earned') return 'earned-leave';
    if (leaves[dateStr] === 'training') return 'training-leave';
    if (!rec) return 'no-data';
    if (rec?.status === 'present') return 'present';
    if (rec?.status === 'absent') return 'absent';
    return 'normal';
  };

  const getDayColor = (day) => {
    const status = getDateStatus(day);
    if (status === 'future') return '#ffffff';
    if (status === 'no-data') return '#ffffff';
    if (status === 'present') return '#16a34a';
    if (status === 'absent') return '#ef4444';
    if (status === 'weekend') return '#6b7280';
    if (status === 'national-holiday') return '#a16207';
    if (status === 'paid-leave') return '#7c3aed';
    if (status === 'earned-leave') return '#ec4899';
    if (status === 'training-leave') return '#0ea5e9';
    return '#64748b';
  };

  const getDayBackground = (status) => {
    if (status === 'future') return '#ffffff';
    if (status === 'no-data') return '#ffffff';
    if (status === 'present') return '#dcfce7';
    if (status === 'absent') return '#fee2e2';
    if (status === 'weekend') return '#f3f4f6';
    if (status === 'national-holiday') return '#fef3c7';
    if (status === 'paid-leave') return '#f3e8ff';
    if (status === 'earned-leave') return '#fce7f3';
    if (status === 'training-leave') return '#e0f2fe';
    return '#f1f5f9';
  };

  const handleMonthChange = (delta) => {
    let newMonth = month + delta;
    let newYear = year;

    if (newMonth > 12) {
      newMonth = 1;
      newYear++;
    } else if (newMonth < 1) {
      newMonth = 12;
      newYear--;
    }

    onMonthChange(`${newYear}-${pad(newMonth)}`);
  };

  return (
    <div className="fade-in">
      <div style={{ background: '#2563eb', borderRadius: 12, padding: '14px 22px', marginBottom: 20, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{employee.displayName}</h2>
        <span style={{ fontSize: 12, color: '#dbeafe' }}>Calendar View</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <button onClick={() => handleMonthChange(-1)} style={{ background: '#e2e8f0', border: 'none', width: 32, height: 32, borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>{'<'}</button>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{MONTHS[month - 1]} {year}</h3>
              <button onClick={() => handleMonthChange(1)} style={{ background: '#e2e8f0', border: 'none', width: 32, height: 32, borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>{'>'}</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 8 }}>
              {DAYS_SHORT.map((d) => (
                <div key={d} style={{ textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#64748b', padding: '6px 0' }}>{d}</div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
              {calendarDays.map((day, i) => {
                if (day === null) return <div key={`empty-${i}`} />;

                const status = getDateStatus(day);
                const color = getDayColor(day);
                const dateStr = `${yr}-${pad(mo)}-${pad(day)}`;
                const leave = leaves[dateStr];
                const title = leave === 'paid'
                  ? 'Paid Leave'
                  : leave === 'earned'
                    ? 'Earned Leave'
                    : leave === 'training'
                      ? 'Training/Other Work Leave'
                      : NATIONAL_HOLIDAYS[dateStr] || 'Double-click: 1 Paid, 2 Training/Other Work, 3 Earned, 0 Clear';

                return (
                  <div
                    key={day}
                    onDoubleClick={() => handleDateDoubleClick(day)}
                    onTouchEnd={() => handleDateTouchEnd(day)}
                    title={title}
                    style={{
                      padding: 12,
                      borderRadius: 8,
                      background: getDayBackground(status),
                      border: status === 'future' || status === 'no-data' ? '2px solid #000000' : `2px solid ${color}`,
                      textAlign: 'center',
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: 14,
                      color: status === 'future' || status === 'no-data' ? '#0f172a' : color,
                      transition: 'all 0.2s',
                    }}
                  >
                    {day}
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #e2e8f0', fontSize: 12, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {[
                ['Present', '#16a34a'],
                ['Absent', '#ef4444'],
                ['Weekend', '#6b7280'],
                ['National Holiday', '#a16207'],
                ['Paid Leave', '#7c3aed'],
                ['Earned Leave', '#ec4899'],
                ['Training/Other Work Leave', '#0ea5e9'],
              ].map(([label, color]) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 12, height: 12, borderRadius: 2, background: color }} />
                  <span style={{ color: '#475569' }}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div style={{ background: '#fff', borderRadius: 14, padding: 16, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: 13, fontWeight: 700, color: '#1e293b' }}>Leaves and Holidays</h4>
              <div style={{ maxHeight: 200, overflowY: 'auto', fontSize: 12 }}>
                {Object.entries(NATIONAL_HOLIDAYS).filter(([date]) => date.startsWith(`${yr}-${pad(mo)}`)).map(([date, name]) => (
                  <div key={date} style={{ padding: '6px 0', borderBottom: '1px solid #f1f5f9', color: '#1d4ed8' }}>
                    <span style={{ fontWeight: 600 }}>{date.split('-')[2]}</span> - {name}
                  </div>
                ))}
                {Object.entries(leaves).filter(([date]) => date.startsWith(`${yr}-${pad(mo)}`)).map(([date, type]) => (
                  <div key={date} style={{ padding: '6px 0', borderBottom: '1px solid #f1f5f9', color: type === 'paid' ? '#7c3aed' : type === 'earned' ? '#ec4899' : '#0ea5e9' }}>
                    <span style={{ fontWeight: 600 }}>{date.split('-')[2]}</span> - {type === 'paid' ? 'Paid Leave' : type === 'earned' ? 'Earned Leave' : 'Training/Other Work Leave'}
                  </div>
                ))}
              </div>
            </div>
          </div>
      </div>
    </div>
  );
}
