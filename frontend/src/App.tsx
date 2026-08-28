import React, { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { ToastProvider } from './context/ToastContext';
import { MobileHeader } from './components/layout/MobileHeader';
import { BottomNav } from './components/layout/BottomNav';
import { HomePage } from './pages/HomePage';
import { JobProfilesPage } from './pages/JobProfilesPage';
import { EventsPage } from './pages/EventsPage';
import { AssessmentsPage } from './pages/AssessmentsPage';
import { ProfilePage } from './pages/ProfilePage';
import { AuthPage } from './pages/AuthPage';
import type { Job, Event, PracticeTest, MonthlyCalendarResponse, MobileTab } from './types';
import { getJobs } from './api/jobs';
import { getEvents } from './api/events';
import { getJobTrackings } from './api/trackings';
import { getPracticeTests } from './api/practiceTests';

const AppContent: React.FC = () => {
  const { student, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<MobileTab>('home');
  const [isCreateJobOpen, setIsCreateJobOpen] = useState(false);

  // App shared data state
  const [jobs, setJobs] = useState<Job[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [practiceTests, setPracticeTests] = useState<PracticeTest[]>([]);
  const [trackedJobIds, setTrackedJobIds] = useState<Set<number>>(new Set());
  const [monthlyCache, setMonthlyCache] = useState<Record<string, MonthlyCalendarResponse>>({});

  const loadAllData = useCallback(async () => {
    if (!student) return;
    try {
      const [jobsData, eventsData, trackingsData, testsData] = await Promise.all([
        getJobs(),
        getEvents(),
        getJobTrackings(),
        getPracticeTests(),
      ]);

      setJobs(jobsData);
      setEvents(eventsData);
      setPracticeTests(testsData);

      const userIds = new Set(
        trackingsData
          .filter((t) => t.applicant_id === student.student_id)
          .map((t) => t.job_id)
      );
      setTrackedJobIds(userIds);
    } catch (err) {
      console.error('Failed to load application data:', err);
    }
  }, [student]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  const handleMonthDataLoaded = (year: number, month: number, data: MonthlyCalendarResponse) => {
    const key = `${year}-${String(month).padStart(2, '0')}`;
    setMonthlyCache((prev) => ({ ...prev, [key]: data }));
  };

  const handleJobTracked = (jobId: number) => {
    setTrackedJobIds((prev) => new Set([...prev, jobId]));
    // Invalidate calendar cache to refresh events
    setMonthlyCache({});
    loadAllData();
  };

  const handleRefresh = () => {
    setMonthlyCache({});
    loadAllData();
  };

  if (isLoading) {
    return (
      <div className="mobile-app-wrapper" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div
          style={{
            width: '36px',
            height: '36px',
            border: '3px solid var(--border-main)',
            borderTopColor: 'var(--primary)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="mobile-app-wrapper">
        <AuthPage />
      </div>
    );
  }

  const getHeaderTitle = () => {
    switch (activeTab) {
      case 'home':
        return 'Placement Tracker';
      case 'jobs':
        return 'Job Profiles';
      case 'events':
        return 'Assessment Events';
      case 'assessments':
        return 'Practice Tests';
      case 'profile':
        return 'My Profile';
    }
  };

  return (
    <div className="mobile-app-wrapper">
      <MobileHeader
        title={getHeaderTitle()}
        onOpenCreateJob={
          activeTab === 'jobs' || activeTab === 'home'
            ? () => setIsCreateJobOpen(true)
            : undefined
        }
      />

      <main className="screen-content">
        {activeTab === 'home' && (
          <HomePage
            onNavigateToJobs={() => setActiveTab('jobs')}
            trackedJobIds={trackedJobIds}
            onJobTracked={handleJobTracked}
            monthlyCache={monthlyCache}
            onDataLoaded={handleMonthDataLoaded}
          />
        )}

        {activeTab === 'jobs' && (
          <JobProfilesPage
            jobs={jobs}
            events={events}
            trackedJobIds={trackedJobIds}
            onRefreshData={handleRefresh}
            onJobTracked={handleJobTracked}
            isCreateJobOpen={isCreateJobOpen}
            setIsCreateJobOpen={setIsCreateJobOpen}
          />
        )}

        {activeTab === 'events' && (
          <EventsPage
            events={events}
            jobs={jobs}
            trackedJobIds={trackedJobIds}
            onRefreshData={handleRefresh}
          />
        )}

        {activeTab === 'assessments' && (
          <AssessmentsPage
            practiceTests={practiceTests}
            onRefreshData={handleRefresh}
          />
        )}

        {activeTab === 'profile' && <ProfilePage />}
      </main>

      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
};

export function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <NotificationProvider>
          <AppContent />
        </NotificationProvider>
      </AuthProvider>
    </ToastProvider>
  );
}

export default App;
