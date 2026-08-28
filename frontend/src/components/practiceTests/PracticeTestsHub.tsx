import React, { useState, useEffect, useCallback } from 'react';
import type { PracticeTest } from '../../types';
import { getPracticeTests } from '../../api/practiceTests';
import { useToast } from '../../context/ToastContext';
import { FileCheck2, Clock, Plus, AlertCircle } from 'lucide-react';
import { CreatePracticeTestModal } from './CreatePracticeTestModal';

interface PracticeTestsHubProps {
  onRefreshData?: () => void;
}

export const PracticeTestsHub: React.FC<PracticeTestsHubProps> = ({ onRefreshData }) => {
  const { showToast } = useToast();
  const [tests, setTests] = useState<PracticeTest[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const loadTests = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await getPracticeTests();
      setTests(data);
    } catch (err) {
      console.error('Failed to load practice tests:', err);
      showToast('Failed to load practice tests', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadTests();
  }, [loadTests]);

  const formatDeadline = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  const isPastTest = (iso: string) => {
    try {
      return new Date(iso) < new Date();
    } catch {
      return false;
    }
  };

  return (
    <div className="practice-tests-container">
      <div className="hub-header">
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Mandatory Practice Tests</h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Tests and mock rounds scheduled for batch readiness
          </p>
        </div>

        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          <Plus size={16} />
          <span>Schedule Practice Test</span>
        </button>
      </div>

      {isLoading ? (
        <div className="card empty-state">
          <p>Loading practice tests...</p>
        </div>
      ) : tests.length === 0 ? (
        <div className="card empty-state">
          <FileCheck2 className="empty-icon" />
          <h3 className="empty-title">No Practice Tests Scheduled</h3>
          <p className="empty-description">
            Mandatory aptitude, coding, and mock assessments will appear here once scheduled.
          </p>
          <button className="btn btn-secondary" onClick={() => setIsModalOpen(true)} style={{ marginTop: '12px' }}>
            <Plus size={15} />
            <span>Schedule First Test</span>
          </button>
        </div>
      ) : (
        <div className="jobs-grid">
          {tests.map((test) => {
            const isPast = isPastTest(test.test_deadline);

            return (
              <div key={test.test_id} className={`job-card ${isPast ? 'opacity-75' : ''}`}>
                <div className="job-card-top">
                  <div className="job-company-role">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="notification-type-tag type-1hr">Mandatory</span>
                      {isPast && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>(Completed)</span>}
                    </div>
                    <h3 className="job-company" style={{ marginTop: '4px' }}>{test.test_name}</h3>
                  </div>

                  <div className="job-deadline-badge" title="Test Deadline">
                    <Clock size={13} />
                    <span>{formatDeadline(test.test_deadline)}</span>
                  </div>
                </div>

                <div
                  style={{
                    padding: '12px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-subtle)',
                    fontSize: '0.825rem',
                    color: 'var(--text-secondary)',
                    marginTop: 'auto',
                  }}
                >
                  <p style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertCircle size={14} className="text-amber-500" />
                    <span>Mandatory for all students — reflected on everyone's calendar.</span>
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <CreatePracticeTestModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onTestCreated={() => {
          loadTests();
          if (onRefreshData) onRefreshData();
        }}
      />
    </div>
  );
};
