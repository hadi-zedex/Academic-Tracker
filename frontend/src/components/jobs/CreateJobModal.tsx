import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import type { JobCreate } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { createJob } from '../../api/jobs';

interface CreateJobModalProps {
  isOpen: boolean;
  onClose: () => void;
  onJobCreated: () => void;
}

export const CreateJobModal: React.FC<CreateJobModalProps> = ({
  isOpen,
  onClose,
  onJobCreated,
}) => {
  const { isAdmin } = useAuth();
  const { showToast } = useToast();

  const [companyName, setCompanyName] = useState('');
  const [role, setRole] = useState('');
  const [deadline, setDeadline] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim() || !role.trim() || !deadline) {
      showToast('Please fill out all fields', 'warning');
      return;
    }

    try {
      setIsSubmitting(true);
      const payload: JobCreate = {
        company_name: companyName.trim(),
        role: role.trim(),
        job_deadline: new Date(deadline).toISOString(),
      };
      await createJob(payload);
      showToast(
        isAdmin
          ? 'Shared job posted to batch catalog!'
          : 'Personal job created and added to your tracker!',
        'success'
      );
      setCompanyName('');
      setRole('');
      setDeadline('');
      onJobCreated();
      onClose();
    } catch (err: any) {
      showToast(err.detail || 'Failed to create job', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isAdmin ? 'Post Shared Job to Batch' : 'Add Personal Job'}>
      <form onSubmit={handleSubmit}>
        <div
          style={{
            padding: '10px 12px',
            borderRadius: 'var(--radius-sm)',
            background: isAdmin ? 'var(--accent-purple-bg)' : 'var(--bg-subtle)',
            border: `1px solid ${isAdmin ? 'var(--accent-purple)' : 'var(--border-main)'}`,
            marginBottom: '16px',
            fontSize: '0.8rem',
            color: isAdmin ? 'var(--accent-purple-text)' : 'var(--text-secondary)',
          }}
        >
          {isAdmin ? (
            <span>
              ⭐ <strong>Admin Broadcast:</strong> This job will be posted to the shared catalog and broadcast to all students immediately.
            </span>
          ) : (
            <span>
              🔒 <strong>Personal Entry:</strong> This job is visible only to you. You can schedule your own OA, PPT, and Interview events for it.
            </span>
          )}
        </div>

        <div className="form-group-mobile">
          <label className="form-label-mobile" htmlFor="company_name">Company Name</label>
          <input
            id="company_name"
            type="text"
            className="form-input-mobile"
            placeholder="e.g. Google, Microsoft, Qualcomm"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            required
          />
        </div>

        <div className="form-group-mobile">
          <label className="form-label-mobile" htmlFor="role">Role / Position</label>
          <input
            id="role"
            type="text"
            className="form-input-mobile"
            placeholder="e.g. Software Engineer, SDE-1, Data Analyst"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            required
          />
        </div>

        <div className="form-group-mobile">
          <label className="form-label-mobile" htmlFor="job_deadline">Application Deadline</label>
          <input
            id="job_deadline"
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
            {isSubmitting ? 'Posting...' : isAdmin ? 'Post to Batch' : 'Create Job'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
