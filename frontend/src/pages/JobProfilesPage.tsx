import React, { useState } from 'react';
import type { Job, Event } from '../types';
import { useAuth } from '../context/AuthContext';
import { Search, Plus, ArrowUpDown, Briefcase } from 'lucide-react';
import { JobDetailModal } from '../components/jobs/JobDetailModal';
import { CreateJobModal } from '../components/jobs/CreateJobModal';
import { CreateEventModal } from '../components/jobs/CreateEventModal';
import { EditJobModal } from '../components/jobs/EditJobModal';
import { EditEventModal } from '../components/jobs/EditEventModal';
import { deleteJobStudent, deleteJobAdmin } from '../api/jobs';
import { useToast } from '../context/ToastContext';

type TabOption = 'all' | 'applied';

interface JobProfilesPageProps {
  jobs: Job[];
  events: Event[];
  trackedJobIds: Set<number>;
  onRefreshData: () => void;
  onJobTracked: (jobId: number) => void;
  isCreateJobOpen: boolean;
  setIsCreateJobOpen: (open: boolean) => void;
}

export const JobProfilesPage: React.FC<JobProfilesPageProps> = ({
  jobs,
  events,
  trackedJobIds,
  onRefreshData,
  onJobTracked,
  isCreateJobOpen,
  setIsCreateJobOpen,
}) => {
  const { student, isAdmin } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<TabOption>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedJobForDetail, setSelectedJobForDetail] = useState<Job | null>(null);

  // Sub modals
  const [selectedJobForEvent, setSelectedJobForEvent] = useState<Job | null>(null);
  const [selectedJobForEdit, setSelectedJobForEdit] = useState<Job | null>(null);
  const [selectedEventForEdit, setSelectedEventForEdit] = useState<{ event: Event; companyName: string } | null>(null);

  // Group events by job_id
  const eventsByJobId = events.reduce((acc, ev) => {
    acc[ev.job_id] = acc[ev.job_id] || [];
    acc[ev.job_id].push(ev);
    return acc;
  }, {} as Record<number, Event[]>);

  const handleDeleteJob = async (job: Job) => {
    const isShared = job.created_by !== student?.student_id;
    const confirmMessage = `Are you sure you want to delete the job "${job.company_name}"?`;

    if (!window.confirm(confirmMessage)) return;

    try {
      if (isAdmin && isShared) {
        await deleteJobAdmin(job.job_id);
      } else {
        await deleteJobStudent(job.job_id);
      }
      showToast(`Job for ${job.company_name} deleted`, 'info');
      setSelectedJobForDetail(null);
      onRefreshData();
    } catch (err: any) {
      showToast(err.detail || 'Failed to delete job', 'error');
    }
  };

  const filteredJobs = jobs.filter((job) => {
    const isTracked = trackedJobIds.has(job.job_id);

    if (activeTab === 'applied' && !isTracked) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchComp = job.company_name.toLowerCase().includes(q);
      const matchRole = job.role.toLowerCase().includes(q);
      return matchComp || matchRole;
    }

    return true;
  });

  const formatDeadlineText = (iso: string) => {
    try {
      const d = new Date(iso);
      const now = new Date();
      if (d < now) {
        return 'Applications closed';
      }
      return `Deadline: ${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
    } catch {
      return '';
    }
  };

  return (
    <div className="job-profiles-page-container">
      {/* Search Header */}
      <div className="search-container">
        <div className="search-input-box">
          <Search size={16} />
          <input
            type="text"
            className="search-input-field"
            placeholder="Search by job title or company"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <button className="header-icon-btn" title="Sort" aria-label="Sort">
          <ArrowUpDown size={18} />
        </button>
      </div>

      {/* Tabs Bar */}
      <div className="sub-tabs-bar">
        <button
          className={`sub-tab ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          All Jobs ({jobs.length})
        </button>
        <button
          className={`sub-tab ${activeTab === 'applied' ? 'active' : ''}`}
          onClick={() => setActiveTab('applied')}
        >
          Applied Jobs ({trackedJobIds.size})
        </button>
      </div>

      {/* Job List */}
      <div className="job-list-content">
        {filteredJobs.length === 0 ? (
          <div className="empty-state-box">
            <Briefcase className="empty-state-icon" />
            <p className="empty-state-title">No job profiles found</p>
            <p className="empty-state-desc">
              {activeTab === 'applied'
                ? "You haven't tracked any jobs yet. Tap 'All Jobs' and track openings you've applied to."
                : 'No job postings match your search.'}
            </p>
          </div>
        ) : (
          filteredJobs.map((job) => {
            const isTracked = trackedJobIds.has(job.job_id);
            const deadlineText = formatDeadlineText(job.job_deadline);
            const isClosed = deadlineText === 'Applications closed';

            return (
              <div
                key={job.job_id}
                className="job-item-row"
                onClick={() => setSelectedJobForDetail(job)}
              >
                <div className="company-avatar-box">
                  {job.company_name.charAt(0).toUpperCase()}
                </div>

                <div className="job-info-col">
                  <h3 className="job-title-text">{job.role}</h3>
                  <p className="job-company-subtitle">
                    {job.company_name}
                  </p>

                  <div className="job-status-meta">
                    <span
                      style={{
                        color: isTracked
                          ? 'var(--accent-green)'
                          : isClosed
                          ? 'var(--text-muted)'
                          : 'var(--accent-red)',
                        fontWeight: isTracked ? 700 : 500,
                      }}
                    >
                      {isTracked ? 'Applied / Tracked' : deadlineText}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Floating Action Button (FAB) */}
      <button
        className="fab-button"
        onClick={() => setIsCreateJobOpen(true)}
        title="Post Job"
        aria-label="Add job"
      >
        <Plus size={24} />
      </button>

      {/* Job Detail Sheet */}
      <JobDetailModal
        job={selectedJobForDetail}
        events={selectedJobForDetail ? eventsByJobId[selectedJobForDetail.job_id] || [] : []}
        isTracked={selectedJobForDetail ? trackedJobIds.has(selectedJobForDetail.job_id) : false}
        isOpen={Boolean(selectedJobForDetail)}
        onClose={() => setSelectedJobForDetail(null)}
        onTrackChanged={(jobId) => {
          onJobTracked(jobId);
          onRefreshData();
        }}
        onOpenAddEvent={(j) => {
          setSelectedJobForDetail(null);
          setSelectedJobForEvent(j);
        }}
        onOpenEditJob={(j) => {
          setSelectedJobForDetail(null);
          setSelectedJobForEdit(j);
        }}
        onDeleteJob={handleDeleteJob}
        onEditEvent={(ev, compName) => {
          setSelectedJobForDetail(null);
          setSelectedEventForEdit({ event: ev, companyName: compName });
        }}
      />

      {/* Modals */}
      <CreateJobModal
        isOpen={isCreateJobOpen}
        onClose={() => setIsCreateJobOpen(false)}
        onJobCreated={onRefreshData}
      />

      <CreateEventModal
        job={selectedJobForEvent}
        isOpen={Boolean(selectedJobForEvent)}
        onClose={() => setSelectedJobForEvent(null)}
        onEventCreated={onRefreshData}
      />

      <EditJobModal
        job={selectedJobForEdit}
        isOpen={Boolean(selectedJobForEdit)}
        onClose={() => setSelectedJobForEdit(null)}
        onJobUpdated={onRefreshData}
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
