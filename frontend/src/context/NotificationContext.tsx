import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Notification } from '../types';
import { getNotifications, markNotificationRead } from '../api/notifications';
import { useAuth } from './AuthContext';

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  fetchNotifications: () => Promise<void>;
  markAsRead: (notificationId: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const fetchNotifications = useCallback(async () => {
    if (!token) {
      setNotifications([]);
      return;
    }
    try {
      setIsLoading(true);
      const items = await getNotifications();
      setNotifications(items);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchNotifications();

    if (!token) return;

    // Poll every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);

    // Refresh on focus
    const handleFocus = () => {
      fetchNotifications();
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [token, fetchNotifications]);

  const markAsRead = async (notificationId: number) => {
    try {
      await markNotificationRead(notificationId);
      setNotifications((prev) => prev.filter((n) => n.notification_id !== notificationId));
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
      throw err;
    }
  };

  const markAllAsRead = async () => {
    const unread = [...notifications];
    for (const notif of unread) {
      try {
        await markNotificationRead(notif.notification_id);
      } catch (err) {
        console.error('Failed to mark notification as read:', notif.notification_id, err);
      }
    }
    setNotifications([]);
  };

  const unreadCount = notifications.length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        isLoading,
        fetchNotifications,
        markAsRead,
        markAllAsRead,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
