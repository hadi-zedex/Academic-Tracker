import { apiRequest } from './client';
import type { Student, StudentCreate, StudentLogin, AuthResponse } from '../types';

export function parseJwt(token: string): { sub: string; exp: number } | null {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

export async function login(credentials: StudentLogin): Promise<AuthResponse> {
  return apiRequest<AuthResponse>('/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  });
}

export async function signup(student: StudentCreate): Promise<Student> {
  return apiRequest<Student>('/students', {
    method: 'POST',
    body: JSON.stringify(student),
  });
}

export async function getStudent(studentId: number): Promise<Student> {
  return apiRequest<Student>(`/students/${studentId}`, {
    method: 'GET',
  });
}
