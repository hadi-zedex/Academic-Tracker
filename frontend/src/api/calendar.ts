import { apiRequest } from './client';
import type { MonthlyCalendarResponse, CalendarEventItem } from '../types';

export async function getMonthlyCalendar(
  year: number,
  month: number
): Promise<MonthlyCalendarResponse> {
  return apiRequest<MonthlyCalendarResponse>(`/calendar/monthly?year=${year}&month=${month}`, {
    method: 'GET',
  });
}

export async function getDailyCalendar(dateStr: string): Promise<CalendarEventItem[]> {
  return apiRequest<CalendarEventItem[]>(`/calendar/daily?date=${dateStr}`, {
    method: 'GET',
  });
}
