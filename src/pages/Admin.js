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

const API_URL = window.location.protocol === 'file:' ? '' : '/upload_reports.php';
const NAME_RE = /^(January|February|March|April|May|June|July|August|September|October|November|December)_\d{4}\.(xls|xlsx)$/;

export default function Admin({ showNotif }) {
  const navigate = useNavigate();
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
  const [adminNames, setAdminNames] = useState(() => getAdminUsernames());
  const [newAdminUser, setNewAdminUser] = useState('');
  const [newAdminPass, setNewAdminPass] = useState('');
  const [updateAdminName, setUpdateAdminName] = useState('');
  const [updatePass, setUpdatePass] = useState('');
  const [deleteAdminName, setDeleteAdminName] = useState('');
  const [adminSidebarOpen, setAdminSidebarOpen] = useState(false);
  const [activeAdminSection, setActiveAdminSection] = useState('new');
  const inputRef = useRef(null);
  const authResolveRef = useRef(null);

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

  const resolveAuth = (ok) => {
    setAuthOpen(false);
    if (authResolveRef.current) {
      authResolveRef.current(ok);
      authResolveRef.current = null;
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
        navigate('/home', { replace: true });
        return;
      }
      setAuthorized(true);
    })();
    return () => {
      alive = false;
      if (authResolveRef.current) {
        authResolveRef.current(false);
        authResolveRef.current = null;
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
          <aside className={`admin-sidebar ${adminSidebarOpen ? 'open' : ''}`} aria-label="Admin management">
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
            <div className="admin-sidebar-tabs">
              <button
                type="button"
                className={`admin-sidebar-tab ${activeAdminSection === 'new' ? 'active' : ''}`}
                onClick={() => setActiveAdminSection('new')}
              >
                New Admin
              </button>
              <button
                type="button"
                className={`admin-sidebar-tab ${activeAdminSection === 'update' ? 'active' : ''}`}
                onClick={() => setActiveAdminSection('update')}
              >
                Update Admin
              </button>
              <button
                type="button"
                className={`admin-sidebar-tab ${activeAdminSection === 'delete' ? 'active' : ''}`}
                onClick={() => setActiveAdminSection('delete')}
              >
                Delete Admin
              </button>
            </div>

            {activeAdminSection === 'new' && (
              <div className="admin-sidebar-card">
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
              <div className="admin-sidebar-card">
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
              <div className="admin-sidebar-card">
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
    </div>
  );
}
