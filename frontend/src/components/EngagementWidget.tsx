// ════════════════════════════════════════════════════════════════════════════
// ORPHANED COMPONENT — EngagementWidget
// Was: displayed an "Engagement Score" metric (High/Average/Low) on the old
// dashboard, driven by EngagementIndicatorSchema. Removed during dashboard
// redesign as fake-metric/vanity data.
// Not imported by: any page or component.
// ════════════════════════════════════════════════════════════════════════════
'use client';
export default function EngagementWidget({ data }: { data: any }) {
  if (!data) return null;
  return (
    <div className="bg-white h-[140px] flex flex-col justify-center overflow-hidden p-4 rounded-2xl border border-gray-100 shadow-sm transition-all hover:shadow-md">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-gray-800 flex items-center gap-2">
          <span className="text-xl">🌟</span> Engagement Score
        </h3>
        <span className="font-black text-2xl text-orange-600">{data.score}/100</span>
      </div>
      <div className="w-full bg-gray-100 h-2 rounded-full mb-2 overflow-hidden">
        <div className="bg-gradient-to-r from-orange-400 to-orange-600 h-2 rounded-full transition-all duration-1000" style={{ width: `${data.score}%` }}></div>
      </div>
      <p className="text-sm text-gray-500 font-medium">{data.description}</p>
    </div>
  );
}
