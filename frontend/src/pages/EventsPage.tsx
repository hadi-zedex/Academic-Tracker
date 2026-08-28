import React, { useState } from 'react';
import type { Event, Job, EventType } from '../types';
import { useAuth } from '../context/AuthContext';
import {
  CalendarCheck,
  Clock,
  Edit2,
} from 'lucide-react';
import { CreateEventModal } from '../components/jobs/CreateEventModal';
import { EditEventModal } from '../components/jobs/EditEventModal';

interface EventsPageProps {
  events: Event[];
  jobs: Job[];
  trackedJobIds: Set<number>;
  onRefreshData: () => void;
}

export const EventsPage: React.FC<EventsPageProps> = ({
  events,
  jobs,
  trackedJobIds,
  onRefreshData,
}) => {
  const { student, isAdmin } = useAuth();
  const [filterType, setFilterType] = useState<string>('all');

  const [selectedJobForEvent, setSelectedJobForEvent] = useState<Job | null>(null);
  const [selectedEventForEdit, setSelectedEventForEdit] = useState<{ event: Event; companyName: string } | null>(null);

  // Map jobs for fast lookup
  const jobMap = new Map(jobs.map((j) => [j.job_id, j]));

  // Events visible to the student: tracked shared jobs + own personal jobs
  const visibleEvents = events.filter((ev) => {
    const parentJob = jobMap.get(ev.job_id);
    if (!parentJob) return false;
    const isOwner = parentJob.created_by === student?.student_id;
    const isTracked = trackedJobIds.has(ev.job_id);
    return isOwner || isTracked;
  });

  // Filter by event type
  const filteredEvents = visibleEvents.filter((ev) => {
    if (filterType === 'all') return true;
    return ev.event_type === filterType;
  });

  // Sort chronologically
  filteredEvents.sort((a, b) => new Date(a.event_datetime).getTime() - new Date(b.event_datetime).getTime());

  const formatEventDate = (iso: string) => {
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

  const getEventBadgeClass = (type: EventType) => {
    switch (type) {
      case 'OA':
        return 'status-closing-soon';
      case 'Interview':
        return 'status-tracked';
      case 'PPT':
        return 'status-open';
      default:
        return 'status-open';
    }
  };

  return (
    <div className="events-page-container">
      {/* Sub Tabs */}
      <div className="sub-tabs-bar">
        <button
          className={`sub-tab ${filterType === 'all' ? 'active' : ''}`}
          onClick={() => setFilterType('all')}
        >
          All ({visibleEvents.length})
        </button>
        <button
          className={`sub-tab ${filterType === 'OA' ? 'active' : ''}`}
          onClick={() => setFilterType('OA')}
        >
          OA ({visibleEvents.filter((e) => e.event_type === 'OA').length})
        </button>
        <button
          className={`sub-tab ${filterType === 'PPT' ? 'active' : ''}`}
          onClick={() => setFilterType('PPT')}
        >
          PPT ({visibleEvents.filter((e) => e.event_type === 'PPT').length})
        </button>
        <button
          className={`sub-tab ${filterType === 'Interview' ? 'active' : ''}`}
          onClick={() => setFilterType('Interview')}
        >
          Interviews ({visibleEvents.filter((e) => e.event_type === 'Interview').length})
        </button>
      </div>

      <div style={{ padding: '16px' }}>
        {filteredEvents.length === 0 ? (
          <div className="empty-state-box" style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid var(--border-main)' }}>
            <CalendarCheck className="empty-state-icon" />
            <p className="empty-state-title">No scheduled events</p>
            <p className="empty-state-desc">
              When you track a job or an admin schedules an OA/Interview round, it will automatically appear here and on your Monthly Calendar.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {filteredEvents.map((ev) => {
              const parentJob = jobMap.get(ev.job_id);
              const companyName = parentJob?.company_name || 'Job';
              const role = parentJob?.role || '';
              const isOwner = parentJob?.created_by === student?.student_id;
              const canManage = isOwner || isAdmin;

              return (
                <div key={ev.event_id} className="agenda-item-card border-blue" style={{ marginBottom: 0 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                      <span className={`status-tag ${getEventBadgeClass(ev.event_type)}`} style={{ fontWeight: 700 }}>
                        {ev.event_type}
                      </span>
                      <span className="agenda-card-time">
                        <Clock size={12} />
                        <span>{formatEventDate(ev.event_datetime)}</span>
                      </span>
                    </div>

                    <h4 className="agenda-card-title">{companyName}</h4>
                    {role && (
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        Role: {role}
                      </p>
                    )}
                  </div>

                  {canManage && (
                    <button
                      className="header-icon-btn"
                      onClick={() => setSelectedEventForEdit({ event: ev, companyName })}
                      title="Reschedule event"
                      style={{ width: '32px', height: '32px' }}
                    >
                      <Edit2 size={14} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modals */}
      <CreateEventModal
        job={selectedJobForEvent}
        isOpen={Boolean(selectedJobForEvent)}
        onClose={() => setSelectedJobForEvent(null)}
        onEventCreated={onRefreshData}
      />

      <EditEventModal
        event={selectedEventForEdit?.event || null}
        companyName={selectedEventForEdit?.companyName}
        isOpen={Boolean(selectedEventForEdit)}
        onClose={() => setSelectedEventForEdit(null)}
        onEventUpdated={onRefreshData}
      />
    </div>
  );
};
