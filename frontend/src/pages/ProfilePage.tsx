import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Mail, LogOut } from 'lucide-react';

export const ProfilePage: React.FC = () => {
  const { student, logout } = useAuth();

  if (!student) return null;

  return (
    <div className="profile-page-container" style={{ padding: '16px' }}>
      {/* Profile Card */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          border: '1px solid var(--border-main)',
          padding: '28px 20px',
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
            margin: '0 auto 14px',
            boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)',
          }}
        >
          {student.student_name.charAt(0).toUpperCase()}
        </div>

        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>
          {student.student_name}
        </h2>

        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
          {student.email}
        </p>
      </div>

      {/* Account Details */}
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
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.875rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
            <Mail size={16} />
            <span>Email Address</span>
          </div>
          <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{student.email}</span>
        </div>
      </div>

      {/* Logout Button */}
      <button
        className="btn-outline-mobile"
        onClick={logout}
        style={{ width: '100%', justifyContent: 'center', color: 'var(--accent-red)', padding: '12px', fontWeight: 600 }}
      >
        <LogOut size={16} />
        <span>Log Out</span>
      </button>
    </div>
  );
};
