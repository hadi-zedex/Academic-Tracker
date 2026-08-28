import React, { useState, useEffect, useCallback } from 'react';
import { getDailyCalendar } from '../../api/calendar';
import type { CalendarEventItem, MonthlyCalendarResponse } from '../../types';
import {
  Clock,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Briefcase,
  Sparkles,
  CheckCircle2,
  Plus,
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { createJobTracking } from '../../api/trackings';

interface DailyAgendaProps {
  selectedDate: string;
  onDateChange: (newDate: string) => void;
  monthlyCache: Record<string, MonthlyCalendarResponse>;
  onNavigateToJobs?: () => void;
  trackedJobIds?: Set<number>;
  onJobTracked?: (jobId: number) => void;
}

export const DailyAgenda: React.FC<DailyAgendaProps> = ({
  selectedDate,
  onDateChange,
  monthlyCache,
  onNavigateToJobs,
  trackedJobIds = new Set(),
  onJobTracked,
}) => {
  const [items, setItems] = useState<CalendarEventItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isCacheHit, setIsCacheHit] = useState<boolean>(false);
  const { showToast } = useToast();

  const loadDayItems = useCallback(async (dateStr: string) => {
    if (!dateStr) return;

    const [year, month] = dateStr.split('-');
    const monthKey = `${year}-${month}`;

    // 1. Try client-side lookup from loaded monthly data first (Roadmap Step 8.5)
    if (monthlyCache[monthKey] && monthlyCache[monthKey][dateStr] !== undefined) {
      setItems(monthlyCache[monthKey][dateStr]);
      setIsCacheHit(true);
      return;
    }

    // 2. Cache miss: Fetch directly from /calendar/daily?date=YYYY-MM-DD
    setIsCacheHit(false);
    setIsLoading(true);
    try {
      const dailyItems = await getDailyCalendar(dateStr);
      setItems(dailyItems);
    } catch (err) {
      console.error('Failed to fetch daily calendar data:', err);
      showToast('Failed to load daily schedule', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [monthlyCache, showToast]);

  useEffect(() => {
    loadDayItems(selectedDate);
  }, [selectedDate, loadDayItems]);

  const handlePrevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    onDateChange(d.toISOString().split('T')[0]);
  };

  const handleNextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    onDateChange(d.toISOString().split('T')[0]);
  };

  const handleJumpToday = () => {
    const today = new Date().toISOString().split('T')[0];
    onDateChange(today);
  };

  const handleTrackJob = async (jobId: number) => {
    try {
      await createJobTracking(jobId);
      showToast('Job tracked successfully! You will receive deadline alerts.', 'success');
      if (onJobTracked) {
        onJobTracked(jobId);
      }
    } catch (err: any) {
      showToast(err.detail || 'Could not track job', 'error');
    }
  };

  const formatDisplayDate = (dateStr: string) => {
    try {
      const [y, m, d] = dateStr.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      return dateObj.toLocaleDateString(undefined, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const formatItemTime = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <div className="daily-view-layout">
      {/* Sidebar / Quick Date Selector */}
      <div className="date-picker-card card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CalendarIcon size={18} />
            <span>Select Date</span>
          </h3>
          <button className="btn btn-sm btn-secondary" onClick={handleJumpToday}>
            Today
          </button>
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Pick any date</label>
          <input
            type="date"
            className="form-input"
            value={selectedDate}
            onChange={(e) => e.target.value && onDateChange(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary" onClick={handlePrevDay} style={{ flex: 1 }}>
            <ChevronLeft size={16} />
            <span>Prev Day</span>
          </button>
          <button className="btn btn-secondary" onClick={handleNextDay} style={{ flex: 1 }}>
            <span>Next Day</span>
            <ChevronRight size={16} />
          </button>
        </div>

        <div
          style={{
            padding: '12px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            fontSize: '0.8rem',
            color: 'var(--text-muted)',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
            ⚡ Client-side Lookup:
          </span>
          <span>
            {isCacheHit
              ? 'Instant cache hit from loaded monthly data.'
              : 'Loaded on-demand from /calendar/daily endpoint.'}
          </span>
        </div>
      </div>

      {/* Main Agenda Timeline */}
      <div className="agenda-timeline">
        <div className="agenda-date-banner">
          <div>
            <h2 className="agenda-date-title">{formatDisplayDate(selectedDate)}</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              {items.length} {items.length === 1 ? 'event or deadline' : 'events or deadlines'} scheduled
            </p>
          </div>
          {isLoading && <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Loading...</span>}
        </div>

        {items.length === 0 ? (
          <div className="card empty-state" style={{ padding: '60px 20px' }}>
            <Sparkles className="empty-icon" />
            <h3 className="empty-title">No deadlines or events for this date</h3>
            <p className="empty-description">
              Enjoy your free time or prepare for upcoming assessments! Check the Monthly Grid or Jobs Hub to explore new opportunities.
            </p>
            {onNavigateToJobs && (
              <button
                className="btn btn-secondary"
                onClick={onNavigateToJobs}
                style={{ marginTop: '12px' }}
              >
                <Briefcase size={16} />
                <span>Explore Jobs Catalog</span>
              </button>
            )}
          </div>
        ) : (
          items.map((item, index) => {
            const isRed = item.color === 'red';
            const isJob = item.type === 'job_deadline';
            const isEvent = item.type === 'event';
            const isTest = item.type === 'practice_test';
            const isTracked = isJob && trackedJobIds.has(item.id);

            return (
              <div
                key={`${item.type}-${item.id}-${index}`}
                className={`timeline-item-card ${isRed ? 'item-red' : 'item-blue'}`}
              >
                <div className="timeline-left">
                  <div className="timeline-time">
                    <Clock size={14} />
                    <span>{formatItemTime(item.datetime)}</span>
                    <span
                      className={`notification-type-tag ${isRed ? 'type-1hr' : 'type-3hr'}`}
                      style={{ fontSize: '0.65rem', marginLeft: '6px' }}
                    >
                      {isJob && 'Job Deadline'}
                      {isEvent && (item.event_type || 'Event')}
                      {isTest && 'Practice Test'}
                    </span>
                  </div>

                  <h3 className="timeline-title">{item.label}</h3>

                  {isEvent && (item.company_name || item.role) && (
                    <p className="timeline-meta">
                      Company: <strong>{item.company_name}</strong> {item.role && `• Role: ${item.role}`}
                    </p>
                  )}

                  {isJob && (
                    <p className="timeline-meta">
                      Job Application window closes at {formatItemTime(item.datetime)}.
                    </p>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {isJob && (
                    <button
                      className={`tracking-btn ${isTracked ? 'is-tracked' : 'not-tracked'}`}
                      onClick={() => !isTracked && handleTrackJob(item.id)}
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
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
