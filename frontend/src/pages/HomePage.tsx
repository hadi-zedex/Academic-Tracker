import React, { useState, useEffect, useCallback } from 'react';
import type { CalendarEventItem, MonthlyCalendarResponse } from '../types';
import { getMonthlyCalendar, getDailyCalendar } from '../api/calendar';
import { createJobTracking } from '../api/trackings';
import { useToast } from '../context/ToastContext';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Briefcase,
  CheckCircle2,
  Plus,
  Sparkles,
  Calendar as CalendarIcon,
} from 'lucide-react';

interface HomePageProps {
  onNavigateToJobs: () => void;
  trackedJobIds: Set<number>;
  onJobTracked: (jobId: number) => void;
  monthlyCache: Record<string, MonthlyCalendarResponse>;
  onDataLoaded: (year: number, month: number, data: MonthlyCalendarResponse) => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  onNavigateToJobs,
  trackedJobIds,
  onJobTracked,
  monthlyCache,
  onDataLoaded,
}) => {
  const { showToast } = useToast();

  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  const initialDate = new Date();
  const [currentYear, setCurrentYear] = useState<number>(initialDate.getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(initialDate.getMonth() + 1); // 1-12
  const [monthData, setMonthData] = useState<MonthlyCalendarResponse>({});
  const [agendaItems, setAgendaItems] = useState<CalendarEventItem[]>([]);
  const [isLoadingAgenda, setIsLoadingAgenda] = useState(false);

  // Fetch month data
  const loadMonth = useCallback(async (year: number, month: number) => {
    const key = `${year}-${String(month).padStart(2, '0')}`;
    if (monthlyCache[key]) {
      setMonthData(monthlyCache[key]);
      return;
    }

    try {
      const data = await getMonthlyCalendar(year, month);
      setMonthData(data);
      onDataLoaded(year, month, data);
    } catch (err) {
      console.error('Failed to load month calendar data:', err);
    }
  }, [monthlyCache, onDataLoaded]);

  useEffect(() => {
    loadMonth(currentYear, currentMonth);
  }, [currentYear, currentMonth, loadMonth]);

  // Load agenda items for selected date (Cache-first lookup)
  const loadAgendaForDate = useCallback(async (dateStr: string) => {
    const [year, month] = dateStr.split('-');
    const monthKey = `${year}-${month}`;

    if (monthlyCache[monthKey] && monthlyCache[monthKey][dateStr] !== undefined) {
      setAgendaItems(monthlyCache[monthKey][dateStr]);
      return;
    }

    setIsLoadingAgenda(true);
    try {
      const dailyItems = await getDailyCalendar(dateStr);
      setAgendaItems(dailyItems);
    } catch (err) {
      console.error('Failed to fetch daily calendar data:', err);
    } finally {
      setIsLoadingAgenda(false);
    }
  }, [monthlyCache]);

  useEffect(() => {
    loadAgendaForDate(selectedDate);
  }, [selectedDate, loadAgendaForDate, monthData]);

  const handlePrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentYear((y) => y - 1);
      setCurrentMonth(12);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentYear((y) => y + 1);
      setCurrentMonth(1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const handleJumpToday = () => {
    const now = new Date();
    setCurrentYear(now.getFullYear());
    setCurrentMonth(now.getMonth() + 1);
    setSelectedDate(todayStr);
  };

  const handleTrackJob = async (jobId: number) => {
    try {
      await createJobTracking(jobId);
      showToast('Job tracked successfully! Round schedules will now appear.', 'success');
      onJobTracked(jobId);
    } catch (err: any) {
      showToast(err.detail || 'Could not track job', 'error');
    }
  };

  // Build month cells
  const firstDayOfMonth = new Date(currentYear, currentMonth - 1, 1);
  const lastDayOfMonth = new Date(currentYear, currentMonth, 0);
  const daysInMonth = lastDayOfMonth.getDate();

  let firstDayIndex = firstDayOfMonth.getDay() - 1;
  if (firstDayIndex === -1) firstDayIndex = 6;

  const prevMonthLastDay = new Date(currentYear, currentMonth - 1, 0).getDate();
  const calendarCells: {
    dayNumber: number;
    dateStr: string;
    isCurrentMonth: boolean;
    isToday: boolean;
    isPassed: boolean;
    hasRedDot: boolean;
    hasBlueDot: boolean;
  }[] = [];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Prev month padding
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const d = prevMonthLastDay - i;
    const prevM = currentMonth === 1 ? 12 : currentMonth - 1;
    const prevY = currentMonth === 1 ? currentYear - 1 : currentYear;
    const dateStr = `${prevY}-${String(prevM).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const cellDate = new Date(prevY, prevM - 1, d);
    calendarCells.push({
      dayNumber: d,
      dateStr,
      isCurrentMonth: false,
      isToday: dateStr === todayStr,
      isPassed: cellDate < today,
      hasRedDot: false,
      hasBlueDot: false,
    });
  }

  // Current month
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const cellDate = new Date(currentYear, currentMonth - 1, day);
    const dayItems = monthData[dateStr] || [];
    const hasRedDot = dayItems.some((i) => i.color === 'red');
    const hasBlueDot = dayItems.some((i) => i.color === 'blue');

    calendarCells.push({
      dayNumber: day,
      dateStr,
      isCurrentMonth: true,
      isToday: dateStr === todayStr,
      isPassed: cellDate < today,
      hasRedDot,
      hasBlueDot,
    });
  }

  // Next month padding
  const remainingDays = (7 - (calendarCells.length % 7)) % 7;
  for (let day = 1; day <= remainingDays; day++) {
    const nextM = currentMonth === 12 ? 1 : currentMonth + 1;
    const nextY = currentMonth === 12 ? currentYear + 1 : currentYear;
    const dateStr = `${nextY}-${String(nextM).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const cellDate = new Date(nextY, nextM - 1, day);
    calendarCells.push({
      dayNumber: day,
      dateStr,
      isCurrentMonth: false,
      isToday: dateStr === todayStr,
      isPassed: cellDate < today,
      hasRedDot: false,
      hasBlueDot: false,
    });
  }

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const formatDisplayDate = (dateStr: string) => {
    try {
      const [y, m, d] = dateStr.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      const isToday = dateStr === todayStr;
      const formatted = dateObj.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
      return isToday ? `Today • ${formatted}` : formatted;
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
    <div className="home-screen-container">
      {/* 1. Top Section: Monthly Calendar Widget */}
      <div className="home-calendar-card">
        <div className="home-month-nav">
          <h2 className="home-month-title">
            {monthNames[currentMonth - 1]} {currentYear}
          </h2>
          <div className="home-month-btn-group">
            <button onClick={handlePrevMonth} aria-label="Previous month">
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={handleJumpToday}
              style={{ width: 'auto', padding: '0 8px', fontSize: '0.75rem', fontWeight: 600 }}
            >
              Today
            </button>
            <button onClick={handleNextMonth} aria-label="Next month">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <div className="compact-calendar-grid">
          {weekdays.map((wd) => (
            <div key={wd} className="compact-weekday-header">
              {wd}
            </div>
          ))}

          {calendarCells.map((cell, idx) => {
            const isSelected = cell.dateStr === selectedDate;

            return (
              <div
                key={`${cell.dateStr}-${idx}`}
                className={`compact-day-cell ${!cell.isCurrentMonth ? 'other-month' : ''} ${
                  cell.isToday ? 'is-today' : ''
                } ${cell.isPassed ? 'is-passed' : ''} ${isSelected ? 'is-selected' : ''}`}
                onClick={() => {
                  if (cell.isCurrentMonth) setSelectedDate(cell.dateStr);
                }}
              >
                <span className="compact-day-num">{cell.dayNumber}</span>
                <div className="cell-dot-indicators">
                  {cell.hasRedDot && <span className="event-dot red" />}
                  {cell.hasBlueDot && <span className="event-dot blue" />}
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '16px',
            marginTop: '12px',
            paddingTop: '10px',
            borderTop: '1px solid var(--border-light)',
            fontSize: '0.725rem',
            color: 'var(--text-secondary)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span className="event-dot red" />
            <span>Deadlines</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span className="event-dot blue" />
            <span>OA / Interviews</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span
              style={{
                width: '10px',
                height: '10px',
                border: '1px solid var(--passed-day-strike)',
                background: 'linear-gradient(135deg, transparent 40%, var(--passed-day-strike) 50%, transparent 60%)',
              }}
            />
            <span>Passed</span>
          </div>
        </div>
      </div>

      {/* 2. Scroll-Down Section: Today's / Selected Day's Agenda */}
      <div className="home-agenda-section">
        <div className="agenda-section-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <CalendarIcon size={16} className="text-primary" />
            <h3 className="agenda-section-title">{formatDisplayDate(selectedDate)}</h3>
          </div>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
            {agendaItems.length} {agendaItems.length === 1 ? 'item' : 'items'}
          </span>
        </div>

        {isLoadingAgenda ? (
          <div className="empty-state-box">
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Loading schedule...</p>
          </div>
        ) : agendaItems.length === 0 ? (
          <div className="empty-state-box" style={{ padding: '30px 16px', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid var(--border-main)' }}>
            <Sparkles className="empty-state-icon" />
            <p className="empty-state-title">No events or deadlines</p>
            <p className="empty-state-desc">
              Nothing scheduled for this day. Explore available job openings in Job Profiles.
            </p>
            <button
              className="btn-primary-mobile"
              onClick={onNavigateToJobs}
              style={{ marginTop: '8px' }}
            >
              <Briefcase size={14} />
              <span>Browse Job Profiles</span>
            </button>
          </div>
        ) : (
          agendaItems.map((item, index) => {
            const isRed = item.color === 'red';
            const isJob = item.type === 'job_deadline';
            const isEvent = item.type === 'event';
            const isTest = item.type === 'practice_test';
            const isTracked = isJob && trackedJobIds.has(item.id);

            return (
              <div
                key={`${item.type}-${item.id}-${index}`}
                className={`agenda-item-card ${isRed ? 'border-red' : 'border-blue'}`}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <span
                      className={`status-tag ${isRed ? 'status-closing-soon' : 'status-open'}`}
                      style={{ fontSize: '0.675rem' }}
                    >
                      {isJob && 'Job Deadline'}
                      {isEvent && (item.event_type || 'Event')}
                      {isTest && 'Practice Test'}
                    </span>
                    <span className="agenda-card-time">
                      <Clock size={12} />
                      <span>{formatItemTime(item.datetime)}</span>
                    </span>
                  </div>

                  <h4 className="agenda-card-title">{item.label}</h4>

                  {isEvent && (item.company_name || item.role) && (
                    <p style={{ fontSize: '0.775rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      {item.company_name} {item.role && `• ${item.role}`}
                    </p>
                  )}
                </div>

                {isJob && (
                  <button
                    className={`status-tag ${isTracked ? 'status-tracked' : 'status-open'}`}
                    onClick={() => !isTracked && handleTrackJob(item.id)}
                    disabled={isTracked}
                    style={{ padding: '6px 10px', cursor: isTracked ? 'default' : 'pointer' }}
                  >
                    {isTracked ? (
                      <>
                        <CheckCircle2 size={13} />
                        <span>Tracked</span>
                      </>
                    ) : (
                      <>
                        <Plus size={13} />
                        <span>Track</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
