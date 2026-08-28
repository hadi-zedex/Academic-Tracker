import React, { useState, useEffect, useCallback } from 'react';
import type { Job, Event, JobTracking } from '../../types';
import { getJobs, deleteJobStudent, deleteJobAdmin } from '../../api/jobs';
import { getEvents } from '../../api/events';
import { getJobTrackings, createJobTracking } from '../../api/trackings';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  Briefcase,
  Search,
  Plus,
  Clock,
  CheckCircle2,
  Trash2,
  Edit2,
  CalendarPlus,
} from 'lucide-react';
import { CreateJobModal } from './CreateJobModal';
import { CreateEventModal } from './CreateEventModal';
import { EditJobModal } from './EditJobModal';
import { EditEventModal } from './EditEventModal';

type HubFilter = 'all' | 'tracked' | 'personal';

interface JobsHubProps {
  isCreateJobOpen: boolean;
  onCloseCreateJob: () => void;
  onRefreshData?: () => void;
}

export const JobsHub: React.FC<JobsHubProps> = ({
  isCreateJobOpen,
  onCloseCreateJob,
  onRefreshData,
}) => {
  const { student, isAdmin } = useAuth();
  const { showToast } = useToast();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [trackings, setTrackings] = useState<JobTracking[]>([]);
  const [filter, setFilter] = useState<HubFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Modals state
  const [selectedJobForEvent, setSelectedJobForEvent] = useState<Job | null>(null);
  const [selectedJobForEdit, setSelectedJobForEdit] = useState<Job | null>(null);
  const [selectedEventForEdit, setSelectedEventForEdit] = useState<{ event: Event; companyName: string } | null>(null);

  const loadHubData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [jobsData, eventsData, trackingsData] = await Promise.all([
        getJobs(),
        getEvents(),
        getJobTrackings(),
      ]);

      setJobs(jobsData);
      setEvents(eventsData);
      setTrackings(trackingsData);
    } catch (err) {
      console.error('Failed to load jobs hub data:', err);
      showToast('Failed to load jobs list', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadHubData();
  }, [loadHubData]);

  const handleTrackJob = async (jobId: number) => {
    try {
      await createJobTracking(jobId);
      showToast('Job tracked successfully!', 'success');
      loadHubData();
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      showToast(err.detail || 'Could not track job', 'error');
    }
  };

  const handleDeleteJob = async (job: Job) => {
    const isShared = job.created_by !== student?.student_id;
    const confirmMessage = isShared
      ? `Are you sure you want to delete the SHARED job for "${job.company_name}"? This will remove it for all students in the batch.`
      : `Are you sure you want to delete your personal job "${job.company_name}"?`;

    if (!window.confirm(confirmMessage)) return;

    try {
      if (isAdmin && isShared) {
        await deleteJobAdmin(job.job_id);
      } else {
        await deleteJobStudent(job.job_id);
      }
      showToast(`Job for ${job.company_name} deleted`, 'info');
      loadHubData();
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      showToast(err.detail || 'Failed to delete job', 'error');
    }
  };

  const userTrackedJobIds = new Set(
    trackings
      .filter((t) => t.applicant_id === student?.student_id)
      .map((t) => t.job_id)
  );

  // Group events by job_id
  const eventsByJobId = events.reduce((acc, ev) => {
    acc[ev.job_id] = acc[ev.job_id] || [];
    acc[ev.job_id].push(ev);
    return acc;
  }, {} as Record<number, Event[]>);

  // Filter jobs
  const filteredJobs = jobs.filter((job) => {
    const isTracked = userTrackedJobIds.has(job.job_id);
    const isPersonal = job.created_by === student?.student_id;

    if (filter === 'tracked' && !isTracked) return false;
    if (filter === 'personal' && !isPersonal) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchComp = job.company_name.toLowerCase().includes(q);
      const matchRole = job.role.toLowerCase().includes(q);
      return matchComp || matchRole;
    }

    return true;
  });

  const formatDeadline = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(undefined, {
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
    <div className="jobs-hub-container">
      <div className="hub-header">
        <div className="hub-tabs-search">
          <div className="nav-tabs" style={{ marginBottom: 0 }}>
            <button
              className={`nav-tab ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              All Jobs ({jobs.length})
            </button>
            <button
              className={`nav-tab ${filter === 'tracked' ? 'active' : ''}`}
              onClick={() => setFilter('tracked')}
            >
              Tracked ({userTrackedJobIds.size})
            </button>
            <button
              className={`nav-tab ${filter === 'personal' ? 'active' : ''}`}
              onClick={() => setFilter('personal')}
            >
              My Personal ({jobs.filter((j) => j.created_by === student?.student_id).length})
            </button>
          </div>

          <div className="search-input-wrapper">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              className="search-input"
              placeholder="Search company or role..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <button
          className="btn btn-primary"
          onClick={onCloseCreateJob}
          title={isAdmin ? 'Post a shared job for the batch' : 'Add personal job'}
        >
          <Plus size={16} />
          <span>{isAdmin ? 'Post Batch Job' : 'Add Personal Job'}</span>
        </button>
      </div>

      {isLoading ? (
        <div className="card empty-state">
          <p>Loading jobs and schedules...</p>
        </div>
      ) : filteredJobs.length === 0 ? (
        <div className="card empty-state">
          <Briefcase className="empty-icon" />
          <h3 className="empty-title">No jobs found</h3>
          <p className="empty-description">
            {filter === 'tracked'
              ? "You haven't tracked any jobs yet. Track jobs to receive deadline reminders and see their OA/Interview dates on your calendar!"
              : filter === 'personal'
              ? 'No personal jobs created yet. Click "Add Personal Job" to track custom applications.'
              : 'No jobs match your search criteria.'}
          </p>
        </div>
      ) : (
        <div className="jobs-grid">
          {filteredJobs.map((job) => {
            const isTracked = userTrackedJobIds.has(job.job_id);
            const isOwner = job.created_by === student?.student_id;
            const jobEvents = eventsByJobId[job.job_id] || [];
            // Can edit/delete: if student is owner, or if admin on shared job
            const canManage = isOwner || isAdmin;

            return (
              <div key={job.job_id} className="job-card">
                <div className="job-card-top">
                  <div className="job-company-role">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <h3 className="job-company">{job.company_name}</h3>
                      {/* Shared / Personal Tagging for Admins only as requested */}
                      {isAdmin && (
                        <span
                          style={{
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: isOwner ? 'var(--bg-secondary)' : 'var(--accent-purple-bg)',
                            color: isOwner ? 'var(--text-muted)' : 'var(--accent-purple-text)',
                            border: `1px solid ${isOwner ? 'var(--border-subtle)' : 'var(--accent-purple)'}`,
                          }}
                        >
                          {isOwner ? 'Personal' : 'Shared (Batch)'}
                        </span>
                      )}
                    </div>
                    <span className="job-role">{job.role}</span>
                  </div>

                  <div className="job-deadline-badge" title="Application Deadline">
                    <Clock size={13} />
                    <span>{formatDeadline(job.job_deadline)}</span>
                  </div>
                </div>

                {/* Associated Events (OA, PPT, Interview) */}
                <div className="job-events-section">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span className="job-events-title">Scheduled Rounds</span>
                    {canManage && (
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => setSelectedJobForEvent(job)}
                        style={{ fontSize: '0.725rem', padding: '2px 8px' }}
                        title="Add OA, PPT, or Interview date"
                      >
                        <CalendarPlus size={13} />
                        <span>Add Event</span>
                      </button>
                    )}
                  </div>

                  {jobEvents.length === 0 ? (
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      No OA/Interview dates announced yet
                    </span>
                  ) : (
                    jobEvents.map((ev) => (
                      <div key={ev.event_id} className="job-event-item">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span
                            className="notification-type-tag type-3hr"
                            style={{ fontSize: '0.65rem', padding: '1px 5px' }}
                          >
                            {ev.event_type}
                          </span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.775rem' }}>
                            {formatDeadline(ev.event_datetime)}
                          </span>
                        </div>

                        {canManage && (
                          <button
                            className="icon-btn"
                            onClick={() => setSelectedEventForEdit({ event: ev, companyName: job.company_name })}
                            style={{ width: '22px', height: '22px' }}
                            title="Reschedule event"
                          >
                            <Edit2 size={11} />
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {/* Card footer actions */}
                <div className="job-card-actions">
                  <button
                    className={`tracking-btn ${isTracked ? 'is-tracked' : 'not-tracked'}`}
                    onClick={() => !isTracked && handleTrackJob(job.job_id)}
                    disabled={isTracked}
                  >
                    {isTracked ? (
                      <>
                        <CheckCircle2 size={14} />
                        <span>Tracked</span>
                      </>
                    ) : (
                      <>
                        <Plus size={14} />
                        <span>Track Job</span>
                      </>
                    )}
                  </button>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {canManage && (
                      <>
                        <button
                          className="icon-btn"
                          onClick={() => setSelectedJobForEdit(job)}
                          title="Edit job details"
                          style={{ width: '32px', height: '32px' }}
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          className="icon-btn"
                          onClick={() => handleDeleteJob(job)}
                          title="Delete job"
                          style={{ width: '32px', height: '32px', color: 'var(--accent-red)' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      <CreateJobModal
        isOpen={isCreateJobOpen}
        onClose={onCloseCreateJob}
        onJobCreated={() => {
          loadHubData();
          if (onRefreshData) onRefreshData();
        }}
      />

      <CreateEventModal
        job={selectedJobForEvent}
        isOpen={Boolean(selectedJobForEvent)}
        onClose={() => setSelectedJobForEvent(null)}
        onEventCreated={() => {
          loadHubData();
          if (onRefreshData) onRefreshData();
        }}
      />

      <EditJobModal
        job={selectedJobForEdit}
        isOpen={Boolean(selectedJobForEdit)}
        onClose={() => setSelectedJobForEdit(null)}
        onJobUpdated={() => {
          loadHubData();
          if (onRefreshData) onRefreshData();
        }}
      />

      <EditEventModal
        event={selectedEventForEdit?.event || null}
        companyName={selectedEventForEdit?.companyName}
        isOpen={Boolean(selectedEventForEdit)}
        onClose={() => setSelectedEventForEdit(null)}
        onEventUpdated={() => {
          loadHubData();
          if (onRefreshData) onRefreshData();
        }}
      />
    </div>
  );
};
