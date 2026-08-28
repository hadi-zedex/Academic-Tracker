import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import type { EventCreate, EventType, Job } from '../../types';
import { useToast } from '../../context/ToastContext';
import { createEvent } from '../../api/events';

interface CreateEventModalProps {
  job: Job | null;
  isOpen: boolean;
  onClose: () => void;
  onEventCreated: () => void;
}

export const CreateEventModal: React.FC<CreateEventModalProps> = ({
  job,
  isOpen,
  onClose,
  onEventCreated,
}) => {
  const { showToast } = useToast();
  const [eventType, setEventType] = useState<EventType>('OA');
  const [eventDatetime, setEventDatetime] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!job) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventDatetime) {
      showToast('Please select the event date and time', 'warning');
      return;
    }

    try {
      setIsSubmitting(true);
      const payload: EventCreate = {
        job_id: job.job_id,
        event_type: eventType,
        event_datetime: new Date(eventDatetime).toISOString(),
      };
      await createEvent(payload);
      showToast(`${eventType} round scheduled for ${job.company_name}!`, 'success');
      setEventDatetime('');
      onEventCreated();
      onClose();
    } catch (err: any) {
      showToast(err.detail || 'Failed to schedule event', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Schedule Round — ${job.company_name}`}
    >
      <form onSubmit={handleSubmit}>
        <div
          style={{
            padding: '10px 12px',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--accent-blue-bg)',
            border: '1px solid var(--accent-blue-border)',
            marginBottom: '16px',
            fontSize: '0.8rem',
            color: 'var(--accent-blue-text)',
          }}
        >
          <span>
            📅 <strong>Automated Alerts:</strong> Subscribers will receive reminders at <strong>8:00 PM the night before</strong> and <strong>3 hours before</strong> the round.
          </span>
        </div>

        <div className="form-group-mobile">
          <label className="form-label-mobile" htmlFor="event_type">Round Type</label>
          <select
            id="event_type"
            className="form-input-mobile"
            value={eventType}
            onChange={(e) => setEventType(e.target.value as EventType)}
            required
          >
            <option value="OA">Online Assessment (OA)</option>
            <option value="PPT">Pre-Placement Talk (PPT)</option>
            <option value="Interview">Interview Round</option>
          </select>
        </div>

        <div className="form-group-mobile">
          <label className="form-label-mobile" htmlFor="event_datetime">Round Date & Time</label>
          <input
            id="event_datetime"
            type="datetime-local"
            className="form-input-mobile"
            value={eventDatetime}
            onChange={(e) => setEventDatetime(e.target.value)}
            required
          />
        </div>

        <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
          <button type="button" className="btn-outline-mobile" onClick={onClose} disabled={isSubmitting} style={{ flex: 1, justifyContent: 'center' }}>
            Cancel
          </button>
          <button type="submit" className="btn-primary-mobile" disabled={isSubmitting} style={{ flex: 1, justifyContent: 'center' }}>
            {isSubmitting ? 'Saving...' : 'Add to Calendar'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
