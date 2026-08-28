import React from 'react';
import type { Job, Event } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { createJobTracking } from '../../api/trackings';
import {
  X,
  Clock,
  CheckCircle2,
  Plus,
  CalendarPlus,
  Edit2,
  Trash2,
} from 'lucide-react';

interface JobDetailModalProps {
  job: Job | null;
  events: Event[];
  isTracked: boolean;
  isOpen: boolean;
  onClose: () => void;
  onTrackChanged: (jobId: number) => void;
  onOpenAddEvent: (job: Job) => void;
  onOpenEditJob: (job: Job) => void;
  onDeleteJob: (job: Job) => void;
  onEditEvent: (event: Event, companyName: string) => void;
}

export const JobDetailModal: React.FC<JobDetailModalProps> = ({
  job,
  events,
  isTracked,
  isOpen,
  onClose,
  onTrackChanged,
  onOpenAddEvent,
  onOpenEditJob,
  onDeleteJob,
  onEditEvent,
}) => {
  const { student, isAdmin } = useAuth();
  const { showToast } = useToast();

  if (!isOpen || !job) return null;

  const isOwner = job.created_by === student?.student_id;
  const canManage = isOwner || isAdmin;

  const handleTrack = async () => {
    try {
      await createJobTracking(job.job_id);
      showToast(`Now tracking ${job.company_name}!`, 'success');
      onTrackChanged(job.job_id);
    } catch (err: any) {
      showToast(err.detail || 'Could not track job', 'error');
    }
  };

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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content-mobile" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header-mobile">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="company-avatar-box" style={{ width: '40px', height: '40px' }}>
              {job.company_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="modal-title-mobile">{job.role}</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{job.company_name}</p>
            </div>
          </div>
          <button className="header-icon-btn" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {/* Status / Role Info */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <span className={`status-tag ${isTracked ? 'status-tracked' : 'status-open'}`}>
            {isTracked ? 'Applied / Tracked' : 'Not Tracked'}
          </span>
          {isAdmin && (
            <span className="status-tag status-shared-admin">
              {isOwner ? 'Personal Entry' : 'Shared (Batch)'}
            </span>
          )}
        </div>

        {/* Deadline Card */}
        <div
          style={{
            padding: '12px 14px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--bg-subtle)',
            border: '1px solid var(--border-main)',
            marginBottom: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-red)', fontWeight: 600, fontSize: '0.8rem' }}>
            <Clock size={14} />
            <span>Application Deadline:</span>
          </div>
          <p style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '2px' }}>
            {formatDeadline(job.job_deadline)}
          </p>
        </div>

        {/* Scheduled Rounds / Events */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)' }}>
              Scheduled Assessment Rounds
            </h4>
            {canManage && (
              <button
                className="btn-outline-mobile"
                onClick={() => onOpenAddEvent(job)}
                style={{ padding: '4px 8px', fontSize: '0.75rem' }}
              >
                <CalendarPlus size={13} />
                <span>Add Round</span>
              </button>
            )}
          </div>

          {events.length === 0 ? (
            <div
              style={{
                padding: '14px',
                textAlign: 'center',
                backgroundColor: 'var(--bg-subtle)',
                borderRadius: 'var(--radius-sm)',
                border: '1px dashed var(--border-main)',
                fontSize: '0.8rem',
                color: 'var(--text-muted)',
              }}
            >
              No OA, PPT, or interview dates announced for this job yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {events.map((ev) => (
                <div
                  key={ev.event_id}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--bg-subtle)',
                    border: '1px solid var(--border-main)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <span className="status-tag status-open" style={{ fontWeight: 700, color: 'var(--primary)' }}>
                      {ev.event_type}
                    </span>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '3px' }}>
                      {formatDeadline(ev.event_datetime)}
                    </p>
                  </div>

                  {canManage && (
                    <button
                      className="header-icon-btn"
                      onClick={() => onEditEvent(ev, job.company_name)}
                      style={{ width: '28px', height: '28px' }}
                      title="Reschedule"
                    >
                      <Edit2 size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button
            className={`btn-primary-mobile ${isTracked ? 'status-tracked' : ''}`}
            onClick={handleTrack}
            disabled={isTracked}
            style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
          >
            {isTracked ? (
              <>
                <CheckCircle2 size={16} />
                <span>You are Tracking this Job</span>
              </>
            ) : (
              <>
                <Plus size={16} />
                <span>Track Job & Receive Round Alerts</span>
              </>
            )}
          </button>

          {canManage && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="btn-outline-mobile"
                onClick={() => onOpenEditJob(job)}
                style={{ flex: 1, justifyContent: 'center' }}
              >
                <Edit2 size={14} />
                <span>Edit Job</span>
              </button>
              <button
                className="btn-outline-mobile"
                onClick={() => onDeleteJob(job)}
                style={{ flex: 1, justifyContent: 'center', color: 'var(--accent-red)' }}
              >
                <Trash2 size={14} />
                <span>Delete</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
