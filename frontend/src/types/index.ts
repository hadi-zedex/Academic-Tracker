export type EventType = 'OA' | 'PPT' | 'Interview';

export type MobileTab = 'home' | 'jobs' | 'events' | 'assessments' | 'profile';

export interface Student {
  student_id: number;
  student_name: string;
  email: string;
  is_admin: boolean;
}

export interface StudentCreate {
  student_name: string;
  email: string;
  password: string;
}

export interface StudentLogin {
  email: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
}

export interface Job {
  job_id: number;
  company_name: string;
  role: string;
  job_deadline: string;
  created_by: number;
  // Computed client-side helper fields
  is_tracked?: boolean;
  tracking_id?: number;
  is_shared?: boolean;
  events?: Event[];
}

export interface JobCreate {
  company_name: string;
  role: string;
  job_deadline: string;
}

export interface JobUpdate {
  company_name?: string;
  role?: string;
  job_deadline?: string;
}

export interface Event {
  event_id: number;
  event_type: EventType;
  event_datetime: string;
  job_id: number;
}

export interface EventCreate {
  event_type: EventType;
  event_datetime: string;
  job_id: number;
}

export interface EventUpdate {
  event_datetime?: string;
}

export interface PracticeTest {
  test_id: number;
  test_name: string;
  test_deadline: string;
}

export interface PracticeTestCreate {
  test_name: string;
  test_deadline: string;
}

export interface JobTracking {
  tracking_id: number;
  applicant_id: number;
  job_id: number;
}

export interface JobTrackingCreate {
  job_id: number;
}

export type NotificationType = '1hr' | '3hr' | '8pm' | 'post';

export interface Notification {
  notification_id: number;
  student_id: number;
  job_id?: number | null;
  event_id?: number | null;
  practice_test_id?: number | null;
  message: string;
  created_at: string;
  is_read: boolean;
  notification_type: NotificationType;
}

export type CalendarItemType = 'job_deadline' | 'event' | 'practice_test';
export type CalendarColor = 'red' | 'blue';

export interface CalendarEventItem {
  type: CalendarItemType;
  id: number;
  label: string;
  color: CalendarColor;
  datetime: string;
  event_type?: string | null;
  company_name?: string | null;
  role?: string | null;
}

export type MonthlyCalendarResponse = Record<string, CalendarEventItem[]>;
