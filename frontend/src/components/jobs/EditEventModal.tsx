import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import type { Event, EventUpdate } from '../../types';
import { useToast } from '../../context/ToastContext';
import { editEvent } from '../../api/events';

interface EditEventModalProps {
  event: Event | null;
  companyName?: string;
  isOpen: boolean;
  onClose: () => void;
  onEventUpdated: () => void;
}

export const EditEventModal: React.FC<EditEventModalProps> = ({
  event,
  companyName,
  isOpen,
  onClose,
  onEventUpdated,
}) => {
  const { showToast } = useToast();
  const [datetime, setDatetime] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (event) {
      try {
        const d = new Date(event.event_datetime);
        const isoLocal = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 16);
        setDatetime(isoLocal);
      } catch {
        setDatetime('');
      }
    }
  }, [event]);

  if (!event) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!datetime) {
      showToast('Please select a new date and time', 'warning');
      return;
    }

    try {
      setIsSubmitting(true);
      const payload: EventUpdate = {
        event_datetime: new Date(datetime).toISOString(),
      };
      await editEvent(event.event_id, payload);
      showToast(`${event.event_type} schedule updated!`, 'success');
      onEventUpdated();
      onClose();
    } catch (err: any) {
      showToast(err.detail || 'Failed to update event', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Reschedule ${event.event_type} ${companyName ? `(${companyName})` : ''}`}
    >
      <form onSubmit={handleSubmit}>
        <div className="form-group-mobile">
          <label className="form-label-mobile" htmlFor="edit_event_datetime">New Date & Time</label>
          <input
            id="edit_event_datetime"
            type="datetime-local"
            className="form-input-mobile"
            value={datetime}
            onChange={(e) => setDatetime(e.target.value)}
            required
          />
        </div>

        <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
          <button type="button" className="btn-outline-mobile" onClick={onClose} disabled={isSubmitting} style={{ flex: 1, justifyContent: 'center' }}>
            Cancel
          </button>
          <button type="submit" className="btn-primary-mobile" disabled={isSubmitting} style={{ flex: 1, justifyContent: 'center' }}>
            {isSubmitting ? 'Updating...' : 'Save New Time'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
