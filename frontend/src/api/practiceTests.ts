import { apiRequest } from './client';
import type { PracticeTest, PracticeTestCreate } from '../types';

export async function getPracticeTests(): Promise<PracticeTest[]> {
  return apiRequest<PracticeTest[]>('/practice_tests', {
    method: 'GET',
  });
}

export async function createPracticeTest(test: PracticeTestCreate): Promise<PracticeTest> {
  return apiRequest<PracticeTest>('/practice_tests', {
    method: 'POST',
    body: JSON.stringify(test),
  });
}
