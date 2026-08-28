import { apiRequest } from './client';
import type { Job, JobCreate, JobUpdate } from '../types';

export async function getJobs(): Promise<Job[]> {
  return apiRequest<Job[]>('/jobs', {
    method: 'GET',
  });
}

export async function getJob(jobId: number): Promise<Job> {
  return apiRequest<Job>(`/jobs/${jobId}`, {
    method: 'GET',
  });
}

export async function createJob(job: JobCreate): Promise<Job> {
  return apiRequest<Job>('/jobs', {
    method: 'POST',
    body: JSON.stringify(job),
  });
}

export async function editJob(jobId: number, job: JobUpdate): Promise<Job> {
  return apiRequest<Job>(`/jobs/${jobId}`, {
    method: 'PATCH',
    body: JSON.stringify(job),
  });
}

export async function deleteJobStudent(jobId: number): Promise<void> {
  return apiRequest<void>(`/jobs/${jobId}`, {
    method: 'DELETE',
  });
}

export async function deleteJobAdmin(jobId: number): Promise<void> {
  return apiRequest<void>(`/admin/jobs/${jobId}`, {
    method: 'DELETE',
  });
}
