import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Admin.css';
import {
  addAdminUser,
  deleteAdminUser,
  getAdminUsernames,
  updateAdminPassword,
  validateAdminCredentials,
} from '../utils/adminUsersStorage';
import {
  deleteEmployeeCred,
  getEmployeeCreds,
  upsertEmployeeCred,
  updateEmployeeCred,
} from '../utils/employeeCredsStorage';
import { EMPLOYEES as LOCAL_EMPLOYEES, DEPARTMENTS } from '../data/employees';

const API_URL = window.location.protocol === 'file:' ? '' : '/upload_reports.php';
const EMP_API_URL = window.location.protocol === 'file:' ? '' : '/employees.php';
const NAME_RE = /^(January|February|March|April|May|June|July|August|September|October|November|December)_\d{4}\.(xls|xlsx)$/;

export default function Admin({ showNotif, basePath = '/admin' }) {
  const navigate = useNavigate();
  const cleanBase = basePath.replace(/\/$/, '');
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [authorized, setAuthorized] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authTitle, setAuthTitle] = useState('Admin Login');
  const [authUser, setAuthUser] = useState('');
  const [authPass, setAuthPass] = useState('');
  const [authError, setAuthError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState('');
  const [adminNames, setAdminNames] = useState(() => getAdminUsernames());
  const [newAdminUser, setNewAdminUser] = useState('');
  const [newAdminPass, setNewAdminPass] = useState('');
  const [updateAdminName, setUpdateAdminName] = useState('');
  const [updatePass, setUpdatePass] = useState('');
  const [deleteAdminName, setDeleteAdminName] = useState('');
  const [adminSidebarOpen, setAdminSidebarOpen] = useState(false);
  const [activeAdminSection, setActiveAdminSection] = useState(null);
  const [activeEmployeeSection, setActiveEmployeeSection] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [newEmpName, setNewEmpName] = useState('');
  const [newEmpUsername, setNewEmpUsername] = useState('');
  const [newEmpPassword, setNewEmpPassword] = useState('');
  const [newEmpDepartmentId, setNewEmpDepartmentId] = useState('');
  const [updateEmpId, setUpdateEmpId] = useState('');
  const [updateEmpUsername, setUpdateEmpUsername] = useState('');
  const [updateEmpOldPassword, setUpdateEmpOldPassword] = useState('');
  const [updateEmpNewPassword, setUpdateEmpNewPassword] = useState('');
  const [deleteEmpId, setDeleteEmpId] = useState('');
  const inputRef = useRef(null);
  const authResolveRef = useRef(null);
  const confirmResolveRef = useRef(null);

  const sortedEmployees = useMemo(() => (
    [...employees].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' }))
  ), [employees]);

  const refreshAdminNames = () => {
    const next = getAdminUsernames();
    setAdminNames(next);
    if (!next.includes(updateAdminName)) setUpdateAdminName(next[0] || '');
    if (!next.includes(deleteAdminName)) setDeleteAdminName(next[0] || '');
  };

  const validationError = useMemo(() => {
    if (!file) return '';
    if (!NAME_RE.test(file.name)) {
      return 'Invalid file name. Use Month_Year.xls or Month_Year.xlsx (example: December_2025.xlsx). Month must start with capital letter.';
    }
    return '';
  }, [file]);

  const requestAuth = (title) => new Promise((resolve) => {
    setAuthTitle(title);
    setAuthUser('');
    setAuthPass('');
    setAuthError('');
    setAuthOpen(true);
    authResolveRef.current = resolve;
  });

  const requestConfirm = (message) => new Promise((resolve) => {
    setConfirmMessage(message);
    setConfirmOpen(true);
    confirmResolveRef.current = resolve;
  });

  const resolveAuth = (ok) => {
    setAuthOpen(false);
    if (authResolveRef.current) {
      authResolveRef.current(ok);
      authResolveRef.current = null;
    }
  };

  const resolveConfirm = (ok) => {
    setConfirmOpen(false);
    if (confirmResolveRef.current) {
      confirmResolveRef.current(ok);
      confirmResolveRef.current = null;
    }
  };

  const submitAuth = (e) => {
    e.preventDefault();
    if (!validateAdminCredentials(authUser, authPass)) {
      setAuthError('Invalid username or password.');
      return;
    }
    resolveAuth(true);
  };

  const setEmployeeLists = (list) => {
    setEmployees(list);
    if (!list.find((e) => String(e.id) === String(updateEmpId))) {
      setUpdateEmpId(list[0]?.id ? String(list[0].id) : '');
    }
    if (!list.find((e) => String(e.id) === String(deleteEmpId))) {
      setDeleteEmpId(list[0]?.id ? String(list[0].id) : '');
    }
  };

  const loadLocalEmployees = () => {
    const list = LOCAL_EMPLOYEES.map((e) => ({ id: String(e.id), name: e.displayName || e.name || '' }));
    setEmployeeLists(list);
  };

  const loadLocalDepartments = () => {
    const list = DEPARTMENTS.map((d) => ({ id: String(d.id), name: d.name }));
    setDepartments(list);
    if (!newEmpDepartmentId) {
      setNewEmpDepartmentId(list[0]?.id ? String(list[0].id) : '');
    }
  };

  const fetchEmployees = async () => {
    if (!EMP_API_URL) {
      loadLocalEmployees();
      return;
    }
    try {
      const res = await fetch(EMP_API_URL);
      const json = await res.json();
      const list = Array.isArray(json?.data) ? json.data : [];
      if (!list.length) {
        loadLocalEmployees();
        return;
      }
      setEmployeeLists(list);
    } catch (e) {
      loadLocalEmployees();
    }
  };

  const fetchDepartments = async () => {
    if (!EMP_API_URL) {
      loadLocalDepartments();
      return;
    }
    try {
      const res = await fetch('/departments.php');
      const json = await res.json();
      const list = Array.isArray(json?.data) ? json.data.map((d) => ({ id: String(d.id), name: d.name })) : [];
      if (!list.length) {
        loadLocalDepartments();
        return;
      }
      setDepartments(list);
      if (!newEmpDepartmentId) {
        setNewEmpDepartmentId(list[0]?.id ? String(list[0].id) : '');
      }
    } catch {
      loadLocalDepartments();
    }
  };

  const handleCreateEmployee = async () => {
    if (!EMP_API_URL) {
      showNotif?.('Employee management is not available in desktop mode.', 'error');
      return;
    }
    if (!newEmpName || !newEmpUsername || !newEmpPassword || !newEmpDepartmentId) {
      showNotif?.('Please enter name, username, password, and department.', 'error');
      return;
    }
    const ok = await requestAuth('Confirm Add Employee');
    if (!ok) return;
    const confirm = await requestConfirm('Are you sure you want to add this new employee?');
    if (!confirm) return;
    const empCodes = employees.map((e) => Number(e.emp_code)).filter((n) => Number.isFinite(n));
    const nextCode = empCodes.length ? String(Math.max(...empCodes) + 1) : String(Date.now());
    const body = {
      emp_code: nextCode,
      name: newEmpName,
      department_id: Number(newEmpDepartmentId) || 1,
      section_id: 1,
      email: '',
      phone: '',
      join_date: new Date().toISOString().slice(0, 10),
    };
    try {
      const res = await fetch(EMP_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.error || 'Create failed');
      const empId = json.id || body.emp_code;
      const credRes = upsertEmployeeCred({
        employeeId: empId,
        name: newEmpName,
        username: newEmpUsername,
        password: newEmpPassword,
      });
      if (!credRes.ok) throw new Error(credRes.error || 'Failed to save employee credentials.');
      setNewEmpName('');
      setNewEmpUsername('');
      setNewEmpPassword('');
      await fetchEmployees();
      showNotif?.('Employee created successfully.');
    } catch (e) {
      showNotif?.(e?.message || 'Failed to create employee.', 'error');
    }
  };

  const handleUpdateEmployee = async () => {
    if (!updateEmpId || !updateEmpUsername || !updateEmpOldPassword || !updateEmpNewPassword) {
      showNotif?.('Please select employee and enter username, old password, and new password.', 'error');
      return;
    }
    const ok = await requestAuth('Confirm Update Employee');
    if (!ok) return;
    const confirm = await requestConfirm('Are you sure you want to update this employee?');
    if (!confirm) return;
    const emp = employees.find((e) => String(e.id) === String(updateEmpId));
    if (!emp) {
      showNotif?.('Employee not found.', 'error');
      return;
    }
    const existing = getEmployeeCreds().find((c) => String(c.employeeId) === String(emp.id));
    if (!existing) {
      showNotif?.('Employee credentials not found. Please add credentials first.', 'error');
      return;
    }
    if (existing.password !== updateEmpOldPassword) {
      showNotif?.('Old password does not match.', 'error');
      return;
    }
    const res = updateEmployeeCred(emp.id, updateEmpUsername, updateEmpNewPassword);
    if (!res.ok) {
      showNotif?.(res.error, 'error');
      return;
    }
    setUpdateEmpUsername('');
    setUpdateEmpOldPassword('');
    setUpdateEmpNewPassword('');
    await fetchEmployees();
    showNotif?.('Employee updated successfully.');
  };

  const handleDeleteEmployee = async () => {
    if (!deleteEmpId) {
      showNotif?.('Select an employee to delete.', 'error');
      return;
    }
    const ok = await requestAuth('Confirm Delete Employee');
    if (!ok) return;
    const confirm = await requestConfirm('Are you sure you want to delete this employee?');
    if (!confirm) return;
    if (!EMP_API_URL) {
      showNotif?.('Employee management is not available in desktop mode.', 'error');
      return;
    }
    try {
      const res = await fetch(`${EMP_API_URL}?id=${encodeURIComponent(deleteEmpId)}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.error || 'Delete failed');
      deleteEmployeeCred(deleteEmpId);
      await fetchEmployees();
      showNotif?.('Employee deleted successfully.');
    } catch (e) {
      showNotif?.(e?.message || 'Failed to delete employee.', 'error');
    }
  };

  const handleCreateAdmin = () => {
    const res = addAdminUser(newAdminUser, newAdminPass);
    if (!res.ok) {
      showNotif?.(res.error, 'error');
      return;
    }
    setNewAdminUser('');
    setNewAdminPass('');
    refreshAdminNames();
    showNotif?.('New admin created successfully.');
  };

  const handleUpdateAdmin = () => {
    const res = updateAdminPassword(updateAdminName, updatePass);
    if (!res.ok) {
      showNotif?.(res.error, 'error');
      return;
    }
    setUpdatePass('');
    showNotif?.('Admin password updated successfully.');
  };

  const handleDeleteAdmin = () => {
    if (!deleteAdminName) {
      showNotif?.('Select an admin to delete.', 'error');
      return;
    }
    const ok = window.confirm(`Are you sure to delete admin "${deleteAdminName}"?`);
    if (!ok) return;
    const res = deleteAdminUser(deleteAdminName);
    if (!res.ok) {
      showNotif?.(res.error, 'error');
      return;
    }
    refreshAdminNames();
    showNotif?.('Admin deleted successfully.');
  };

  useEffect(() => {
    let alive = true;
    refreshAdminNames();
    (async () => {
      const ok = await requestAuth('Admin Login');
      if (!alive) return;
      if (!ok) {
        showNotif?.('Admin access cancelled.', 'error');
        navigate(`${cleanBase}/home`, { replace: true });
        return;
      }
      setAuthorized(true);
      fetchEmployees();
      fetchDepartments();
    })();
    return () => {
      alive = false;
      if (authResolveRef.current) {
        authResolveRef.current(false);
        authResolveRef.current = null;
      }
      if (confirmResolveRef.current) {
        confirmResolveRef.current(false);
        confirmResolveRef.current = null;
      }
    };
  }, [navigate, showNotif]);

  const handlePick = () => inputRef.current?.click();

  const handleFileSelect = (nextFile) => {
    setMessage('');
    setError('');
    if (!nextFile) return;
    setFile(nextFile);
  };

  const onInputChange = (e) => {
    const next = e.target.files?.[0];
    handleFileSelect(next || null);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const next = e.dataTransfer.files?.[0];
    handleFileSelect(next || null);
  };

  const uploadFile = async () => {
    setMessage('');
    setError('');

    if (!API_URL) {
      setError('Report upload is not available in desktop mode.');
      return;
    }

    if (!file) {
      setError('Please choose a file first.');
      return;
    }
    if (validationError) {
      setError(validationError);
      return;
    }

    const ok = await requestAuth('Confirm Upload');
    if (!ok) {
      setError('Upload cancelled.');
      return;
    }

    setUploading(true);
    try {
      const checkRes = await fetch(`${API_URL}?filename=${encodeURIComponent(file.name)}`);
      const checkJson = await checkRes.json();
      if (!checkRes.ok) {
        throw new Error(checkJson.error || 'Filename validation failed');
      }

      let overwrite = false;
      if (checkJson.exists) {
        overwrite = window.confirm(`${file.name} already exists. Overwrite it?`);
        if (!overwrite) {
          setUploading(false);
          setMessage('Upload cancelled. Existing file was not overwritten.');
          return;
        }
      }

      const form = new FormData();
      form.append('file', file);
      form.append('overwrite', overwrite ? 'true' : 'false');

      const uploadRes = await fetch(API_URL, { method: 'POST', body: form });
      const uploadJson = await uploadRes.json();
      if (!uploadRes.ok) {
        throw new Error(uploadJson.error || 'Upload failed');
      }

      const okMsg = uploadJson.message || 'File uploaded successfully.';
      setMessage(okMsg);
      setError('');
      showNotif?.(okMsg);
    } catch (err) {
      const msg = err?.message || 'Upload failed';
      setError(msg);
      setMessage('');
      showNotif?.(msg, 'error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fade-in">
      {!authorized ? null : (
      <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button
          type="button"
          className="admin-sidebar-toggle"
          onClick={() => setAdminSidebarOpen(true)}
          aria-label="Open admin management sidebar"
          title="Open Admin Management"
        >
          <span />
          <span />
          <span />
        </button>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#1e293b' }}>Admin</h2>
      </div>

      <div style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 16, color: '#0f172a' }}>Upload Attendance Report File</h3>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: '#64748b' }}>
          Accepted format: <strong>Month_Year.xls</strong> or <strong>Month_Year.xlsx</strong> (example: <strong>December_2025.xlsx</strong>).
        </p>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          style={{
            border: `2px dashed ${dragging ? '#2563eb' : '#cbd5e1'}`,
            background: dragging ? '#eff6ff' : '#f8fafc',
            borderRadius: 12,
            minHeight: 160,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            padding: 16,
            marginBottom: 16,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 14, color: '#334155' }}>Drag and drop Excel file here</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>or</div>
          <button
            type="button"
            onClick={handlePick}
            style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #2563eb', background: '#eff6ff', color: '#1d4ed8', cursor: 'pointer', fontWeight: 600 }}
          >
            Open File
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".xls,.xlsx"
            onChange={onInputChange}
            style={{ display: 'none' }}
          />
        </div>

        <div style={{ fontSize: 13, marginBottom: 12, color: '#334155' }}>
          Selected file: <strong>{file ? file.name : 'None'}</strong>
        </div>

        {validationError && <div style={{ marginBottom: 12, color: '#dc2626', fontSize: 13 }}>{validationError}</div>}
        {error && <div style={{ marginBottom: 12, color: '#dc2626', fontSize: 13 }}>{error}</div>}
        {message && <div style={{ marginBottom: 12, color: '#16a34a', fontSize: 13 }}>{message}</div>}

        <button
          type="button"
          onClick={uploadFile}
          disabled={uploading || !file}
          style={{
            padding: '10px 16px',
            border: 'none',
            borderRadius: 9,
            background: uploading || !file ? '#94a3b8' : '#2563eb',
            color: '#fff',
            cursor: uploading || !file ? 'not-allowed' : 'pointer',
            fontWeight: 600,
          }}
        >
          {uploading ? 'Uploading...' : 'Upload and Process'}
        </button>
      </div>
      </>
      )}
      {authorized && (
        <>
          <div
            className={`admin-sidebar-overlay ${adminSidebarOpen ? 'open' : ''}`}
            onClick={() => setAdminSidebarOpen(false)}
          />
          <aside
            className={`admin-sidebar ${adminSidebarOpen ? 'open' : ''}`}
            aria-label="Admin management"
            onClick={() => { setActiveAdminSection(null); setActiveEmployeeSection(null); }}
          >
            <div className="admin-sidebar-head">
              <h3>Admin Management</h3>
              <button
                type="button"
                className="admin-sidebar-close"
                onClick={() => setAdminSidebarOpen(false)}
                aria-label="Close admin management sidebar"
              >
                x
              </button>
            </div>
            <div className="admin-sidebar-body" onClick={(e) => e.stopPropagation()}>
            <div className="admin-sidebar-top">
            <div className="admin-sidebar-tabs">
              <button
                type="button"
                className={`admin-sidebar-tab ${activeAdminSection === 'new' ? 'active' : ''}`}
                onClick={() => setActiveAdminSection((prev) => (prev === 'new' ? null : 'new'))}
              >
                New Admin
              </button>
              <button
                type="button"
                className={`admin-sidebar-tab ${activeAdminSection === 'update' ? 'active' : ''}`}
                onClick={() => setActiveAdminSection((prev) => (prev === 'update' ? null : 'update'))}
              >
                Update Admin
              </button>
              <button
                type="button"
                className={`admin-sidebar-tab ${activeAdminSection === 'delete' ? 'active' : ''}`}
                onClick={() => setActiveAdminSection((prev) => (prev === 'delete' ? null : 'delete'))}
              >
                Delete Admin
              </button>
            </div>

            <div>
            {activeAdminSection === 'new' && (
              <div className="admin-sidebar-card" onClick={(e) => e.stopPropagation()}>
                <div className="admin-sidebar-card-title">New Admin</div>
                <label className="admin-sidebar-label">Username</label>
                <input
                  value={newAdminUser}
                  onChange={(e) => setNewAdminUser(e.target.value)}
                  className="admin-sidebar-input"
                />
                <label className="admin-sidebar-label">Password</label>
                <input
                  type="password"
                  value={newAdminPass}
                  onChange={(e) => setNewAdminPass(e.target.value)}
                  className="admin-sidebar-input"
                />
                <button
                  type="button"
                  onClick={handleCreateAdmin}
                  className="admin-sidebar-btn admin-sidebar-btn-green"
                >
                  Add Admin
                </button>
              </div>
            )}

            {activeAdminSection === 'update' && (
              <div className="admin-sidebar-card" onClick={(e) => e.stopPropagation()}>
                <div className="admin-sidebar-card-title">Update Admin</div>
                <label className="admin-sidebar-label">Admin Name</label>
                <select
                  value={updateAdminName}
                  onChange={(e) => setUpdateAdminName(e.target.value)}
                  className="admin-sidebar-input"
                >
                  {adminNames.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
                <label className="admin-sidebar-label">Password</label>
                <input
                  type="password"
                  value={updatePass}
                  onChange={(e) => setUpdatePass(e.target.value)}
                  className="admin-sidebar-input"
                />
                <button
                  type="button"
                  onClick={handleUpdateAdmin}
                  className="admin-sidebar-btn admin-sidebar-btn-blue"
                >
                  Save
                </button>
              </div>
            )}

            {activeAdminSection === 'delete' && (
              <div className="admin-sidebar-card" onClick={(e) => e.stopPropagation()}>
                <div className="admin-sidebar-card-title">Delete Admin</div>
                <label className="admin-sidebar-label">Admin Name</label>
                <select
                  value={deleteAdminName}
                  onChange={(e) => setDeleteAdminName(e.target.value)}
                  className="admin-sidebar-input"
                >
                  {adminNames.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleDeleteAdmin}
                  className="admin-sidebar-btn admin-sidebar-btn-red"
                >
                  Delete Admin
                </button>
              </div>
            )}
            </div>
            </div>

            <div className="admin-sidebar-divider admin-sidebar-divider-employee" />
            <div className="admin-sidebar-employee-footer">
              <div className="admin-sidebar-tabs admin-sidebar-tabs-employee">
                <button
                  type="button"
                  className={`admin-sidebar-tab ${activeEmployeeSection === 'new' ? 'active' : ''}`}
                  onClick={() => setActiveEmployeeSection((prev) => (prev === 'new' ? null : 'new'))}
                >
                  New Employee
                </button>
                <button
                  type="button"
                  className={`admin-sidebar-tab ${activeEmployeeSection === 'update' ? 'active' : ''}`}
                  onClick={() => setActiveEmployeeSection((prev) => (prev === 'update' ? null : 'update'))}
                >
                  Update Employee
                </button>
                <button
                  type="button"
                  className={`admin-sidebar-tab ${activeEmployeeSection === 'delete' ? 'active' : ''}`}
                  onClick={() => setActiveEmployeeSection((prev) => (prev === 'delete' ? null : 'delete'))}
                >
                  Delete Employee
                </button>
              </div>

              <div className="admin-sidebar-employee-grid">
                <div>
                  {activeEmployeeSection === 'new' && (
                    <div className="admin-sidebar-card" onClick={(e) => e.stopPropagation()}>
                      <div className="admin-sidebar-card-title">New Employee</div>
                      <label className="admin-sidebar-label">Name</label>
                      <input
                        value={newEmpName}
                        onChange={(e) => setNewEmpName(e.target.value)}
                        className="admin-sidebar-input"
                      />
                      <label className="admin-sidebar-label">Username</label>
                      <input
                        value={newEmpUsername}
                        onChange={(e) => setNewEmpUsername(e.target.value)}
                        className="admin-sidebar-input"
                      />
                      <label className="admin-sidebar-label">Password</label>
                      <input
                        type="password"
                        value={newEmpPassword}
                        onChange={(e) => setNewEmpPassword(e.target.value)}
                        className="admin-sidebar-input"
                      />
                      <label className="admin-sidebar-label">Department</label>
                      <select
                        value={newEmpDepartmentId}
                        onChange={(e) => setNewEmpDepartmentId(e.target.value)}
                        className="admin-sidebar-input"
                      >
                        <option value="">Select department</option>
                        {departments.map((dept) => (
                          <option key={dept.id} value={dept.id}>{dept.name}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={handleCreateEmployee}
                        className="admin-sidebar-btn admin-sidebar-btn-green"
                      >
                        Add Employee
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  {activeEmployeeSection === 'update' && (
                    <div className="admin-sidebar-card" onClick={(e) => e.stopPropagation()}>
                      <div className="admin-sidebar-card-title">Update Employee</div>
                      <label className="admin-sidebar-label">Employee Name</label>
                      <select
                        value={updateEmpId}
                        onChange={(e) => {
                          const nextId = e.target.value;
                          setUpdateEmpId(nextId);
                          const creds = getEmployeeCreds().find((c) => String(c.employeeId) === String(nextId));
                          setUpdateEmpUsername(creds?.username || '');
                          setUpdateEmpOldPassword('');
                          setUpdateEmpNewPassword('');
                        }}
                        className="admin-sidebar-input"
                      >
                        <option value="">Select employee</option>
                        {sortedEmployees.map((emp) => (
                          <option key={emp.id} value={emp.id}>{emp.name}</option>
                        ))}
                      </select>
                      <label className="admin-sidebar-label">Username</label>
                      <input
                        value={updateEmpUsername}
                        onChange={(e) => setUpdateEmpUsername(e.target.value)}
                        className="admin-sidebar-input"
                      />
                      <label className="admin-sidebar-label">Old Password</label>
                      <input
                        type="password"
                        value={updateEmpOldPassword}
                        onChange={(e) => setUpdateEmpOldPassword(e.target.value)}
                        className="admin-sidebar-input"
                      />
                      <label className="admin-sidebar-label">New Password</label>
                      <input
                        type="password"
                        value={updateEmpNewPassword}
                        onChange={(e) => setUpdateEmpNewPassword(e.target.value)}
                        className="admin-sidebar-input"
                      />
                      <button
                        type="button"
                        onClick={handleUpdateEmployee}
                        className="admin-sidebar-btn admin-sidebar-btn-blue"
                      >
                        Save
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  {activeEmployeeSection === 'delete' && (
                    <div className="admin-sidebar-card" onClick={(e) => e.stopPropagation()}>
                      <div className="admin-sidebar-card-title">Delete Employee</div>
                      <label className="admin-sidebar-label">Employee Name</label>
                      <select
                        value={deleteEmpId}
                        onChange={(e) => setDeleteEmpId(e.target.value)}
                        className="admin-sidebar-input"
                      >
                    <option value="">Select employee</option>
                    {sortedEmployees.map((emp) => (
                      <option key={emp.id} value={emp.id}>{emp.name}</option>
                    ))}
                  </select>
                      <button
                        type="button"
                        onClick={handleDeleteEmployee}
                        className="admin-sidebar-btn admin-sidebar-btn-red"
                      >
                        Delete Employee
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
            </div>
          </aside>
        </>
      )}
      {authOpen && (
        <div className="admin-auth-overlay">
          <div className="admin-auth-modal" role="dialog" aria-modal="true" aria-label={authTitle}>
            <h3 className="admin-auth-title">{authTitle}</h3>
            <p className="admin-auth-subtitle">Enter admin username and password to continue.</p>
            <form onSubmit={submitAuth}>
              <label className="admin-auth-label">Username</label>
              <input
                className="admin-auth-input"
                value={authUser}
                onChange={(e) => setAuthUser(e.target.value)}
                autoFocus
              />
              <label className="admin-auth-label">Password</label>
              <input
                type="password"
                className="admin-auth-input"
                value={authPass}
                onChange={(e) => setAuthPass(e.target.value)}
              />
              {authError && <div className="admin-auth-error">{authError}</div>}
              <div className="admin-auth-actions">
                <button type="button" className="admin-auth-btn admin-auth-btn-ghost" onClick={() => resolveAuth(false)}>
                  Cancel
                </button>
                <button type="submit" className="admin-auth-btn admin-auth-btn-primary">
                  Continue
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {confirmOpen && (
        <div className="admin-confirm-overlay">
          <div className="admin-confirm-modal" role="dialog" aria-modal="true" aria-label="Confirmation">
            <h3 className="admin-confirm-title">Please Confirm</h3>
            <p className="admin-confirm-message">{confirmMessage}</p>
            <div className="admin-confirm-actions">
              <button type="button" className="admin-confirm-btn admin-confirm-btn-ghost" onClick={() => resolveConfirm(false)}>
                Cancel
              </button>
              <button type="button" className="admin-confirm-btn admin-confirm-btn-primary" onClick={() => resolveConfirm(true)}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
