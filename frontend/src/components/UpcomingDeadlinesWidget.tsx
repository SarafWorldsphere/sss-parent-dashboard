// ════════════════════════════════════════════════════════════════════════════
// ORPHANED COMPONENT — UpcomingDeadlinesWidget
// Was: a standalone deadlines card on the old dashboard. Dashboard redesign
// renders deadlines inline within a SectionCard — no external component needed.
// Not imported by: any page or component.
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { CalendarIcon, ClockIcon } from '@heroicons/react/24/outline';

export default function UpcomingDeadlinesWidget({ deadlines }: { deadlines: any[] }) {
  if (!deadlines || deadlines.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 h-[140px] flex flex-col justify-center items-center text-center">
        <div className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center mb-2">
          <CalendarIcon className="w-5 h-5 text-gray-400" />
        </div>
        <p className="text-gray-500 text-sm">No upcoming deadlines.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 h-[140px] flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <CalendarIcon className="w-5 h-5 text-orange-500" />
        <h3 className="font-bold text-gray-800 text-sm">Upcoming Deadlines</h3>
      </div>
      <div className="space-y-3 flex-1 overflow-y-auto">
        {deadlines.map((item, idx) => (
          <div key={idx} className="flex justify-between items-start border-b border-gray-50 last:border-0 pb-2 last:pb-0">
            <div>
              <p className="text-sm font-medium text-gray-800 line-clamp-1">{item.title}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-600 uppercase tracking-wider">{item.type}</span>
                <span className="text-xs text-gray-500">{new Date(item.due_date).toLocaleDateString()}</span>
              </div>
            </div>
            <div className={`flex flex-col items-end text-xs font-medium px-2 py-1 rounded-md ${item.days_left <= 2 ? 'bg-red-50 text-red-600' : 'bg-orange-50 text-orange-600'}`}>
              <span className="flex items-center gap-1">
                <ClockIcon className="w-3 h-3" />
                {item.days_left === 0 ? 'Today' : `${item.days_left}d left`}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
