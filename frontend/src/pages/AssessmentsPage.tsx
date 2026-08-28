import React, { useState } from 'react';
import type { PracticeTest } from '../types';
import { FileCheck2, Clock, Plus, AlertCircle } from 'lucide-react';
import { CreatePracticeTestModal } from '../components/practiceTests/CreatePracticeTestModal';

interface AssessmentsPageProps {
  practiceTests: PracticeTest[];
  onRefreshData: () => void;
}

export const AssessmentsPage: React.FC<AssessmentsPageProps> = ({
  practiceTests,
  onRefreshData,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

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

  const isPast = (iso: string) => {
    try {
      return new Date(iso) < new Date();
    } catch {
      return false;
    }
  };

  return (
    <div className="assessments-page-container">
      <div style={{ padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Mandatory Practice Tests</h2>
            <p style={{ fontSize: '0.775rem', color: 'var(--text-secondary)' }}>
              Batch readiness and mock aptitude assessments
            </p>
          </div>

          <button
            className="btn-primary-mobile"
            onClick={() => setIsModalOpen(true)}
            style={{ padding: '6px 12px', fontSize: '0.775rem' }}
          >
            <Plus size={14} />
            <span>Schedule</span>
          </button>
        </div>

        {practiceTests.length === 0 ? (
          <div className="empty-state-box" style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid var(--border-main)' }}>
            <FileCheck2 className="empty-state-icon" />
            <p className="empty-state-title">No Practice Tests Scheduled</p>
            <p className="empty-state-desc">
              Mandatory mock rounds and practice tests will appear here.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {practiceTests.map((test) => {
              const testIsPast = isPast(test.test_deadline);

              return (
                <div
                  key={test.test_id}
                  className="agenda-item-card border-red"
                  style={{ marginBottom: 0, opacity: testIsPast ? 0.75 : 1 }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                      <span className="status-tag status-closing-soon" style={{ fontWeight: 700 }}>
                        {testIsPast ? 'Completed Test' : 'Mandatory Test'}
                      </span>
                      <span className="agenda-card-time">
                        <Clock size={12} />
                        <span>{formatDeadline(test.test_deadline)}</span>
                      </span>
                    </div>

                    <h4 className="agenda-card-title">{test.test_name}</h4>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <AlertCircle size={12} className="text-amber-500" />
                      <span>Reflected on all batch members' calendars.</span>
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <CreatePracticeTestModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onTestCreated={onRefreshData}
      />
    </div>
  );
};
