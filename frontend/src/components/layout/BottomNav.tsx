import React from 'react';
import { Home, Briefcase, CalendarCheck, FileCheck2, User } from 'lucide-react';
import type { MobileTab } from '../../types';

interface BottomNavProps {
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onTabChange,
}) => {
  return (
    <nav className="bottom-nav" aria-label="Bottom Navigation">
      <button
        className={`nav-item ${activeTab === 'home' ? 'active' : ''}`}
        onClick={() => onTabChange('home')}
      >
        <Home size={20} />
        <span>Home</span>
      </button>

      <button
        className={`nav-item ${activeTab === 'jobs' ? 'active' : ''}`}
        onClick={() => onTabChange('jobs')}
      >
        <Briefcase size={20} />
        <span>Job Profiles</span>
      </button>

      <button
        className={`nav-item ${activeTab === 'events' ? 'active' : ''}`}
        onClick={() => onTabChange('events')}
      >
        <CalendarCheck size={20} />
        <span>Events</span>
      </button>

      <button
        className={`nav-item ${activeTab === 'assessments' ? 'active' : ''}`}
        onClick={() => onTabChange('assessments')}
      >
        <FileCheck2 size={20} />
        <span>Assessments</span>
      </button>

      <button
        className={`nav-item ${activeTab === 'profile' ? 'active' : ''}`}
        onClick={() => onTabChange('profile')}
      >
        <User size={20} />
        <span>Profile</span>
      </button>
    </nav>
  );
};
