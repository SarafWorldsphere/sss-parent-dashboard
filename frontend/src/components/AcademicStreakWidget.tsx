// ════════════════════════════════════════════════════════════════════════════
// ORPHANED COMPONENT — AcademicStreakWidget
// Was: showed "Academic Streak" (consecutive active weeks) on old dashboard.
// Removed during: dashboard redesign (fake-streak metric removed).
// Not imported by: any page or component.
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { FireIcon } from '@heroicons/react/24/solid';

export default function AcademicStreakWidget({ streak }: { streak: string[] }) {
  if (!streak || streak.length === 0) return null;

  return (
    <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl shadow-sm text-white p-4 h-[140px] flex flex-col relative overflow-hidden">
      <div className="absolute top-0 right-0 p-4 opacity-20">
        <FireIcon className="w-16 h-16" />
      </div>
      <div className="flex items-center gap-2 mb-3 relative z-10">
        <FireIcon className="w-5 h-5 text-yellow-300" />
        <h3 className="font-bold text-sm">Academic Streak</h3>
      </div>
      <div className="space-y-2 relative z-10">
        {streak.map((item, idx) => (
          <div key={idx} className="flex items-center gap-2 bg-white/10 rounded-lg p-2 backdrop-blur-sm border border-white/20">
            <div className="w-1.5 h-1.5 rounded-full bg-yellow-300"></div>
            <p className="text-xs font-medium">{item}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
