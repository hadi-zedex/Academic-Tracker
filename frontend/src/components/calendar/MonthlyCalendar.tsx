import React, { useState, useEffect, useCallback } from 'react';
import { getMonthlyCalendar } from '../../api/calendar';
import type { MonthlyCalendarResponse, CalendarEventItem } from '../../types';
import { ChevronLeft, ChevronRight, Clock, Sparkles } from 'lucide-react';

interface MonthlyCalendarProps {
  onSelectDate: (dateStr: string) => void;
  selectedDate: string;
  onDataLoaded?: (year: number, month: number, data: MonthlyCalendarResponse) => void;
  monthlyCache: Record<string, MonthlyCalendarResponse>;
}

export const MonthlyCalendar: React.FC<MonthlyCalendarProps> = ({
  onSelectDate,
  selectedDate,
  onDataLoaded,
  monthlyCache,
}) => {
  const initialDate = selectedDate ? new Date(selectedDate) : new Date();
  const [currentYear, setCurrentYear] = useState<number>(initialDate.getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(initialDate.getMonth() + 1); // 1-12
  const [calendarData, setCalendarData] = useState<MonthlyCalendarResponse>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const fetchMonthData = useCallback(async (year: number, month: number) => {
    const key = `${year}-${String(month).padStart(2, '0')}`;
    if (monthlyCache[key]) {
      setCalendarData(monthlyCache[key]);
      return;
    }

    try {
      setIsLoading(true);
      const data = await getMonthlyCalendar(year, month);
      setCalendarData(data);
      if (onDataLoaded) {
        onDataLoaded(year, month, data);
      }
    } catch (err) {
      console.error('Failed to load monthly calendar data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [monthlyCache, onDataLoaded]);

  useEffect(() => {
    fetchMonthData(currentYear, currentMonth);
  }, [currentYear, currentMonth, fetchMonthData]);

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
    const todayStr = now.toISOString().split('T')[0];
    onSelectDate(todayStr);
  };

  // Generate calendar days matrix
  const firstDayOfMonth = new Date(currentYear, currentMonth - 1, 1);
  const lastDayOfMonth = new Date(currentYear, currentMonth, 0);
  const daysInMonth = lastDayOfMonth.getDate();

  // Day of week for 1st (0 = Sun, 1 = Mon, ..., 6 = Sat) -> convert so Mon = 0, Sun = 6
  let firstDayIndex = firstDayOfMonth.getDay() - 1;
  if (firstDayIndex === -1) firstDayIndex = 6;

  // Previous month padding
  const prevMonthLastDay = new Date(currentYear, currentMonth - 1, 0).getDate();
  const calendarCells: {
    dayNumber: number;
    dateStr: string;
    isCurrentMonth: boolean;
    isToday: boolean;
    isPassed: boolean;
    items: CalendarEventItem[];
  }[] = [];

  const todayStr = new Date().toISOString().split('T')[0];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 1. Previous month days
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
      items: [],
    });
  }

  // 2. Current month days
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const cellDate = new Date(currentYear, currentMonth - 1, day);
    const items = calendarData[dateStr] || [];
    calendarCells.push({
      dayNumber: day,
      dateStr,
      isCurrentMonth: true,
      isToday: dateStr === todayStr,
      isPassed: cellDate < today,
      items,
    });
  }

  // 3. Next month days (fill out to multiple of 7)
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
      items: [],
    });
  }

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const formatItemTime = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <div className="monthly-calendar-container">
      <div className="calendar-view-header">
        <div className="calendar-title-group">
          <h2 className="month-heading">
            {monthNames[currentMonth - 1]} {currentYear}
          </h2>
          <div className="calendar-nav-controls">
            <button className="icon-btn" onClick={handlePrevMonth} aria-label="Previous month" style={{ width: '32px', height: '32px' }}>
              <ChevronLeft size={16} />
            </button>
            <button className="btn btn-sm btn-secondary" onClick={handleJumpToday} style={{ padding: '4px 10px', fontSize: '0.8rem' }}>
              Today
            </button>
            <button className="icon-btn" onClick={handleNextMonth} aria-label="Next month" style={{ width: '32px', height: '32px' }}>
              <ChevronRight size={16} />
            </button>
          </div>
          {isLoading && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Updating...</span>}
        </div>

        <div className="legend-group">
          <div className="legend-item">
            <span className="legend-dot red" />
            <span>Deadlines & Practice Tests</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot blue" />
            <span>OA / PPT / Interviews</span>
          </div>
          <div className="legend-item">
            <span className="legend-slash" />
            <span>Past Days (Journal Slash)</span>
          </div>
        </div>
      </div>

      <div className="calendar-matrix">
        <div className="calendar-weekdays-row">
          {weekdays.map((wd) => (
            <div key={wd} className="weekday-label">
              {wd}
            </div>
          ))}
        </div>

        <div className="calendar-days-grid">
          {calendarCells.map((cell, idx) => {
            const isSelected = cell.dateStr === selectedDate;
            const hasItems = cell.items.length > 0;

            return (
              <div
                key={`${cell.dateStr}-${idx}`}
                className={`day-cell ${!cell.isCurrentMonth ? 'other-month' : ''} ${
                  cell.isToday ? 'is-today' : ''
                } ${cell.isPassed ? 'is-passed' : ''} ${isSelected ? 'is-selected' : ''}`}
                onClick={() => cell.isCurrentMonth && onSelectDate(cell.dateStr)}
                title={cell.isCurrentMonth ? `Click to view agenda for ${cell.dateStr}` : undefined}
              >
                <div className="day-header">
                  <span className="day-number">{cell.dayNumber}</span>
                  {hasItems && (
                    <span
                      style={{
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        color: 'var(--text-muted)',
                        background: 'var(--bg-secondary)',
                        padding: '1px 5px',
                        borderRadius: '4px',
                      }}
                    >
                      {cell.items.length}
                    </span>
                  )}
                </div>

                <div className="day-events-container">
                  {cell.items.slice(0, 3).map((item, itemIdx) => {
                    const isRed = item.color === 'red';
                    const timeStr = formatItemTime(item.datetime);

                    return (
                      <div
                        key={`${item.type}-${item.id}-${itemIdx}`}
                        className={`event-pill ${isRed ? 'pill-red' : 'pill-blue'}`}
                        title={`${item.label} (${timeStr})`}
                      >
                        {isRed ? (
                          <Clock className="event-pill-icon" />
                        ) : (
                          <Sparkles className="event-pill-icon" />
                        )}
                        <span className="event-pill-text">
                          {item.label}
                        </span>
                      </div>
                    );
                  })}

                  {cell.items.length > 3 && (
                    <div
                      style={{
                        fontSize: '0.7rem',
                        color: 'var(--text-muted)',
                        paddingLeft: '4px',
                        fontWeight: 600,
                      }}
                    >
                      +{cell.items.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
