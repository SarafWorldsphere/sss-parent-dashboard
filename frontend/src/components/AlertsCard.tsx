// ════════════════════════════════════════════════════════════════════════════
// ORPHANED COMPONENT — AlertsCard
// Was: a standalone "Action Required" alerts card on the old dashboard.
// Dashboard redesign renders alerts inline within a SectionCard with
// AlertPill sub-component. Not imported by: any page or component.
// ════════════════════════════════════════════════════════════════════════════
'use client';

export default function AlertsCard({ alerts }: { alerts: any[] }) {
  if (!alerts || alerts.length === 0) return null;
  return (
    <div className="bg-red-50 rounded-2xl shadow-sm border border-red-100 p-6">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-red-500">⚠️</span>
        <h3 className="font-bold text-red-800">Action Required</h3>
      </div>
      <ul className="space-y-2">
        {alerts.map((a, i) => (
          <li key={i} className="text-sm font-medium text-red-700 flex items-start gap-2">
            <span className="text-red-400 mt-0.5">•</span> {a.message}
          </li>
        ))}
      </ul>
    </div>
  );
}
