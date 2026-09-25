// ════════════════════════════════════════════════════════════════════════════
// ORPHANED COMPONENT — WeeklyProgressWidget
// Was: showed a "Weekly Progress %" trend card on old dashboard.
// Removed during: dashboard redesign (fake vanity metric cleanup).
// Not imported by: any page or component.
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { ChartBarIcon, ArrowTrendingUpIcon, ArrowTrendingDownIcon } from '@heroicons/react/24/solid';

export default function WeeklyProgressWidget({ progress }: { progress: any }) {
  if (!progress) return null;
  
  const isPositive = progress.trend_percentage.startsWith('+');

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 h-[140px] flex flex-col justify-center items-center text-center">
      <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 ${isPositive ? 'bg-green-50' : 'bg-red-50'}`}>
        <ChartBarIcon className={`w-6 h-6 ${isPositive ? 'text-green-500' : 'text-red-500'}`} />
      </div>
      <div className="flex items-center gap-1">
        <h3 className={`font-bold text-2xl ${isPositive ? 'text-green-600' : 'text-red-600'}`}>{progress.trend_percentage}</h3>
        {isPositive ? <ArrowTrendingUpIcon className="w-4 h-4 text-green-500"/> : <ArrowTrendingDownIcon className="w-4 h-4 text-red-500"/>}
      </div>
      <p className="text-xs text-gray-500 mt-1 uppercase tracking-wider font-semibold">Weekly Progress</p>
      <p className="text-[10px] text-gray-400 mt-1">{progress.description}</p>
    </div>
  );
}
