// ════════════════════════════════════════════════════════════════════════════
// ORPHANED COMPONENT — DailySummaryCard
// Was: showed daily summary counts (assignments pending, notices today,
// upcoming quizzes) as a standalone card on the old dashboard. Dashboard
// redesign moved those figures into the StatCard row inline.
// Not imported by: any page or component.
// ════════════════════════════════════════════════════════════════════════════
'use client';

export default function DailySummaryCard({ summary }: { summary: any }) {
  if (!summary) return null;
  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm text-center transition-transform hover:-translate-y-1">
        <div className="text-2xl mb-1">📝</div>
        <div className="text-2xl font-black text-gray-800">{summary.assignments_pending}</div>
        <div className="text-[10px] text-gray-500 uppercase tracking-wide font-bold mt-1">Pending</div>
      </div>
      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm text-center transition-transform hover:-translate-y-1">
        <div className="text-2xl mb-1">🔔</div>
        <div className="text-2xl font-black text-gray-800">{summary.notices_today}</div>
        <div className="text-[10px] text-gray-500 uppercase tracking-wide font-bold mt-1">Notices Today</div>
      </div>
      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm text-center transition-transform hover:-translate-y-1">
        <div className="text-2xl mb-1">🎯</div>
        <div className="text-2xl font-black text-gray-800">{summary.upcoming_quizzes}</div>
        <div className="text-[10px] text-gray-500 uppercase tracking-wide font-bold mt-1">Upcoming Quizzes</div>
      </div>
    </div>
  );
}
