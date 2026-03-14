import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';

import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import Notification from './components/Notification';

import Dashboard from './pages/Dashboard';
import Attendance from './pages/Attendance';
import Report from './pages/Report';
import Masters from './pages/Masters';
import Team from './pages/Team';
import Admin from './pages/Admin';
import Chatbot from './pages/Chatbot';
import Login from './pages/Login';
import './pages/Login.css';

import { EMPLOYEES } from './data/attlogData';
import { sortEmployeesWithPinnedFirst } from './utils/employeeSort';
import {
  getLeaveNotifications,
  hideLeaveNotification,
  markAllLeaveNotificationsSeen,
  resolveLeaveNotification,
  subscribeLeaveNotifications,
} from './utils/leaveStorage';

const ADMIN_BASE = '/admin';
const USER_BASE = '/user';

function getLatestMonthFromEmployees(employees) {
  let latest = '';
  employees.forEach((emp) => {
    Object.entries(emp.attendance || {}).forEach(([monthKey, rows]) => {
      const hasRows = Array.isArray(rows) && rows.length > 0;
      if (/^\d{4}-\d{2}$/.test(monthKey) && hasRows && monthKey > latest) {
        latest = monthKey;
      }
    });
  });

  if (latest) return latest;
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function buildUserPortalAccounts(employees) {
  const used = new Set();

  return employees
    .map((emp) => {
      const name = String(emp.displayName || '').trim();
      if (!name) return null;

      const parts = name
        .toLowerCase()
        .split(/\s+/)
        .map((p) => p.replace(/[^a-z0-9]/g, ''))
        .filter(Boolean);

      if (!parts.length) return null;

      const base = parts[0];
      let username = base;

      if (used.has(username)) {
        let initials = '';
        for (let i = 1; i < parts.length; i += 1) {
          initials += parts[i][0];
          const candidate = `${base}${initials}`;
          if (!used.has(candidate)) {
            username = candidate;
            break;
          }
        }

        if (used.has(username)) {
          const lastLetter = base.slice(-1) || 'x';
          let extra = 1;
          while (used.has(`${base}${lastLetter.repeat(extra)}`)) {
            extra += 1;
          }
          username = `${base}${lastLetter.repeat(extra)}`;
        }
      }

      used.add(username);
      return { username, employeeId: emp.id };
    })
    .filter(Boolean);
}

function UnauthorizedPanel({ section }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 520,
          background: 'var(--surface-bg)',
          border: '1px solid var(--border-color)',
          borderRadius: 14,
          padding: 24,
          boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 44, lineHeight: 1, marginBottom: 10, color: '#d97706' }}>⚠</div>
        <h3 style={{ margin: '0 0 8px', color: 'var(--text-main)' }}>You are not authorized</h3>
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 14 }}>
          You cannot access other employees&apos; {section}.
        </p>
      </div>
    </div>
  );
}

function NotificationPanel({ notifications, onClose, isAdmin, onResolve, onHide }) {
  const [activeId, setActiveId] = useState(null);
  const fmt = (iso) => {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  };

  return (
    <div style={{ position: 'fixed', top: 64, right: 20, width: 360, maxHeight: 420, overflowY: 'auto', background: 'var(--surface-bg)', border: '1px solid var(--border-color)', borderRadius: 12, boxShadow: '0 12px 28px rgba(15,23,42,0.22)', zIndex: 250 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderBottom: '1px solid var(--border-color)' }}>
        <strong style={{ fontSize: 14, color: 'var(--text-main)' }}>Leave Notifications</strong>
        <button type="button" onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}>x</button>
      </div>
      <div style={{ padding: 10 }}>
        {notifications.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: 8 }}>No notifications.</div>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => setActiveId((prev) => (prev === n.id ? null : n.id))}
              style={{ position: 'relative', padding: 10, borderRadius: 8, border: '1px solid var(--border-color)', marginBottom: 8, background: (!n.seenByAdmin || !n.seenByUser) ? '#fefce8' : 'transparent', cursor: 'pointer' }}
            >
              <span
                style={{
                  position: 'absolute',
                  top: 10,
                  right: 10,
                  borderRadius: 999,
                  padding: '2px 10px',
                  fontSize: 11,
                  fontWeight: 700,
                  border: '1px solid',
                  background: n.status === 'accepted' ? '#dcfce7' : n.status === 'declined' ? '#fee2e2' : '#ffedd5',
                  color: n.status === 'accepted' ? '#166534' : n.status === 'declined' ? '#991b1b' : '#9a3412',
                  borderColor: n.status === 'accepted' ? '#86efac' : n.status === 'declined' ? '#fca5a5' : '#fdba74',
                }}
              >
                {n.status === 'pending' ? 'Pending' : n.status === 'accepted' ? 'Accepted' : 'Declined'}
              </span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onHide(n.id); }}
                title="Hide notification"
                style={{
                  position: 'absolute',
                  top: 10,
                  right: 86,
                  width: 20,
                  height: 20,
                  borderRadius: 999,
                  border: '1px solid var(--border-color)',
                  background: 'var(--surface-bg)',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: 12,
                  lineHeight: '18px',
                  padding: 0,
                }}
              >
                x
              </button>
              <div style={{ fontSize: 13, color: 'var(--text-main)', fontWeight: 600 }}>{n.employeeName}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>User: {n.username}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Date: {n.date}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Leave: {n.leaveType}</div>
              <div style={{ fontSize: 11, color: 'var(--text-soft)', marginTop: 4 }}>Applied at: {fmt(n.appliedAt)}</div>
              {n.decidedAt && (
                <div style={{ fontSize: 11, color: 'var(--text-soft)', marginTop: 2 }}>
                  Decision at: {fmt(n.decidedAt)}
                </div>
              )}
              {isAdmin && activeId === n.id && n.status === 'pending' && (
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onResolve(n.id, 'accepted'); }}
                    style={{ flex: 1, height: 32, border: 'none', borderRadius: 8, background: '#16a34a', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onResolve(n.id, 'declined'); }}
                    style={{ flex: 1, height: 32, border: 'none', borderRadius: 8, background: '#dc2626', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                  >
                    Decline
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function RoleSelector() {
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: '100vh', position: 'relative', overflow: 'hidden' }}>
      <img
        src="/wallpaper.jpeg"
        alt="RDL Wallpaper"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(15, 23, 42, 0.38)' }} />

      <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ width: '100%', maxWidth: 520, background: 'rgba(255,255,255,0.94)', borderRadius: 16, boxShadow: '0 18px 45px rgba(15, 23, 42, 0.26)', padding: '32px 28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <img
              src="/logo.jpg"
              alt="RDL Logo"
              style={{ width: 44, height: 44, objectFit: 'contain', borderRadius: 8, background: '#fff' }}
            />
            <div>
              <h1 style={{ margin: 0, color: '#0f172a', fontSize: 24, fontWeight: 700 }}>RDL Technologies Pvt Ltd</h1>
            </div>
          </div>
          <p style={{ margin: '8px 0 22px', color: '#475569', fontSize: 14 }}>Select portal access</p>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={() => navigate('/admin', { replace: true })}
              style={{ flex: 1, height: 44, border: 'none', borderRadius: 10, cursor: 'pointer', background: '#0f766e', color: '#fff', fontSize: 14, fontWeight: 600 }}
            >
              Admin
            </button>
            <button
              type="button"
              onClick={() => navigate('/user', { replace: true })}
              style={{ flex: 1, height: 44, border: '1px solid #cbd5e1', borderRadius: 10, cursor: 'pointer', background: '#fff', color: '#0f172a', fontSize: 14, fontWeight: 600 }}
            >
              User
            </button>
          </div>
        </div>
      </div>

      <div className="login-footer">
        <div className="login-footer-left">
          <div className="login-footer-title">RDL Technologies Pvt Ltd</div>
          <div className="login-footer-line">Head Office: 5th floor, Sahyadri Campus, Adyar, Mangaluru 575007, Karnataka.</div>
          <div className="login-footer-line">Contact Number: +91 8088423347, 0824 2988407</div>
          <div className="login-footer-line">Email: sales@rdltech.in</div>
          <div className="login-footer-line">Reseller &amp; Partner Network: Bengaluru | Mumbai | Nasik | Pune | Coimbatore | Gujarat | Noida | UAE | Dubai | Chennai | USA</div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authPortal, setAuthPortal] = useState(null);
  const [authUsername, setAuthUsername] = useState('');
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') return 'light';
    return window.localStorage.getItem('app_theme') || 'light';
  });
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(() => getLatestMonthFromEmployees(EMPLOYEES));
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('All');
  const [collapsed, setCollapsed] = useState(false);
  const [notification, setNotification] = useState(null);
  const [leaveNotifications, setLeaveNotifications] = useState([]);
  const [showNotificationPanel, setShowNotificationPanel] = useState(false);

  const showNotif = useCallback((msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  }, []);

  const filteredEmployees = useMemo(() => {
    const filtered = EMPLOYEES.filter((e) => {
      const matchSearch = e.displayName.toLowerCase().includes(search.toLowerCase());
      const matchDept = deptFilter === 'All' || e.dept === deptFilter;
      return matchSearch && matchDept;
    });
    return sortEmployeesWithPinnedFirst(filtered);
  }, [search, deptFilter]);

  const employeeById = useMemo(() => {
    const map = new Map();
    EMPLOYEES.forEach((emp) => map.set(emp.id, emp));
    return map;
  }, []);

  const userPortalAccounts = useMemo(() => buildUserPortalAccounts(EMPLOYEES), []);
  const userPortalUsernames = useMemo(
    () => userPortalAccounts.map((a) => a.username),
    [userPortalAccounts]
  );
  const userAccountByUsername = useMemo(() => {
    const map = new Map();
    userPortalAccounts.forEach((a) => map.set(a.username, a));
    return map;
  }, [userPortalAccounts]);
  const loggedInUserEmployeeId = useMemo(() => {
    if (authPortal !== 'USER' || !authUsername) return null;
    const account = userAccountByUsername.get(authUsername);
    return account?.employeeId || null;
  }, [authPortal, authUsername, userAccountByUsername]);

  const sharedProps = { employee: selectedEmployee, selectedMonth, showNotif, theme, authPortal, authUsername };

  const handleLogin = useCallback((payload = {}) => {
    const portal = payload.portal === 'USER' ? 'USER' : 'ADMIN';
    const username = String(payload.username || '').toLowerCase();
    setIsAuthenticated(true);
    setAuthPortal(portal);
    setAuthUsername(username);
    if (portal === 'USER') {
      const account = userAccountByUsername.get(username);
      const emp = account ? employeeById.get(account.employeeId) : null;
      setSelectedEmployee(emp || null);
    }
  }, [employeeById, userAccountByUsername]);

  const handleLogout = useCallback(() => {
    setIsAuthenticated(false);
    setAuthPortal(null);
    setAuthUsername('');
    setSelectedEmployee(null);
    setShowNotificationPanel(false);
    if (typeof window !== 'undefined') {
      window.location.replace('/');
    }
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

  useEffect(() => {
    const refresh = () => setLeaveNotifications(getLeaveNotifications());
    refresh();
    return subscribeLeaveNotifications(refresh);
  }, []);

  const unreadLeaveCount = useMemo(
    () => (
      authPortal === 'ADMIN'
        ? leaveNotifications.filter((n) => !n.seenByAdmin).length
        : leaveNotifications.filter((n) => n.username === authUsername && !n.seenByUser).length
    ),
    [authPortal, authUsername, leaveNotifications]
  );

  const openNotifications = useCallback(() => {
    setShowNotificationPanel(true);
    if (authPortal === 'ADMIN') {
      markAllLeaveNotificationsSeen('ADMIN');
    } else if (authPortal === 'USER') {
      markAllLeaveNotificationsSeen('USER', authUsername);
    }
  }, [authPortal, authUsername]);

  const handleResolveNotification = useCallback((id, decision) => {
    if (authPortal !== 'ADMIN') return;
    resolveLeaveNotification(id, decision, authUsername || 'admin');
  }, [authPortal, authUsername]);

  const handleHideNotification = useCallback((id) => {
    if (authPortal === 'ADMIN') {
      hideLeaveNotification(id, 'ADMIN');
      return;
    }
    if (authPortal === 'USER') {
      hideLeaveNotification(id, 'USER', authUsername);
    }
  }, [authPortal, authUsername]);

  const visibleNotifications = useMemo(() => {
    if (authPortal === 'ADMIN') {
      return leaveNotifications.filter((n) => !n.hiddenByAdmin);
    }
    if (authPortal === 'USER') {
      return leaveNotifications.filter((n) => n.username === authUsername && !n.hiddenByUser);
    }
    return [];
  }, [authPortal, authUsername, leaveNotifications]);

  return (
    <BrowserRouter>
      <Notification notification={notification} />
      {showNotificationPanel && (
        <NotificationPanel
          notifications={visibleNotifications}
          onClose={() => setShowNotificationPanel(false)}
          isAdmin={authPortal === 'ADMIN'}
          onResolve={handleResolveNotification}
          onHide={handleHideNotification}
        />
      )}
      <Routes>
        <Route path="/" element={<RoleSelector />} />

        <Route
          path="/admin"
          element={
            isAuthenticated && authPortal === 'ADMIN'
              ? <Navigate to={`${ADMIN_BASE}/home`} replace />
              : <Login onLogin={handleLogin} redirectTo={`${ADMIN_BASE}/home`} portalLabel="ADMIN" />
          }
        />

        <Route
          path="/user"
          element={
            isAuthenticated && authPortal === 'USER'
              ? <Navigate to={`${USER_BASE}/home`} replace />
              : <Login onLogin={handleLogin} redirectTo={`${USER_BASE}/home`} portalLabel="USER" allowedUsernames={userPortalUsernames} />
          }
        />

        <Route
          path="/admin/*"
          element={
            isAuthenticated && authPortal === 'ADMIN' ? (
              <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--app-bg)', color: 'var(--text-main)' }}>
                <Sidebar
                  employees={filteredEmployees}
                  selectedEmployee={selectedEmployee}
                  onSelectEmployee={setSelectedEmployee}
                  collapsed={collapsed}
                  onToggle={() => setCollapsed((c) => !c)}
                  onLogout={handleLogout}
                  theme={theme}
                  basePath={ADMIN_BASE}
                />

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <TopBar
                    search={search}
                    onSearch={setSearch}
                    selectedMonth={selectedMonth}
                    onMonthChange={setSelectedMonth}
                    theme={theme}
                    onToggleTheme={handleToggleTheme}
                    basePath={ADMIN_BASE}
                    onOpenNotifications={openNotifications}
                    unreadCount={unreadLeaveCount}
                  />

                  <div style={{ flex: 1, overflowY: 'auto', padding: 24, background: 'var(--app-bg)' }}>
                    <Routes>
                      <Route path="home" element={<Dashboard {...sharedProps} onSelectEmployee={setSelectedEmployee} onMonthChange={setSelectedMonth} />} />
                      <Route path="attendance" element={<Attendance {...sharedProps} onMonthChange={setSelectedMonth} />} />
                      <Route path="report" element={<Report {...sharedProps} />} />
                      <Route path="masters" element={<Masters showNotif={showNotif} />} />
                      <Route path="admin" element={<Admin showNotif={showNotif} basePath={ADMIN_BASE} />} />
                      <Route path="chatbot" element={<Chatbot selectedMonth={selectedMonth} />} />
                      <Route
                        path="team"
                        element={(
                          <Team
                            employees={filteredEmployees}
                            selectedEmployee={selectedEmployee}
                            onSelectEmployee={setSelectedEmployee}
                            selectedMonth={selectedMonth}
                            deptFilter={deptFilter}
                            onDeptFilter={setDeptFilter}
                            basePath={ADMIN_BASE}
                          />
                        )}
                      />
                      <Route path="*" element={<Navigate to="home" replace />} />
                    </Routes>
                  </div>
                </div>
              </div>
            ) : (
              <Navigate to="/admin" replace />
            )
          }
        />

        <Route
          path="/user/*"
          element={
            isAuthenticated && authPortal === 'USER' ? (
              <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--app-bg)', color: 'var(--text-main)' }}>
                <Sidebar
                  employees={filteredEmployees}
                  selectedEmployee={selectedEmployee}
                  onSelectEmployee={setSelectedEmployee}
                  collapsed={collapsed}
                  onToggle={() => setCollapsed((c) => !c)}
                  onLogout={handleLogout}
                  theme={theme}
                  basePath={USER_BASE}
                />

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <TopBar
                    search={search}
                    onSearch={setSearch}
                    selectedMonth={selectedMonth}
                    onMonthChange={setSelectedMonth}
                    theme={theme}
                    onToggleTheme={handleToggleTheme}
                    basePath={USER_BASE}
                    hiddenTabs={['masters', 'team', 'admin', 'chatbot']}
                    onOpenNotifications={openNotifications}
                    unreadCount={unreadLeaveCount}
                  />

                  <div style={{ flex: 1, overflowY: 'auto', padding: 24, background: 'var(--app-bg)' }}>
                    <Routes>
                      <Route path="home" element={<Dashboard {...sharedProps} onSelectEmployee={setSelectedEmployee} onMonthChange={setSelectedMonth} basePath={USER_BASE} />} />
                      <Route
                        path="attendance"
                        element={
                          selectedEmployee && loggedInUserEmployeeId && selectedEmployee.id !== loggedInUserEmployeeId
                            ? <UnauthorizedPanel section="attendance data" />
                            : <Attendance {...sharedProps} onMonthChange={setSelectedMonth} />
                        }
                      />
                      <Route
                        path="report"
                        element={
                          selectedEmployee && loggedInUserEmployeeId && selectedEmployee.id !== loggedInUserEmployeeId
                            ? <UnauthorizedPanel section="attendance reports" />
                            : <Report {...sharedProps} />
                        }
                      />
                      <Route path="masters" element={<Masters showNotif={showNotif} />} />
                      <Route path="admin" element={<Admin showNotif={showNotif} basePath={USER_BASE} />} />
                      <Route path="chatbot" element={<Navigate to="home" replace />} />
                      <Route
                        path="team"
                        element={(
                          <Team
                            employees={filteredEmployees}
                            selectedEmployee={selectedEmployee}
                            onSelectEmployee={setSelectedEmployee}
                            selectedMonth={selectedMonth}
                            deptFilter={deptFilter}
                            onDeptFilter={setDeptFilter}
                            basePath={USER_BASE}
                          />
                        )}
                      />
                      <Route path="*" element={<Navigate to="home" replace />} />
                    </Routes>
                  </div>
                </div>
              </div>
            ) : (
              <Navigate to="/user" replace />
            )
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
