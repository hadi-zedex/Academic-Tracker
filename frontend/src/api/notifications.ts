import { apiRequest } from './client';
import type { Notification } from '../types';

export async function getNotifications(): Promise<Notification[]> {
  return apiRequest<Notification[]>('/notifications', {
    method: 'GET',
  });
}

export async function markNotificationRead(notificationId: number): Promise<Notification> {
  return apiRequest<Notification>(`/notifications/${notificationId}/read`, {
    method: 'PATCH',
  });
}
