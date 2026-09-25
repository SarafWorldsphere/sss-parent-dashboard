// ════════════════════════════════════════════════════════════════════════════
// ORPHANED COMPONENT — PerformanceSummaryWidget
// Was: a standalone performance summary card on the old dashboard.
// Dashboard redesign renders this inline within a SectionCard.
// Not imported by: any page or component.
// ════════════════════════════════════════════════════════════════════════════
'use client';

export default function PerformanceSummaryWidget({ data }: { data: any }) {
  if (!data) return null;
  return (
    <div className="bg-white h-[140px] flex flex-col justify-center overflow-hidden rounded-2xl shadow-sm border border-gray-100 p-4 transition-all hover:shadow-md">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-gray-800 flex items-center gap-2">
          <span className="text-xl">📊</span> Performance Summary
        </h3>
      </div>
      <div className="space-y-4">
        <div className="flex justify-between items-center border-b pb-2">
          <span className="text-gray-500 text-sm">Monthly Improvement</span>
          <span className={`font-bold ${data.improvement_percent.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>{data.improvement_percent}</span>
        </div>
        <div className="flex justify-between items-center border-b pb-2">
          <span className="text-gray-500 text-sm">Strongest Subject</span>
          <span className="font-bold text-gray-800">{data.strongest_subject}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-500 text-sm">Needs Focus</span>
          <span className="font-bold text-orange-600">{data.weakest_subject}</span>
        </div>
      </div>
    </div>
  );
}
