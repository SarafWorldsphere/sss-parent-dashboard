// ════════════════════════════════════════════════════════════════════════════
// ORPHANED COMPONENT — AcademicHealthWidget
// Was: displayed an "Academic Health" status card (Good/Average/Needs Attention)
// on the old dashboard, driven by AcademicHealthSchema.
// Removed during: dashboard redesign (fake-data cleanup).
// Not imported by: any page or component.
// Restore: import in dashboard/page.tsx and pass data?.academic_health prop.
// ════════════════════════════════════════════════════════════════════════════
'use client';
import Link from 'next/link';

export default function AcademicHealthWidget({ data }: { data: any }) {
  if (!data) return (
    <Link href="/parent/analytics" className="flex flex-col justify-between p-3 rounded-xl bg-gray-50 border border-gray-100 h-full">
      <p className="text-xs text-gray-500 font-semibold">Academic Health</p>
      <p className="text-2xl font-black text-gray-300">—</p>
    </Link>
  );

  // description is "Score: 76/100"
  const score = data.description?.match(/\d+/)?.[ 0] ?? '—';

  const pillCfg: Record<string, string> = {
    'Good':           'text-green-700 bg-green-100',
    'Average':        'text-yellow-700 bg-yellow-100',
    'Needs Attention':'text-red-700 bg-red-100',
    'Excellent':      'text-emerald-700 bg-emerald-100',
  };
  const pillClass = pillCfg[data.status] ?? 'text-gray-600 bg-gray-100';

  return (
    <Link href="/parent/analytics" className="flex flex-col justify-between p-3 rounded-xl bg-gray-50 border border-gray-100 hover:border-orange-200 hover:bg-orange-50 transition-all cursor-pointer h-full">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs text-gray-500 font-semibold">Academic Health</p>
        <span className="text-base">❤️</span>
      </div>
      <p className="text-2xl font-black text-gray-900 leading-none">
        {score}<span className="text-sm font-medium text-gray-400">/100</span>
      </p>
      <span className={`mt-2 self-start text-[10px] font-bold px-2 py-0.5 rounded-full ${pillClass}`}>
        {data.status}
      </span>
    </Link>
  );
}
