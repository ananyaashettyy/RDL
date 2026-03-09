import React, { useState } from 'react';
import { DEPARTMENTS as DEFAULT_DEPTS, SECTIONS_DEFAULT } from '../data/employees';

export default function Masters({ showNotif }) {
  const [tab,        setTab]        = useState('DEPARTMENT');
  const [depts,      setDepts]      = useState(DEFAULT_DEPTS);
  const [sections,   setSections]   = useState(SECTIONS_DEFAULT);
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [showSecModal,  setShowSecModal]  = useState(false);
  const [newDept,    setNewDept]    = useState({ name: '', description: '' });
  const [newSec,     setNewSec]     = useState({ name: '', department: '', description: '' });

  const addDept = () => {
    if (!newDept.name.trim()) return;
    setDepts(p => [...p, { id: p.length + 1, ...newDept }]);
    setNewDept({ name: '', description: '' });
    setShowDeptModal(false);
    showNotif('Department added successfully!');
  };

  const addSec = () => {
    if (!newSec.name.trim() || !newSec.department) return;
    setSections(p => [...p, { id: p.length + 1, ...newSec }]);
    setNewSec({ name: '', department: '', description: '' });
    setShowSecModal(false);
    showNotif('Section added successfully!');
  };

  return (
    <div className="fade-in">
      <div style={{ background: '#fff', borderRadius: 14, padding: 28, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '2px solid #e2e8f0', marginBottom: 24 }}>
          {['DEPARTMENT','SECTION'].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ padding: '10px 28px', border: 'none', cursor: 'pointer', background: 'transparent', fontFamily: 'inherit', fontSize: 14, fontWeight: tab===t?700:500, color: tab===t?'#2563eb':'#94a3b8', borderBottom: tab===t?'2px solid #2563eb':'2px solid transparent', marginBottom: -2 }}>{t}</button>
          ))}
        </div>

        {/* DEPARTMENT */}
        {tab === 'DEPARTMENT' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Departments</h3>
              <button onClick={() => setShowDeptModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', background: '#2563eb', color: '#fff', fontWeight: 600, fontSize: 13, fontFamily: 'inherit' }}>+ ADD DEPARTMENT</button>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                  {['ID','Department Name','Description','Actions'].map(h => <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: 13 }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {depts.map(d => (
                  <tr key={d.id} style={{ borderBottom: '1px solid #f1f5f9' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '13px 16px', color: '#94a3b8' }}>{d.id}</td>
                    <td style={{ padding: '13px 16px', fontWeight: 600 }}>{d.name}</td>
                    <td style={{ padding: '13px 16px', color: '#475569' }}>{d.description}</td>
                    <td style={{ padding: '13px 16px' }}>
                      <button onClick={() => { setDepts(p => p.filter(x => x.id !== d.id)); showNotif('Department removed.', 'error'); }} style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid #fca5a5', background: '#fff5f5', color: '#ef4444', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* SECTION */}
        {tab === 'SECTION' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Sections</h3>
              <button onClick={() => setShowSecModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', background: '#2563eb', color: '#fff', fontWeight: 600, fontSize: 13, fontFamily: 'inherit' }}>+ ADD SECTION</button>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                  {['Section ID','Section Name','Department','Description','Actions'].map(h => <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: 13 }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {sections.map(s => (
                  <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '13px 16px', color: '#94a3b8' }}>{s.id}</td>
                    <td style={{ padding: '13px 16px', fontWeight: 600 }}>{s.name}</td>
                    <td style={{ padding: '13px 16px', color: '#475569' }}>{s.department}</td>
                    <td style={{ padding: '13px 16px', color: '#475569' }}>{s.description}</td>
                    <td style={{ padding: '13px 16px' }}>
                      <button onClick={() => { setSections(p => p.filter(x => x.id !== s.id)); showNotif('Section removed.', 'error'); }} style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid #fca5a5', background: '#fff5f5', color: '#ef4444', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      {/* Add Dept Modal */}
      {showDeptModal && (
        <Modal title="Add Department" onClose={() => setShowDeptModal(false)} onSubmit={addDept}>
          <Field label="Department Name" value={newDept.name} onChange={v => setNewDept(p => ({...p, name: v}))} />
          <Field label="Description" value={newDept.description} onChange={v => setNewDept(p => ({...p, description: v}))} multiline />
        </Modal>
      )}

      {/* Add Section Modal */}
      {showSecModal && (
        <Modal title="Add Section" onClose={() => setShowSecModal(false)} onSubmit={addSec}>
          <Field label="Section Name" value={newSec.name} onChange={v => setNewSec(p => ({...p, name: v}))} />
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 13, color: '#475569', fontWeight: 500 }}>Department:</label>
            <select value={newSec.department} onChange={e => setNewSec(p => ({...p, department: e.target.value}))} style={{ width: '100%', marginTop: 6, padding: '10px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14, fontFamily: 'inherit' }}>
              <option value="">Select department…</option>
              {depts.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
            </select>
          </div>
          <Field label="Description" value={newSec.description} onChange={v => setNewSec(p => ({...p, description: v}))} multiline />
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, children, onClose, onSubmit }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 32, width: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <h3 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700, color: '#1e293b' }}>{title}</h3>
        {children}
        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          <button onClick={onSubmit} style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: '#2563eb', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>ADD</button>
          <button onClick={onClose}  style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', color: '#ef4444', fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>CANCEL</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, multiline }) {
  const style = { width: '100%', marginTop: 6, padding: '10px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', resize: 'none' };
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 13, color: '#475569', fontWeight: 500 }}>{label}:</label>
      {multiline
        ? <textarea rows={3} value={value} onChange={e => onChange(e.target.value)} style={style} />
        : <input value={value} onChange={e => onChange(e.target.value)} style={style} />
      }
    </div>
  );
}
