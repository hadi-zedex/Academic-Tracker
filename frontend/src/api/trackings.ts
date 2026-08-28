import { apiRequest } from './client';
import type { JobTracking, JobTrackingCreate } from '../types';

export async function createJobTracking(jobId: number): Promise<JobTracking> {
  const payload: JobTrackingCreate = { job_id: jobId };
  return apiRequest<JobTracking>('/job_trackings', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getJobTrackings(): Promise<JobTracking[]> {
  return apiRequest<JobTracking[]>('/job_trackings', {
    method: 'GET',
  });
}
