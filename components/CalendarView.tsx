
import React from 'react';
import { CalendarIcon } from './icons/CalendarIcon';
import type { DailySchedule } from '../types';

interface CalendarViewProps {
  currentDate: Date;
  setCurrentDate: (date: Date) => void;
  onDateSelect: (date: Date) => void;
  selectedDate: Date | null;
  schedules: Record<string, DailySchedule>;
}

const CalendarView: React.FC<CalendarViewProps> = ({ currentDate, setCurrentDate, onDateSelect, selectedDate, schedules }) => {
  const monthNames = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];
  const dayNames = ["日", "月", "火", "水", "木", "金", "土"];

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startingDayOfWeek = firstDayOfMonth.getDay();

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };
  
  const formatDateKey = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  const renderDays = () => {
    const days = [];
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(<div key={`empty-${i}`} className="border-r border-b border-slate-200"></div>);
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dateKey = formatDateKey(date);
      const isSelected = selectedDate ? formatDateKey(selectedDate) === dateKey : false;
      const hasSchedule = schedules[dateKey] && schedules[dateKey].routes.length > 0;

      days.push(
        <div
          key={day}
          onClick={() => onDateSelect(date)}
          className={`p-2 border-r border-b border-slate-200 text-center cursor-pointer transition-colors ${isSelected ? 'bg-blue-500 text-white font-bold' : 'hover:bg-blue-100'} ${day === 1 ? 'border-l' : ''}`}
        >
          <span className="relative">
            {day}
            {hasSchedule && <span className={`absolute -top-1 -right-1.5 block h-2 w-2 rounded-full ${isSelected ? 'bg-white' : 'bg-green-500'}`}></span>}
          </span>
        </div>
      );
    }
    return days;
  };

  return (
    <div className="bg-white p-4 rounded-xl shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
            <CalendarIcon className="w-6 h-6 text-slate-500 mr-2" />
            <h2 className="text-xl font-bold text-slate-700">スケジュール</h2>
        </div>
        <div className="flex items-center">
          <button onClick={handlePrevMonth} className="p-2 rounded-full hover:bg-slate-100">&lt;</button>
          <h3 className="font-bold w-32 text-center">{year}年 {monthNames[month]}</h3>
          <button onClick={handleNextMonth} className="p-2 rounded-full hover:bg-slate-100">&gt;</button>
        </div>
      </div>
      <div className="grid grid-cols-7">
        {dayNames.map(day => (
          <div key={day} className="font-bold text-sm text-center text-slate-500 p-2 bg-slate-50 border-t border-b border-slate-200">{day}</div>
        ))}
        {renderDays()}
      </div>
    </div>
  );
};

export default CalendarView;