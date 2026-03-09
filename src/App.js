import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import Sidebar       from './components/Sidebar';
import TopBar        from './components/TopBar';
import Notification  from './components/Notification';

import Dashboard  from './pages/Dashboard';
import Attendance from './pages/Attendance';
import Report     from './pages/Report';
import Masters    from './pages/Masters';
import Team       from './pages/Team';
import Admin      from './pages/Admin';
import Login      from './pages/Login';

import { EMPLOYEES } from './data/attlogData';
import { sortEmployeesWithPinnedFirst } from './utils/employeeSort';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') return 'light';
    return window.localStorage.getItem('app_theme') || 'light';
  });
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [selectedMonth,    setSelectedMonth]    = useState('2025-12');
  const [search,           setSearch]           = useState('');
  const [deptFilter,       setDeptFilter]       = useState('All');
  const [collapsed,        setCollapsed]        = useState(false);
  const [notification,     setNotification]     = useState(null);

  const showNotif = useCallback((msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  }, []);

  const filteredEmployees = useMemo(() => {
    const filtered = EMPLOYEES.filter(e => {
      const matchSearch = e.displayName.toLowerCase().includes(search.toLowerCase());
      const matchDept   = deptFilter === 'All' || e.dept === deptFilter;
      return matchSearch && matchDept;
    });
    return sortEmployeesWithPinnedFirst(filtered);
  }, [search, deptFilter]);

  const sharedProps = { employee: selectedEmployee, selectedMonth, showNotif, theme };

  const handleLogin = useCallback(() => {
    setIsAuthenticated(true);
  }, []);

  const handleLogout = useCallback(() => {
    setIsAuthenticated(false);
    setSelectedEmployee(null);
  }, []);

  const handleToggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('app_theme', theme);
      document.body.setAttribute('data-theme', theme);
    }
  }, [theme]);

  return (
    <BrowserRouter>
      <Notification notification={notification} />
      <Routes>
        <Route
          path="/"
          element={
            isAuthenticated
              ? <Navigate to="/home" replace />
              : <Login onLogin={handleLogin} />
          }
        />
        <Route
          path="*"
          element={
            isAuthenticated ? (
              <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--app-bg)', color: 'var(--text-main)' }}>

                <Sidebar
                  employees={filteredEmployees}
                  selectedEmployee={selectedEmployee}
                  onSelectEmployee={setSelectedEmployee}
                  collapsed={collapsed}
                  onToggle={() => setCollapsed(c => !c)}
                  onLogout={handleLogout}
                  theme={theme}
                />

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <TopBar
                    search={search}
                    onSearch={setSearch}
                    selectedMonth={selectedMonth}
                    onMonthChange={setSelectedMonth}
                    theme={theme}
                    onToggleTheme={handleToggleTheme}
                  />

                  <div style={{ flex: 1, overflowY: 'auto', padding: 24, background: 'var(--app-bg)' }}>
                    <Routes>
                      <Route path="/home"       element={<Dashboard  {...sharedProps} onSelectEmployee={setSelectedEmployee} onMonthChange={setSelectedMonth} />} />
                      <Route path="/attendance" element={<Attendance {...sharedProps} onMonthChange={setSelectedMonth} />} />
                      <Route path="/report"     element={<Report     {...sharedProps} />} />
                      <Route path="/masters"    element={<Masters    showNotif={showNotif} />} />
                      <Route path="/admin"      element={<Admin      showNotif={showNotif} />} />
                      <Route path="/team"       element={
                        <Team
                          employees={filteredEmployees}
                          selectedEmployee={selectedEmployee}
                          onSelectEmployee={setSelectedEmployee}
                          selectedMonth={selectedMonth}
                          deptFilter={deptFilter}
                          onDeptFilter={setDeptFilter}
                        />
                      } />
                      <Route path="*" element={<Navigate to="/home" replace />} />
                    </Routes>
                  </div>
                </div>
              </div>
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
