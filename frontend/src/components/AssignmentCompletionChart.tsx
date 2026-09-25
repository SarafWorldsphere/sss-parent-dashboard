// ════════════════════════════════════════════════════════════════════════════
// ORPHANED COMPONENT — AssignmentCompletionChart
// Was: a pie/donut chart showing assignment completion breakdown (completed /
// pending / overdue) on the old dashboard, driven by fetchAssignmentAnalytics.
// Removed during: dashboard redesign (AssignmentCompletionChart removed).
// Not imported by: any page or component.
// Restore: import in dashboard/page.tsx and supply assignment analytics data.
// ════════════════════════════════════════════════════════════════════════════
'use client';

// Pie/donut chart removed per UI refinement spec.
// Now renders a compact 3-stat summary row instead.
export default function AssignmentCompletionChart({ data }: { data: any }) {
  if (!data) return null;

  const total    = (data.total    ?? 0) as number;
  const completed = (data.submitted ?? data.completed ?? 0) as number;
  const pending  = (data.pending  ?? 0) as number;
  const overdue  = (data.overdue  ?? 0) as number;
  const pct      = total > 0 ? Math.round((completed / total) * 100) : 0;

  const stats = [
    { label: 'Completed', value: completed, color: 'bg-emerald-500', text: 'text-emerald-700' },
    { label: 'Pending',   value: pending,   color: 'bg-amber-400',   text: 'text-amber-700'   },
    { label: 'Overdue',   value: overdue,   color: 'bg-red-500',     text: 'text-red-700'     },
  ];

  return (
    <div className="space-y-2">
      {/* Stacked progress bar */}
      <div className="flex h-2 rounded-full overflow-hidden gap-0.5">
        {total > 0 ? (
          <>
            <div className="bg-emerald-500 rounded-full transition-all duration-700" style={{ width: `${(completed/total)*100}%` }} />
            <div className="bg-amber-400 rounded-full transition-all duration-700"   style={{ width: `${(pending/total)*100}%`   }} />
            <div className="bg-red-500 rounded-full transition-all duration-700"     style={{ width: `${(overdue/total)*100}%`   }} />
          </>
        ) : <div className="bg-gray-200 w-full rounded-full" />}
      </div>
      {/* Legend */}
      <div className="flex items-center gap-4">
        {stats.map(s => (
          <div key={s.label} className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${s.color} shrink-0`} />
            <span className="text-[10px] text-gray-500">{s.label}</span>
            <span className={`text-[10px] font-black ${s.text}`}>{s.value}</span>
          </div>
        ))}
        <span className="ml-auto text-xs font-black text-gray-700">{pct}%</span>
      </div>
    </div>
  );
}
