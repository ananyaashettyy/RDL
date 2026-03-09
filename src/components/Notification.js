import React from 'react';

export default function Notification({ notification }) {
  if (!notification) return null;
  return (
    <div style={{
      position: 'fixed', top: 20, right: 20, zIndex: 9999,
      background: notification.type === 'error' ? '#dc2626' : '#16a34a',
      color: '#fff', padding: '12px 20px', borderRadius: 10,
      boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
      fontSize: 14, fontWeight: 500, animation: 'slideIn 0.3s ease',
      maxWidth: 320,
    }}>
      {notification.msg}
    </div>
  );
}
