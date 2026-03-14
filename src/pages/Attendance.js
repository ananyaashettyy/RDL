import React, { useEffect, useRef, useState } from 'react';
import { MONTHS, NATIONAL_HOLIDAYS } from '../data/employees';
import { addLeaveNotification, getLeaveNotifications, getLeavesForEmployeeMonth, setLeaveForDate, subscribeLeaves } from '../utils/leaveStorage';
import { evaluateLateEarly, getAttendanceRuleConfig } from '../utils/attendanceRules';

const pad = (n) => String(n).padStart(2, '0');
const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MAX_EARNED_LEAVES_PER_MONTH = 3;
const STATUS_LABELS = {
  present: 'Present',
  'late-or-early-present': 'Late/Early',
  absent: 'Absent',
  weekend: 'Weekend',
  'national-holiday': 'National Holiday',
  'paid-leave': 'Paid Leave',
  'earned-leave': 'Earned Leave',
  'training-leave': 'Training/Other Work Leave',
  future: 'Future Date',
  'no-data': 'No Data',
  normal: 'Normal',
};

export default function Attendance({ employee, selectedMonth, onMonthChange, authPortal, authUsername, showNotif }) {
  const panelBg = 'var(--surface-bg)';
  const border = 'var(--border-color)';
  const textMain = 'var(--text-main)';
  const textMuted = 'var(--text-muted)';
  const textSoft = 'var(--text-soft)';
  const lateEarlyTextColor = 'var(--hard-text)';
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

  useEffect(() => {
    if (!employee?.id) return () => {};
    return subscribeLeaves(() => {
      setLeaves(getLeavesForEmployeeMonth(employee.id, selectedMonth));
    });
  }, [employee?.id, selectedMonth]);

  if (!employee) {
    return <div style={{ padding: 40, color: textSoft }}>Select an employee from the sidebar.</div>;
  }

  const [yr, mo] = selectedMonth.split('-').map(Number);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const records = employee.attendance[selectedMonth] || [];
  const ruleConfig = getAttendanceRuleConfig();
  const lateEarlyRows = records.reduce((acc, rec) => {
    if (rec.status !== 'present') return acc;
    const { isLateEntry, isEarlyExit } = evaluateLateEarly(rec, ruleConfig);
    if (!isLateEntry && !isEarlyExit) return acc;

    const day = pad(rec.day);
    acc.push({
      key: `late-early-${day}`,
      day,
      lateTime: isLateEntry ? (rec.inTime || '--') : null,
      earlyTime: isEarlyExit ? (rec.logout || rec.outTime || '--') : null,
    });
    return acc;
  }, []);
  const daysInMonth = new Date(yr, mo, 0).getDate();
  const firstDay = new Date(yr, mo - 1, 1).getDay();
  const calendarDays = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  const handleDateDoubleClick = (day) => {
    const dateStr = `${yr}-${pad(mo)}-${pad(day)}`;
    const date = new Date(yr, mo - 1, day);
    if (NATIONAL_HOLIDAYS[dateStr]) {
      showNotif?.('Leave cannot be applied on national holidays.', 'error');
      return;
    }
    if (date.getDay() === 0) {
      showNotif?.('Leave cannot be applied on Sundays.', 'error');
      return;
    }

    const choice = window.prompt('Select leave type:\n1 - Paid Leave\n2 - Training/Other Work Leave\n3 - Earned Leave\n0 - Clear leave mark', '1');
    if (choice === null) return;

    const earnedApprovedDates = new Set(
      Object.entries(leaves)
        .filter(([, type]) => type === 'earned')
        .map(([date]) => date)
    );
    const isDateAlreadyApprovedEarned = earnedApprovedDates.has(dateStr);

    // In user portal, include pending earned leave requests so users cannot keep applying beyond 3.
    const earnedPendingDates = authPortal === 'USER'
      ? new Set(
        getLeaveNotifications()
          .filter((n) => (
            n.employeeId === employee.id
            && n.leaveType === 'Earned Leave'
            && n.status === 'pending'
            && typeof n.date === 'string'
            && n.date.startsWith(`${yr}-${pad(mo)}-`)
          ))
          .map((n) => n.date)
      )
      : new Set();

    const earnedAppliedDates = new Set([
      ...earnedApprovedDates,
      ...earnedPendingDates,
    ]);

    const showEarnedLimitPopup = () => {
      const msg = `${MAX_EARNED_LEAVES_PER_MONTH} earned leaves already applied for this month.`;
      window.alert(msg);
      showNotif?.(msg, 'error');
    };

    setLeaves((prev) => {
      const next = { ...prev };
      if (authPortal === 'USER') {
        if (choice === '1' || choice === '2' || choice === '3') {
          if (choice === '3' && !earnedAppliedDates.has(dateStr) && earnedAppliedDates.size >= MAX_EARNED_LEAVES_PER_MONTH) {
            showEarnedLimitPopup();
            return prev;
          }
          const leaveType = choice === '1'
            ? 'Paid Leave'
            : choice === '2'
              ? 'Training/Other Work Leave'
              : 'Earned Leave';
          addLeaveNotification({
            employeeId: employee.id,
            employeeName: employee.displayName,
            username: authUsername,
            date: dateStr,
            leaveType,
            appliedAt: new Date().toISOString(),
          });
          showNotif?.('Leave request sent to admin for approval.');
        } else if (choice === '0') {
          showNotif?.('User portal cannot clear approved leave directly. Contact admin.', 'error');
        }
        return prev;
      }

      if (choice === '1') {
        next[dateStr] = 'paid';
        setLeaveForDate(employee.id, dateStr, 'paid');
      } else if (choice === '2') {
        next[dateStr] = 'training';
        setLeaveForDate(employee.id, dateStr, 'training');
      } else if (choice === '3') {
        if (!isDateAlreadyApprovedEarned && earnedApprovedDates.size >= MAX_EARNED_LEAVES_PER_MONTH) {
          showEarnedLimitPopup();
          return prev;
        }
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
    if (rec?.status === 'present') {
      const { isLateEntry, isEarlyExit } = evaluateLateEarly(rec, ruleConfig);
      if (isLateEntry || isEarlyExit) return 'late-or-early-present';
      return 'present';
    }
    if (rec?.status === 'absent') return 'absent';
    return 'normal';
  };

  const getDayColor = (day) => {
    const status = getDateStatus(day);
    if (status === 'future') return panelBg;
    if (status === 'no-data') return panelBg;
    if (status === 'present') return '#16a34a';
    if (status === 'late-or-early-present') return '#334155';
    if (status === 'absent') return '#ef4444';
    if (status === 'weekend') return '#6b7280';
    if (status === 'national-holiday') return '#a16207';
    if (status === 'paid-leave') return '#7c3aed';
    if (status === 'earned-leave') return '#ec4899';
    if (status === 'training-leave') return '#0ea5e9';
    return '#64748b';
  };

  const getDayBackground = (status) => {
    if (status === 'future') return panelBg;
    if (status === 'no-data') return panelBg;
    if (status === 'present') return '#dcfce7';
    if (status === 'late-or-early-present') return '#e2e8f0';
    if (status === 'absent') return '#fee2e2';
    if (status === 'weekend') return '#f3f4f6';
    if (status === 'national-holiday') return '#fef3c7';
    if (status === 'paid-leave') return '#f3e8ff';
    if (status === 'earned-leave') return '#fce7f3';
    if (status === 'training-leave') return '#e0f2fe';
    return 'var(--input-bg)';
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

  const PHOTO_OVERRIDES = {
    'Vaishak K': 'Vaishakk',
  };

  const getFirstName = (name) => {
    const first = String(name || '').trim().split(/\s+/)[0] || '';
    const cleaned = first.replace(/[^a-zA-Z]/g, '');
    if (!cleaned) return '';
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
  };

  const photoKey = PHOTO_OVERRIDES[employee.displayName?.trim()] || getFirstName(employee.displayName);
  const photoSrc = photoKey ? `/Images/${photoKey}.png` : '';

  return (
    <div className="fade-in">
      <div style={{ background: '#2563eb', borderRadius: 12, padding: '14px 22px', marginBottom: 20, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {photoSrc ? (
            <img
              src={photoSrc}
              alt={employee.displayName}
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
              style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', background: '#fff' }}
            />
          ) : null}
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{employee.displayName}</h2>
        </div>
        <span style={{ fontSize: 12, color: '#dbeafe' }}>Calendar View</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, marginBottom: 20 }}>
          <div style={{ background: panelBg, borderRadius: 14, padding: 20, boxShadow: '0 1px 6px rgba(0,0,0,0.06)', border: `1px solid ${border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <button onClick={() => handleMonthChange(-1)} style={{ background: 'var(--input-bg)', border: `1px solid ${border}`, color: textMain, width: 32, height: 32, borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>{'<'}</button>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: textMain }}>{MONTHS[month - 1]} {year}</h3>
              <button onClick={() => handleMonthChange(1)} style={{ background: 'var(--input-bg)', border: `1px solid ${border}`, color: textMain, width: 32, height: 32, borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>{'>'}</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 8 }}>
              {DAYS_SHORT.map((d) => (
                <div key={d} style={{ textAlign: 'center', fontSize: 12, fontWeight: 700, color: textMuted, padding: '6px 0' }}>{d}</div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
              {calendarDays.map((day, i) => {
                if (day === null) return <div key={`empty-${i}`} />;

                const status = getDateStatus(day);
                const color = getDayColor(day);
                const dateStr = `${yr}-${pad(mo)}-${pad(day)}`;
                const leave = leaves[dateStr];
                const statusLabel = STATUS_LABELS[status] || status;
                const canApplyLeave = !NATIONAL_HOLIDAYS[dateStr] && new Date(yr, mo - 1, day).getDay() !== 0;
                const title = leave === 'paid'
                  ? 'Status: Paid Leave'
                  : leave === 'earned'
                    ? 'Status: Earned Leave'
                    : leave === 'training'
                      ? 'Status: Training/Other Work Leave'
                      : NATIONAL_HOLIDAYS[dateStr]
                        ? `Status: National Holiday (${NATIONAL_HOLIDAYS[dateStr]})`
                        : `Status: ${statusLabel}`;

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
                      border: status === 'future' || status === 'no-data' ? `2px solid ${textMain}` : `2px solid ${color}`,
                      textAlign: 'center',
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: 14,
                      color: status === 'future' || status === 'no-data' ? textMain : color,
                      transition: 'all 0.2s',
                    }}
                  >
                    {day}
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${border}`, fontSize: 12, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {[
                ['Present', '#16a34a'],
                ['Late/Early', '#334155'],
                ['Absent', '#ef4444'],
                ['Weekend', '#6b7280'],
                ['National Holiday', '#a16207'],
                ['Paid Leave', '#7c3aed'],
                ['Earned Leave', '#ec4899'],
                ['Training/Other Work Leave', '#0ea5e9'],
              ].map(([label, color]) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 12, height: 12, borderRadius: 2, background: color }} />
                  <span style={{ color: textMuted }}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div style={{ background: panelBg, borderRadius: 14, padding: 16, boxShadow: '0 1px 6px rgba(0,0,0,0.06)', border: `1px solid ${border}` }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: 13, fontWeight: 700, color: textMain }}>Leaves and Holidays</h4>
              <div style={{ maxHeight: 200, overflowY: 'auto', fontSize: 12 }}>
                {Object.entries(NATIONAL_HOLIDAYS).filter(([date]) => date.startsWith(`${yr}-${pad(mo)}`)).map(([date, name]) => (
                  <div key={date} style={{ padding: '6px 0', borderBottom: `1px solid ${border}`, color: '#a16207' }}>
                    <span style={{ fontWeight: 600 }}>{date.split('-')[2]}</span> - {name}
                  </div>
                ))}
                {Object.entries(leaves).filter(([date]) => date.startsWith(`${yr}-${pad(mo)}`)).map(([date, type]) => (
                  <div key={date} style={{ padding: '6px 0', borderBottom: `1px solid ${border}`, color: type === 'paid' ? '#7c3aed' : type === 'earned' ? '#ec4899' : '#0ea5e9' }}>
                    <span style={{ fontWeight: 600 }}>{date.split('-')[2]}</span> - {type === 'paid' ? 'Paid Leave' : type === 'earned' ? 'Earned Leave' : 'Training/Other Work Leave'} (Absent)
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${border}` }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: 13, fontWeight: 700, color: textMain }}>Late Entry / Early Exit</h4>
                <div style={{ maxHeight: 160, overflowY: 'auto', fontSize: 12 }}>
                  {lateEarlyRows.length === 0 ? (
                    <div style={{ color: lateEarlyTextColor, padding: '4px 0' }}>No late entry or early exit in this month.</div>
                  ) : (
                    lateEarlyRows.map((row) => (
                      <div
                        key={row.key}
                        style={{
                          padding: '6px 0',
                          borderBottom: `1px solid ${border}`,
                          color: lateEarlyTextColor,
                          display: 'grid',
                          gridTemplateColumns: '26px 10px minmax(140px, 1fr) minmax(140px, 1fr)',
                          columnGap: 14,
                          alignItems: 'center',
                        }}
                      >
                        <span style={{ fontWeight: 600, color: lateEarlyTextColor }}>{row.day}</span>
                        <span style={{ textAlign: 'center', color: lateEarlyTextColor }}>-</span>
                        <span style={{ color: lateEarlyTextColor }}>{row.lateTime ? `Late Entry (${row.lateTime})` : ''}</span>
                        <span style={{ color: lateEarlyTextColor }}>{row.earlyTime ? `Early Exit (${row.earlyTime})` : ''}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
      </div>
    </div>
  );
}
