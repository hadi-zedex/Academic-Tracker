import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import type { PracticeTestCreate } from '../../types';
import { useToast } from '../../context/ToastContext';
import { createPracticeTest } from '../../api/practiceTests';

interface CreatePracticeTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTestCreated: () => void;
}

export const CreatePracticeTestModal: React.FC<CreatePracticeTestModalProps> = ({
  isOpen,
  onClose,
  onTestCreated,
}) => {
  const { showToast } = useToast();
  const [testName, setTestName] = useState('');
  const [deadline, setDeadline] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testName.trim() || !deadline) {
      showToast('Please fill out all fields', 'warning');
      return;
    }

    try {
      setIsSubmitting(true);
      const payload: PracticeTestCreate = {
        test_name: testName.trim(),
        test_deadline: new Date(deadline).toISOString(),
      };
      await createPracticeTest(payload);
      showToast('Practice test scheduled for all students!', 'success');
      setTestName('');
      setDeadline('');
      onTestCreated();
      onClose();
    } catch (err: any) {
      showToast(err.detail || 'Failed to schedule practice test', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Schedule Practice Test">
      <form onSubmit={handleSubmit}>
        <div
          style={{
            padding: '10px 12px',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--accent-red-bg)',
            border: '1px solid var(--accent-red-border)',
            marginBottom: '16px',
            fontSize: '0.8rem',
            color: 'var(--accent-red-text)',
          }}
        >
          <span>
            ⚠️ <strong>Batch Assessment:</strong> Appears on all batch members' calendars and triggers 8:00 PM (night before) and 3-hour automated reminders.
          </span>
        </div>

        <div className="form-group-mobile">
          <label className="form-label-mobile" htmlFor="test_name">Test Subject / Name</label>
          <input
            id="test_name"
            type="text"
            className="form-input-mobile"
            placeholder="e.g. Mock Aptitude Assessment 1"
            value={testName}
            onChange={(e) => setTestName(e.target.value)}
            required
          />
        </div>

        <div className="form-group-mobile">
          <label className="form-label-mobile" htmlFor="test_deadline">Test Deadline / Slot</label>
          <input
            id="test_deadline"
            type="datetime-local"
            className="form-input-mobile"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            required
          />
        </div>

        <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
          <button type="button" className="btn-outline-mobile" onClick={onClose} disabled={isSubmitting} style={{ flex: 1, justifyContent: 'center' }}>
            Cancel
          </button>
          <button type="submit" className="btn-primary-mobile" disabled={isSubmitting} style={{ flex: 1, justifyContent: 'center' }}>
            {isSubmitting ? 'Scheduling...' : 'Schedule Test'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
