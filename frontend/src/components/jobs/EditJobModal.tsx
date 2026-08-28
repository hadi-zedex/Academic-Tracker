import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import type { Job, JobUpdate } from '../../types';
import { useToast } from '../../context/ToastContext';
import { editJob } from '../../api/jobs';

interface EditJobModalProps {
  job: Job | null;
  isOpen: boolean;
  onClose: () => void;
  onJobUpdated: () => void;
}

export const EditJobModal: React.FC<EditJobModalProps> = ({
  job,
  isOpen,
  onClose,
  onJobUpdated,
}) => {
  const { showToast } = useToast();
  const [companyName, setCompanyName] = useState('');
  const [role, setRole] = useState('');
  const [deadline, setDeadline] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (job) {
      setCompanyName(job.company_name);
      setRole(job.role);
      try {
        const d = new Date(job.job_deadline);
        const isoLocal = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 16);
        setDeadline(isoLocal);
      } catch {
        setDeadline('');
      }
    }
  }, [job]);

  if (!job) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim() || !role.trim() || !deadline) {
      showToast('Please fill out all fields', 'warning');
      return;
    }

    try {
      setIsSubmitting(true);
      const payload: JobUpdate = {
        company_name: companyName.trim(),
        role: role.trim(),
        job_deadline: new Date(deadline).toISOString(),
      };
      await editJob(job.job_id, payload);
      showToast('Job details updated successfully!', 'success');
      onJobUpdated();
      onClose();
    } catch (err: any) {
      showToast(err.detail || 'Failed to update job', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Edit — ${job.company_name}`}>
      <form onSubmit={handleSubmit}>
        <div className="form-group-mobile">
          <label className="form-label-mobile" htmlFor="edit_company_name">Company Name</label>
          <input
            id="edit_company_name"
            type="text"
            className="form-input-mobile"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            required
          />
        </div>

        <div className="form-group-mobile">
          <label className="form-label-mobile" htmlFor="edit_role">Role</label>
          <input
            id="edit_role"
            type="text"
            className="form-input-mobile"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            required
          />
        </div>

        <div className="form-group-mobile">
          <label className="form-label-mobile" htmlFor="edit_job_deadline">Application Deadline</label>
          <input
            id="edit_job_deadline"
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
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
