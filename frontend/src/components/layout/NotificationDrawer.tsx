import React from 'react';
import { useNotifications } from '../../context/NotificationContext';
import { useToast } from '../../context/ToastContext';
import { Bell, Check, Clock, CheckCheck, Briefcase, Calendar, X } from 'lucide-react';
import type { NotificationType } from '../../types';

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({ isOpen, onClose }) => {
  const { notifications, markAsRead, markAllAsRead, unreadCount } = useNotifications();
  const { showToast } = useToast();

  if (!isOpen) return null;

  const handleMarkRead = async (id: number) => {
    try {
      await markAsRead(id);
      showToast('Notification dismissed', 'info');
    } catch {
      showToast('Failed to update notification', 'error');
    }
  };

  const handleMarkAll = async () => {
    try {
      await markAllAsRead();
      showToast('All notifications marked as read', 'success');
    } catch {
      showToast('Failed to mark all as read', 'error');
    }
  };

  const getTypeIcon = (type: NotificationType) => {
    switch (type) {
      case '1hr':
        return <Clock size={13} className="text-red-500" />;
      case '3hr':
      case '8pm':
        return <Calendar size={13} className="text-blue-500" />;
      case 'post':
        return <Briefcase size={13} className="text-emerald-500" />;
      default:
        return <Bell size={13} />;
    }
  };

  const formatTimestamp = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' });
    } catch {
      return iso;
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content-mobile" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header-mobile">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Bell size={18} className="text-primary" />
            <h3 className="modal-title-mobile">Notifications</h3>
            {unreadCount > 0 && (
              <span className="status-tag status-closing-soon" style={{ fontSize: '0.7rem' }}>
                {unreadCount} new
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {unreadCount > 0 && (
              <button
                className="btn-outline-mobile"
                onClick={handleMarkAll}
                style={{ padding: '4px 8px', fontSize: '0.75rem' }}
              >
                <CheckCheck size={13} />
                <span>Mark all</span>
              </button>
            )}
            <button className="header-icon-btn" onClick={onClose} aria-label="Close">
              <X size={20} />
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
          {notifications.length === 0 ? (
            <div className="empty-state-box" style={{ padding: '30px 10px' }}>
              <Check size={32} className="empty-state-icon" style={{ color: 'var(--accent-green)' }} />
              <p className="empty-state-title" style={{ fontSize: '0.95rem' }}>All caught up!</p>
              <p className="empty-state-desc">
                No unread notifications right now. Upcoming deadline warnings and event reminders will appear here.
              </p>
            </div>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif.notification_id}
                style={{
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--bg-subtle)',
                  border: '1px solid var(--border-main)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span
                    className={`status-tag ${
                      notif.notification_type === '1hr'
                        ? 'status-closing-soon'
                        : notif.notification_type === 'post'
                        ? 'status-tracked'
                        : 'status-open'
                    }`}
                    style={{ fontSize: '0.675rem' }}
                  >
                    {getTypeIcon(notif.notification_type)}
                    <span style={{ marginLeft: '4px' }}>{notif.notification_type}</span>
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {formatTimestamp(notif.created_at)}
                  </span>
                </div>

                <p style={{ fontSize: '0.85rem', color: 'var(--text-main)', lineHeight: 1.4 }}>
                  {notif.message}
                </p>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                  <button
                    className="btn-outline-mobile"
                    onClick={() => handleMarkRead(notif.notification_id)}
                    style={{ padding: '3px 8px', fontSize: '0.725rem' }}
                  >
                    <Check size={12} />
                    <span>Dismiss</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
