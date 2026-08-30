import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import type { JobCreate } from '../../types';
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
      showToast('Job posted successfully!', 'success');
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
    <Modal isOpen={isOpen} onClose={onClose} title="Post a Job">
      <form onSubmit={handleSubmit}>
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
            {isSubmitting ? 'Posting...' : 'Post Job'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
