import { apiRequest } from './client';
import type { Event, EventCreate, EventUpdate } from '../types';

export async function getEvents(): Promise<Event[]> {
  return apiRequest<Event[]>('/events', {
    method: 'GET',
  });
}

export async function getEvent(eventId: number): Promise<Event> {
  return apiRequest<Event>(`/events/${eventId}`, {
    method: 'GET',
  });
}

export async function createEvent(event: EventCreate): Promise<Event> {
  return apiRequest<Event>('/events', {
    method: 'POST',
    body: JSON.stringify(event),
  });
}

export async function editEvent(eventId: number, event: EventUpdate): Promise<Event> {
  return apiRequest<Event>(`/events/${eventId}`, {
    method: 'PATCH',
    body: JSON.stringify(event),
  });
}
