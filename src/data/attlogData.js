import attendanceReports from './attendance_reports.json';
import {
  EMPLOYEES as BASE_EMPLOYEES,
  DEPARTMENTS,
  SECTIONS_DEFAULT,
  MONTHS,
  NATIONAL_HOLIDAYS,
  getMonthStats,
} from './employees';

export const EMPLOYEES = BASE_EMPLOYEES.map((emp) => ({
  ...emp,
  attendance: attendanceReports[emp.id] || {},
}));

export {
  DEPARTMENTS,
  SECTIONS_DEFAULT,
  MONTHS,
  NATIONAL_HOLIDAYS,
  getMonthStats,
};
