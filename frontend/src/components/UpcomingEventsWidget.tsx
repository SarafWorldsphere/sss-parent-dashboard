// ════════════════════════════════════════════════════════════════════════════
// ORPHANED COMPONENT — UpcomingEventsWidget
// Was: displayed school events (Exams, PTM, Holidays) from the SchoolEvent
// table. Dashboard now returns upcoming_events=[] (no events queried).
// Not imported by: any page or component.
// ════════════════════════════════════════════════════════════════════════════
'use client';

export default function UpcomingEventsWidget({ events }: { events: any[] }) {
  if (!events || events.length === 0) return null;
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 transition-all hover:shadow-md">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-gray-800 flex items-center gap-2">
          <span className="text-xl">🏆</span> Upcoming Events
        </h3>
      </div>
      <div className="space-y-3">
        {events.map((ev, idx) => (
          <div key={idx} className="flex gap-3 items-start p-3 rounded-lg bg-gray-50 border border-gray-100">
            <div className="bg-white px-3 py-1.5 rounded-lg text-center border border-gray-200 shadow-sm shrink-0">
              <div className="text-[10px] text-red-500 font-bold uppercase tracking-wider">{new Date(ev.event_date).toLocaleString('en-us', { month: 'short' })}</div>
              <div className="text-lg font-black text-gray-800 leading-none">{new Date(ev.event_date).getDate()}</div>
            </div>
            <div>
              <p className="font-semibold text-gray-800 text-sm">{ev.title}</p>
              <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">{ev.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
