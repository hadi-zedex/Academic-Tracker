import React from 'react';
import { useAuth } from '../context/AuthContext';
import { User, Mail, Shield, LogOut, ArrowRight } from 'lucide-react';

export const ProfilePage: React.FC = () => {
  const { student, isAdmin, logout, login } = useAuth();

  const handleSwitchAccount = async (email: string) => {
    try {
      await login({ email, password: 'password123' });
    } catch {
      // ignore
    }
  };

  if (!student) return null;

  return (
    <div className="profile-page-container" style={{ padding: '16px' }}>
      {/* Profile Card */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          border: '1px solid var(--border-main)',
          padding: '24px 20px',
          textAlign: 'center',
          boxShadow: 'var(--shadow-sm)',
          marginBottom: '16px',
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)',
            color: '#ffffff',
            fontSize: '1.5rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 12px',
            boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)',
          }}
        >
          {student.student_name.charAt(0).toUpperCase()}
        </div>

        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>
          {student.student_name}
        </h2>

        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
          {student.email}
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '10px' }}>
          <span
            className={`status-tag ${isAdmin ? 'status-shared-admin' : 'status-open'}`}
            style={{ padding: '4px 12px', fontSize: '0.8rem' }}
          >
            {isAdmin ? '👑 Admin (Batch Coordinator)' : '🎓 Student'}
          </span>
        </div>
      </div>

      {/* Account Info List */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid var(--border-main)',
          overflow: 'hidden',
          marginBottom: '16px',
        }}
      >
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--border-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.85rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
            <User size={16} />
            <span>Student ID</span>
          </div>
          <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>#{student.student_id}</span>
        </div>

        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--border-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.85rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
            <Mail size={16} />
            <span>College Email</span>
          </div>
          <span style={{ fontWeight: 600 }}>{student.email}</span>
        </div>

        <div
          style={{
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.85rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
            <Shield size={16} />
            <span>Role Permissions</span>
          </div>
          <span style={{ fontWeight: 600 }}>{isAdmin ? 'Batch Broadcast' : 'Personal Tracking'}</span>
        </div>
      </div>

      {/* Quick Test Accounts Switcher */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid var(--border-main)',
          padding: '16px',
          marginBottom: '16px',
        }}
      >
        <h4 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Shield size={15} className="text-primary" />
          <span>Switch Test Account</span>
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <button
            className="btn-outline-mobile"
            onClick={() => handleSwitchAccount('alice@test.com')}
            style={{ justifyContent: 'space-between', width: '100%' }}
          >
            <span>👑 Alice (Admin)</span>
            <ArrowRight size={14} />
          </button>
          <button
            className="btn-outline-mobile"
            onClick={() => handleSwitchAccount('bob@test.com')}
            style={{ justifyContent: 'space-between', width: '100%' }}
          >
            <span>🎓 Bob (Student)</span>
            <ArrowRight size={14} />
          </button>
          <button
            className="btn-outline-mobile"
            onClick={() => handleSwitchAccount('carl@test.com')}
            style={{ justifyContent: 'space-between', width: '100%' }}
          >
            <span>🎓 Carl (Student)</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>

      {/* Logout Button */}
      <button
        className="btn-outline-mobile"
        onClick={logout}
        style={{ width: '100%', justifyContent: 'center', color: 'var(--accent-red)', padding: '12px' }}
      >
        <LogOut size={16} />
        <span>Log Out of Placement Tracker</span>
      </button>
    </div>
  );
};
