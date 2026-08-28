import React, { useState } from 'react';
import { useNotifications } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';
import { Bell, Briefcase, Plus } from 'lucide-react';
import { NotificationDrawer } from './NotificationDrawer';

interface MobileHeaderProps {
  title: string;
  onOpenCreateJob?: () => void;
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({
  title,
  onOpenCreateJob,
}) => {
  const { unreadCount } = useNotifications();
  const { isAdmin } = useAuth();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  return (
    <>
      <header className="mobile-header">
        <div className="mobile-header-left">
          <div className="app-logo-icon">
            <Briefcase size={18} />
          </div>
          <h1 className="mobile-header-title">{title}</h1>
        </div>

        <div className="mobile-header-actions">
          {onOpenCreateJob && (
            <button
              className="header-icon-btn"
              onClick={onOpenCreateJob}
              title={isAdmin ? 'Post a new shared job for the batch' : 'Add a personal job'}
              aria-label="Add job"
            >
              <Plus size={20} />
            </button>
          )}

          <button
            className="header-icon-btn"
            onClick={() => setIsDrawerOpen(!isDrawerOpen)}
            aria-label="Open notifications"
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="notification-badge-pill">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
        </div>
      </header>

      <NotificationDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
      />
    </>
  );
};
