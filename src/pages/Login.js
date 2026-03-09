import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Login.css';
import { validateAdminCredentials } from '../utils/adminUsersStorage';

export default function Login({ onLogin }) {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validateAdminCredentials(username, password)) {
      setError('');
      onLogin();
      navigate('/home', { replace: true });
      return;
    }
    setError('Invalid credentials.');
  };

  return (
    <div style={{ minHeight: '100vh', position: 'relative', overflow: 'hidden' }}>
      <img
        src="/wallpaper.jpeg"
        alt="Login visual"
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
            <h1 style={{ margin: 0, color: '#0f172a', fontSize: 28, fontWeight: 700 }}>Welcome Back</h1>
          </div>
          <p style={{ margin: '8px 0 22px', color: '#475569', fontSize: 14 }}>Sign in to Attendance Analytics</p>

          <form onSubmit={handleSubmit}>
            <label style={{ display: 'block', fontSize: 13, color: '#334155', marginBottom: 6 }}>Username</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              style={{ width: '100%', height: 44, borderRadius: 10, border: '1px solid #cbd5e1', padding: '0 12px', fontSize: 14, marginBottom: 14, outline: 'none' }}
            />

            <label style={{ display: 'block', fontSize: 13, color: '#334155', marginBottom: 6 }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              style={{ width: '100%', height: 44, borderRadius: 10, border: '1px solid #cbd5e1', padding: '0 12px', fontSize: 14, marginBottom: 10, outline: 'none' }}
            />

            {error && <div style={{ color: '#b91c1c', fontSize: 13, marginBottom: 10 }}>{error}</div>}

            <button
              type="submit"
              style={{ width: '100%', height: 44, border: 'none', borderRadius: 10, cursor: 'pointer', background: '#0f766e', color: '#fff', fontSize: 14, fontWeight: 600 }}
            >
              Login
            </button>
          </form>

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
