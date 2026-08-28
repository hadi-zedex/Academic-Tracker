import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import {
  Calendar as CalendarIcon,
  Clock,
  Briefcase,
  FileCheck2,
  Bell,
  LogOut,
  Plus,
  Sun,
  Moon,
  BookOpen,
} from 'lucide-react';
import { NotificationDrawer } from './NotificationDrawer';

export type ActiveTab = 'monthly' | 'daily' | 'jobs' | 'tests';

interface NavbarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  onOpenCreateJob: () => void;
  currentTheme: 'dark' | 'light' | 'journal';
  onToggleTheme: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onTabChange,
  onOpenCreateJob,
  currentTheme,
  onToggleTheme,
}) => {
  const { student, logout, isAdmin } = useAuth();
  const { unreadCount } = useNotifications();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const getThemeIcon = () => {
    switch (currentTheme) {
      case 'dark':
        return <Sun size={18} />;
      case 'light':
        return <BookOpen size={18} />;
      case 'journal':
        return <Moon size={18} />;
    }
  };

  const getThemeTooltip = () => {
    switch (currentTheme) {
      case 'dark':
        return 'Switch to Light Theme';
      case 'light':
        return 'Switch to Journal Paper Theme';
      case 'journal':
        return 'Switch to Dark Theme';
    }
  };

  return (
    <>
      <header className="navbar">
        <div className="navbar-inner">
          <div className="brand" role="button" onClick={() => onTabChange('monthly')}>
            <div className="brand-icon">
              <CalendarIcon size={20} />
            </div>
            <div className="brand-info">
              <span className="brand-title">Placement Tracker</span>
              <span className="brand-subtitle">Bullet Journal Edition</span>
            </div>
          </div>

          <nav className="nav-tabs" aria-label="Main Navigation">
            <button
              className={`nav-tab ${activeTab === 'monthly' ? 'active' : ''}`}
              onClick={() => onTabChange('monthly')}
            >
              <CalendarIcon size={16} />
              <span>Monthly Grid</span>
            </button>
            <button
              className={`nav-tab ${activeTab === 'daily' ? 'active' : ''}`}
              onClick={() => onTabChange('daily')}
            >
              <Clock size={16} />
              <span>Daily Agenda</span>
            </button>
            <button
              className={`nav-tab ${activeTab === 'jobs' ? 'active' : ''}`}
              onClick={() => onTabChange('jobs')}
            >
              <Briefcase size={16} />
              <span>Jobs & Events</span>
            </button>
            <button
              className={`nav-tab ${activeTab === 'tests' ? 'active' : ''}`}
              onClick={() => onTabChange('tests')}
            >
              <FileCheck2 size={16} />
              <span>Practice Tests</span>
            </button>
          </nav>

          <div className="nav-actions">
            <button
              className="btn btn-sm btn-primary"
              onClick={onOpenCreateJob}
              title={isAdmin ? 'Post a new job for the batch' : 'Add a personal job to track'}
            >
              <Plus size={15} />
              <span>{isAdmin ? 'Post Job' : 'Add Job'}</span>
            </button>

            <button
              className="icon-btn"
              onClick={() => setIsDrawerOpen(!isDrawerOpen)}
              aria-label="Open notifications"
            >
              <Bell size={18} />
              {unreadCount > 0 && <span className="badge-dot">{unreadCount}</span>}
            </button>

            <button
              className="icon-btn"
              onClick={onToggleTheme}
              title={getThemeTooltip()}
              aria-label="Toggle visual theme"
            >
              {getThemeIcon()}
            </button>

            {student && (
              <div className="user-profile-chip">
                <div className="avatar-initial">
                  {student.student_name.charAt(0).toUpperCase()}
                </div>
                <div className="user-info">
                  <span className="user-name">
                    {student.student_name}
                    {isAdmin && <span className="admin-tag">Admin</span>}
                  </span>
                </div>
                <button
                  className="btn-logout"
                  onClick={logout}
                  title="Log out"
                  aria-label="Log out"
                >
                  <LogOut size={15} />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <NotificationDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
      />
    </>
  );
};
