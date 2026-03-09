import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { MONTHS, NATIONAL_HOLIDAYS } from '../data/employees';
import { getLeavesForEmployeeMonth } from '../utils/leaveStorage';

const pad = n => String(n).padStart(2, '0');
const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAYS_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const RANGE_TABS = ['Day', 'Week', 'Month', 'Date Range'];
const escapeCsv = (value) => {
  const str = String(value ?? '');
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
};
const escapePdfText = (value) => String(value ?? '')
  .replace(/\\/g, '\\\\')
  .replace(/\(/g, '\\(')
  .replace(/\)/g, '\\)');

const buildPdfBlob = (pages) => {
  const objects = [];
  const addObject = (content) => {
    objects.push(content);
    return objects.length;
  };

  const catalogId = addObject('<< /Type /Catalog /Pages 2 0 R >>');
  const pagesId = addObject('<< /Type /Pages /Kids [] /Count 0 >>');
  const fontId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');

  const pageIds = [];
  const contentIds = [];

  pages.forEach((lines) => {
    const textOps = [
      'BT',
      '/F1 9 Tf',
      '13 TL',
      '40 800 Td',
    ];

    lines.forEach((line, index) => {
      const escaped = escapePdfText(line);
      if (index === 0) {
        textOps.push(`(${escaped}) Tj`);
      } else {
        textOps.push(`T* (${escaped}) Tj`);
      }
    });
    textOps.push('ET');

    const stream = textOps.join('\n');
    const contentId = addObject(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    const pageId = addObject(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`);

    contentIds.push(contentId);
    pageIds.push(pageId);
  });

  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((obj, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${obj}\nendobj\n`;
  });

  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i <= objects.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return new Blob([pdf], { type: 'application/pdf' });
};
const STATUS_COLORS = {
  present: '#16a34a',
  absent: '#ef4444',
  'national-holiday': '#a16207',
  'paid-leave': '#7c3aed',
  'earned-leave': '#ec4899',
  'training-leave': '#0ea5e9',
  weekend: '#6b7280',
};

export default function Report({ employee, selectedMonth, showNotif }) {
  const [range, setRange] = useState('Month');
  if (!employee) return <div style={{ padding: 40, color: '#94a3b8' }}>Select an employee.</div>;

  const [yr, mo] = selectedMonth.split('-').map(Number);
  const records   = employee.attendance[selectedMonth] || [];
  const daysInMo  = new Date(yr, mo, 0).getDate();
  const monthStart = `${selectedMonth}-01`;
  const monthEnd = `${selectedMonth}-${pad(daysInMo)}`;
  const [dateFrom, setDateFrom] = useState(monthStart);
  const [dateTo, setDateTo] = useState(monthEnd);
  const workDays  = records.filter(r => r.status !== 'weekend');
  const monthLeaves = getLeavesForEmployeeMonth(employee.id, selectedMonth);

  useEffect(() => {
    setDateFrom(monthStart);
    setDateTo(monthEnd);
  }, [monthStart, monthEnd]);

  const visibleRecords = (() => {
    if (range === 'Day') return workDays.slice(-1);
    if (range === 'Week') return workDays.slice(-7);
    if (range === 'Date Range') {
      if (!dateFrom || !dateTo || dateFrom > dateTo) return [];
      return workDays.filter((r) => {
        const dateKey = `${selectedMonth}-${pad(r.day)}`;
        return dateKey >= dateFrom && dateKey <= dateTo;
      });
    }
    return workDays;
  })();

  const chartSourceRecords = (() => {
    if (range === 'Day') return records.slice(-1);
    if (range === 'Week') return records.slice(-7);
    if (range === 'Date Range') {
      if (!dateFrom || !dateTo || dateFrom > dateTo) return [];
      return records.filter((r) => {
        const dateKey = `${selectedMonth}-${pad(r.day)}`;
        return dateKey >= dateFrom && dateKey <= dateTo;
      });
    }
    return records;
  })();

  const visibleEffectiveStatuses = visibleRecords.map((r) => {
    const dateKey = `${selectedMonth}-${pad(r.day)}`;
    const isHoliday = !!NATIONAL_HOLIDAYS[dateKey];
    const leaveType = monthLeaves[dateKey];
    const leaveStatus = leaveType === 'paid' ? 'paid-leave'
      : leaveType === 'earned' ? 'earned-leave'
      : leaveType === 'training' ? 'training-leave'
      : null;
    return isHoliday ? 'national-holiday' : leaveStatus || r.status;
  });

  const stats = {
    present: visibleEffectiveStatuses.filter((s) => s === 'present').length,
    absent: visibleEffectiveStatuses.filter((s) => s === 'absent').length,
    total: visibleEffectiveStatuses.filter((s) => s === 'present' || s === 'absent').length,
  };
  const totalHrs  = `${Math.floor(stats.present * 8.3)}h ${Math.floor((stats.present * 8.3 % 1) * 60)}m`;
  const formatDateKey = (dateKey) => {
    const [y, m, d] = dateKey.split('-').map(Number);
    return `${pad(d)} ${MONTHS[m - 1].slice(0, 3)} ${y}`;
  };

  const rangeLabel = range === 'Date Range'
    ? `${formatDateKey(dateFrom)} - ${formatDateKey(dateTo)}`
    : visibleRecords.length > 0
      ? `${pad(visibleRecords[0].day)} ${MONTHS[mo - 1].slice(0, 3)} - ${pad(visibleRecords[visibleRecords.length - 1].day)} ${MONTHS[mo - 1].slice(0, 3)} ${yr}`
      : `01 ${MONTHS[mo - 1].slice(0, 3)} - ${daysInMo} ${MONTHS[mo - 1].slice(0, 3)} ${yr}`;

  const chartData = chartSourceRecords.map((r) => {
    const fullDate = `${pad(r.day)} ${MONTHS[mo - 1].slice(0, 3)} ${yr}`;
    const dateKey = `${yr}-${pad(mo)}-${pad(r.day)}`;
    const holidayName = NATIONAL_HOLIDAYS[dateKey];
    const isHoliday = !!holidayName;
    const leaveType = monthLeaves[dateKey];
    const leaveStatus = leaveType === 'paid' ? 'paid-leave'
      : leaveType === 'earned' ? 'earned-leave'
      : leaveType === 'training' ? 'training-leave'
      : null;
    const status = isHoliday ? 'national-holiday' : leaveStatus || r.status;

    if (status === 'national-holiday') {
      return { day: pad(r.day), hours: 0, chartValue: 0.2, status, fullDate, holidayName };
    }

    if (r.status === 'present' && r.work) {
      const [wh, wm] = r.work.split(':').map(Number);
      const hours = +(wh + wm / 60).toFixed(2);
      return { day: pad(r.day), hours, chartValue: hours, status, fullDate };
    }
    return {
      day: pad(r.day),
      hours: 0,
      chartValue: ['absent', 'weekend', 'paid-leave', 'earned-leave', 'training-leave'].includes(status) ? 0.2 : 0,
      status,
      fullDate,
    };
  });

  const exportRows = chartSourceRecords.map((rec) => {
    const date = new Date(yr, mo - 1, rec.day);
    const dateStr = `${yr}-${pad(mo)}-${pad(rec.day)}`;
    const holidayName = NATIONAL_HOLIDAYS[dateStr];
    const isHoliday = !!holidayName;
    const leaveType = monthLeaves[dateStr];
    const leaveStatus = leaveType === 'paid' ? 'paid-leave'
      : leaveType === 'earned' ? 'earned-leave'
      : leaveType === 'training' ? 'training-leave'
      : null;
    const status = isHoliday ? 'national-holiday' : leaveStatus || rec.status;
    const isPresent = status === 'present';
    const dayName = DAYS_FULL[date.getDay()];
    const statusLabel = isHoliday
      ? `National Holiday (${holidayName})`
      : status === 'weekend'
        ? `Weekend (${dayName})`
        : status === 'paid-leave'
          ? 'Paid Leave'
          : status === 'earned-leave'
            ? 'Earned Leave'
            : status === 'training-leave'
              ? 'Training/Other Work Leave'
              : status === 'absent'
                ? 'Absent'
                : 'Present';

    return {
      dateLabel: `${pad(rec.day)} ${MONTHS[mo - 1].slice(0, 3)} ${yr}`,
      dayLabel: DAYS_SHORT[date.getDay()],
      inTime: isPresent ? rec.inTime : '--',
      logoutForLunch: isPresent ? (rec.logoutForLunch || '--') : '--',
      loginFromLunch: isPresent ? (rec.loginFromLunch || '--') : '--',
      logout: isPresent ? (rec.logout || rec.outTime || '--') : '--',
      statusLabel,
    };
  });

  const handleExportCsv = () => {
    const headers = ['Date', 'Day', 'In Time', 'Logout for Lunch', 'Login from Lunch', 'Logout', 'Status'];
    const bodyLines = exportRows.map((row) => ([
      row.dateLabel,
      row.dayLabel,
      row.inTime,
      row.logoutForLunch,
      row.loginFromLunch,
      row.logout,
      row.statusLabel,
    ].map(escapeCsv).join(',')));
    const csv = [headers.join(','), ...bodyLines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${employee.displayName.replace(/\s+/g, '_')}_${selectedMonth}_report.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showNotif('CSV downloaded successfully!');
  };

  const handleExportPdf = () => {
    const lines = [
      `${employee.displayName} - Attendance Report`,
      `Month: ${selectedMonth} | Range: ${rangeLabel}`,
      'Date | Day | In Time | Logout for Lunch | Login from Lunch | Logout | Status',
      '--------------------------------------------------------------------------------',
      ...exportRows.map((row) => `${row.dateLabel} | ${row.dayLabel} | ${row.inTime} | ${row.logoutForLunch} | ${row.loginFromLunch} | ${row.logout} | ${row.statusLabel}`),
    ];

    const linesPerPage = 54;
    const pages = [];
    for (let i = 0; i < lines.length; i += linesPerPage) {
      pages.push(lines.slice(i, i + linesPerPage));
    }

    const blob = buildPdfBlob(pages);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${employee.displayName.replace(/\s+/g, '_')}_${selectedMonth}_report.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showNotif('PDF downloaded successfully!');
  };

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{ background: '#2563eb', borderRadius: 12, padding: '14px 22px', marginBottom: 20, color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{employee.displayName}</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {RANGE_TABS.map(t => (
            <button key={t} onClick={() => setRange(t)} style={{ padding: '5px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', background: t===range?'#fff':'transparent', color: t===range?'#2563eb':'#bfdbfe', fontWeight: t===range?600:400, fontSize: 13, fontFamily: 'inherit' }}>{t}</button>
          ))}
          {range === 'Date Range' && (
            <>
              <input
                type="date"
                value={dateFrom}
                min={monthStart}
                max={monthEnd}
                onChange={(e) => setDateFrom(e.target.value)}
                style={{ height: 30, borderRadius: 8, border: '1px solid #93c5fd', padding: '0 8px', fontSize: 12, color: '#1e3a8a', background: '#dbeafe' }}
              />
              <input
                type="date"
                value={dateTo}
                min={monthStart}
                max={monthEnd}
                onChange={(e) => setDateTo(e.target.value)}
                style={{ height: 30, borderRadius: 8, border: '1px solid #93c5fd', padding: '0 8px', fontSize: 12, color: '#1e3a8a', background: '#dbeafe' }}
              />
            </>
          )}
          <div style={{ background: '#1d4ed8', borderRadius: 8, padding: '5px 12px', fontSize: 12 }}>
            {rangeLabel}
          </div>
        </div>
      </div>

      {/* Chart */}
      <div style={{ background: '#fff', borderRadius: 14, padding: 24, boxShadow: '0 1px 6px rgba(0,0,0,0.06)', marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          <span style={{ fontSize: 28, fontWeight: 700, color: '#1e293b' }}>{totalHrs}</span>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} barSize={20}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#94a3b8' }} />
            <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => v + 'h'} />
            <Tooltip
              labelFormatter={(label, payload) => payload?.[0]?.payload?.fullDate || label}
              formatter={(_v, _name, item) => {
                const st = item?.payload?.status;
                const label = st === 'national-holiday'
                  ? `National Holiday${item?.payload?.holidayName ? ` (${item.payload.holidayName})` : ''}`
                  : st === 'weekend'
                    ? 'Weekend'
                    : st === 'absent'
                      ? 'Absent'
                      : st === 'paid-leave'
                        ? 'Paid Leave'
                        : st === 'earned-leave'
                          ? 'Earned Leave'
                          : st === 'training-leave'
                            ? 'Training/Other Work Leave'
                      : 'Work';
                return [item?.payload?.hours?.toFixed(1) + ' hrs', label];
              }}
              contentStyle={{ borderRadius: 8, fontSize: 13 }}
            />
            <Bar dataKey="chartValue" fill="#2563eb" radius={[4,4,0,0]}
              label={{ position: 'top', fontSize: 10, fill: '#64748b', formatter: v => v >= 1 ? v.toFixed(0)+'h' : '' }}
            >
              {chartData.map((entry, idx) => (
                <Cell
                  key={`cell-${idx}`}
                  fill={STATUS_COLORS[entry.status] || '#2563eb'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 20 }}>
        {[
          { label: 'Present Days',   value: stats.present, color: '#16a34a' },
          { label: 'Absent Days',    value: stats.absent,  color: '#ef4444' },
          { label: 'Total Work Days',value: stats.total,   color: '#2563eb' },
          { label: 'Attendance %',   value: stats.total > 0 ? Math.round(stats.present/stats.total*100)+'%' : '0%', color: '#7c3aed' },
        ].map((c, i) => (
          <div key={i} style={{ background: '#fff', borderRadius: 14, padding: '16px 20px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)', borderTop: `4px solid ${c.color}`, textAlign: 'center' }}>
            <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>{c.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Daily table moved from Attendance */}
      <div style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,0.06)', marginBottom: 20 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#2563eb' }}>
              {['Date', 'Day', 'In Time', 'Logout for Lunch', 'Login from Lunch', 'Logout', 'Status'].map(h => (
                <th key={h} style={{ padding: '11px 16px', textAlign: 'left', color: '#fff', fontWeight: 600, fontSize: 12 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {chartSourceRecords.map((rec, i) => {
              const date = new Date(yr, mo - 1, rec.day);
              const dateStr = `${yr}-${pad(mo)}-${pad(rec.day)}`;
              const holidayName = NATIONAL_HOLIDAYS[dateStr];
              const isHoliday = !!holidayName;
              const leaveType = monthLeaves[dateStr];
              const leaveStatus = leaveType === 'paid' ? 'paid-leave'
                : leaveType === 'earned' ? 'earned-leave'
                : leaveType === 'training' ? 'training-leave'
                : null;
              const status = isHoliday ? 'national-holiday' : leaveStatus || rec.status;
              const isPresent = status === 'present';
              const dayName = DAYS_FULL[date.getDay()];
              const statusLabel = isHoliday
                ? `National Holiday (${holidayName})`
                : status === 'weekend'
                  ? `Weekend (${dayName})`
                  : status === 'paid-leave'
                    ? 'Paid Leave'
                    : status === 'earned-leave'
                      ? 'Earned Leave'
                      : status === 'training-leave'
                        ? 'Training/Other Work Leave'
                        : status === 'absent'
                          ? 'Absent'
                          : 'Present';
              const statusColor = STATUS_COLORS[status] || '#2563eb';
              const dateLabel = `${pad(rec.day)} ${MONTHS[mo - 1].slice(0, 3)} ${yr}`;
              const dayLabel = DAYS_SHORT[date.getDay()];
              return (
                <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px 16px', color: '#7c3aed', fontWeight: 700 }}>{dateLabel}</td>
                  <td style={{ padding: '10px 16px', color: '#ec4899', fontWeight: 700 }}>{dayLabel}</td>
                  <td style={{ padding: '10px 16px', color: '#000000', fontWeight: 600 }}>{isPresent ? rec.inTime : '--'}</td>
                  <td style={{ padding: '10px 16px', color: '#000000', fontWeight: 600 }}>{isPresent ? (rec.logoutForLunch || '--') : '--'}</td>
                  <td style={{ padding: '10px 16px', color: '#000000', fontWeight: 600 }}>{isPresent ? (rec.loginFromLunch || '--') : '--'}</td>
                  <td style={{ padding: '10px 16px', color: '#000000', fontWeight: 600 }}>{isPresent ? (rec.logout || rec.outTime || '--') : '--'}</td>
                  <td style={{ padding: '10px 16px', color: statusColor, fontWeight: 600 }}>{statusLabel}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Export */}
      <div style={{ display: 'flex', gap: 12 }}>
        <button onClick={handleExportPdf} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 22px', borderRadius: 10, border: 'none', cursor: 'pointer', background: '#2563eb', color: '#fff', fontWeight: 600, fontSize: 14, fontFamily: 'inherit' }}>
          Download Export PDF
        </button>
        <button onClick={handleExportCsv} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 22px', borderRadius: 10, border: '1.5px solid #2563eb', cursor: 'pointer', background: '#eff6ff', color: '#2563eb', fontWeight: 600, fontSize: 14, fontFamily: 'inherit' }}>
          Download Export CSV
        </button>
      </div>
    </div>
  );
}

