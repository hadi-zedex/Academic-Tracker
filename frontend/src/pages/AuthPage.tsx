import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Briefcase, Lock, Mail, User, ArrowRight } from 'lucide-react';

export const AuthPage: React.FC = () => {
  const { login, signup } = useAuth();
  const { showToast } = useToast();

  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [studentName, setStudentName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      showToast('Please enter your email and password', 'warning');
      return;
    }

    try {
      setIsSubmitting(true);
      if (mode === 'login') {
        await login({ email: email.trim(), password });
        showToast('Welcome back! Signed in successfully.', 'success');
      } else {
        if (!studentName.trim()) {
          showToast('Please enter your full name', 'warning');
          return;
        }
        await signup({
          student_name: studentName.trim(),
          email: email.trim(),
          password,
        });
        showToast('Account created successfully! Welcome to Placement Tracker.', 'success');
      }
    } catch (err: any) {
      showToast(err.detail || 'Authentication failed. Please check your credentials.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ padding: '32px 20px', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <div className="app-logo-icon" style={{ width: '48px', height: '48px', margin: '0 auto 12px', borderRadius: '12px' }}>
          <Briefcase size={26} />
        </div>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)' }}>Placement Tracker</h1>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
          Never miss an application deadline or OA round
        </p>
      </div>

      <div className="sub-tabs-bar" style={{ borderRadius: '8px', border: '1px solid var(--border-main)', marginBottom: '20px' }}>
        <button
          type="button"
          className={`sub-tab ${mode === 'login' ? 'active' : ''}`}
          onClick={() => setMode('login')}
        >
          Sign In
        </button>
        <button
          type="button"
          className={`sub-tab ${mode === 'signup' ? 'active' : ''}`}
          onClick={() => setMode('signup')}
        >
          Sign Up
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        {mode === 'signup' && (
          <div className="form-group-mobile">
            <label className="form-label-mobile" htmlFor="auth_name">Full Name</label>
            <div style={{ position: 'relative' }}>
              <input
                id="auth_name"
                type="text"
                className="form-input-mobile"
                style={{ paddingLeft: '36px' }}
                placeholder="Your Full Name"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                required
              />
              <User size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
            </div>
          </div>
        )}

        <div className="form-group-mobile">
          <label className="form-label-mobile" htmlFor="auth_email">College Email</label>
          <div style={{ position: 'relative' }}>
            <input
              id="auth_email"
              type="email"
              className="form-input-mobile"
              style={{ paddingLeft: '36px' }}
              placeholder="student@college.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Mail size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
          </div>
        </div>

        <div className="form-group-mobile">
          <label className="form-label-mobile" htmlFor="auth_password">Password</label>
          <div style={{ position: 'relative' }}>
            <input
              id="auth_password"
              type="password"
              className="form-input-mobile"
              style={{ paddingLeft: '36px' }}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <Lock size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
          </div>
        </div>

        <button
          type="submit"
          className="btn-primary-mobile"
          style={{ width: '100%', justifyContent: 'center', padding: '12px', marginTop: '12px' }}
          disabled={isSubmitting}
        >
          <span>{isSubmitting ? 'Please wait...' : mode === 'login' ? 'Sign In to Tracker' : 'Create Account'}</span>
          <ArrowRight size={16} />
        </button>
      </form>
    </div>
  );
};
