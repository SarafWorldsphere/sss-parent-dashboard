// ════════════════════════════════════════════════════════════════════════════
// ORPHANED COMPONENT — ClassRankWidget
// Was: displayed "Top N% in class" rank card, driven by ClassRankSchema.
// Removed during: dashboard redesign (fake-percentile data removed).
// Not imported by: any page or component.
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { TrophyIcon } from '@heroicons/react/24/solid';

export default function ClassRankWidget({ rankData }: { rankData: any }) {
  if (!rankData) return null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 h-[140px] flex flex-col justify-center items-center text-center">
      <div className="w-12 h-12 bg-yellow-50 rounded-full flex items-center justify-center mb-2">
        <TrophyIcon className="w-6 h-6 text-yellow-500" />
      </div>
      <h3 className="font-bold text-2xl text-gray-800">{rankData.percentile}</h3>
      <p className="text-xs text-gray-500 mt-1 uppercase tracking-wider font-semibold">Class Rank</p>
      <p className="text-[10px] text-gray-400 mt-1">{rankData.description}</p>
    </div>
  );
}
