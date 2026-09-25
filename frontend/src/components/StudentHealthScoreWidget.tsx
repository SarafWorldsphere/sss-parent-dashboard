// ════════════════════════════════════════════════════════════════════════════
// ORPHANED COMPONENT — StudentHealthScoreWidget
// Was: displayed a composite "Health Score" (0-100) on old dashboard.
// Removed during: dashboard redesign (composite score considered misleading).
// Not imported by: any page or component.
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { HeartIcon } from '@heroicons/react/24/solid';

export default function StudentHealthScoreWidget({ score }: { score: number }) {
  const getStatusColor = (s: number) => {
    if (s >= 80) return 'text-green-500';
    if (s >= 50) return 'text-yellow-500';
    return 'text-red-500';
  };
  
  const getStatusBg = (s: number) => {
    if (s >= 80) return 'bg-green-50';
    if (s >= 50) return 'bg-yellow-50';
    return 'bg-red-50';
  };

  const getStatusText = (s: number) => {
    if (s >= 80) return 'GOOD';
    if (s >= 50) return 'NEEDS ATTENTION';
    return 'CRITICAL';
  };

  if (score === undefined || score === null) return null;

  return (
    <div className={`rounded-xl shadow-sm border border-gray-100 p-4 h-[140px] flex flex-col justify-center items-center text-center bg-white`}>
      <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 ${getStatusBg(score)}`}>
        <HeartIcon className={`w-6 h-6 ${getStatusColor(score)}`} />
      </div>
      <div className="flex items-end gap-1">
        <h3 className={`font-bold text-3xl ${getStatusColor(score)}`}>{score}</h3>
        <span className="text-sm text-gray-400 font-medium mb-1">/100</span>
      </div>
      <p className="text-xs text-gray-500 mt-1 uppercase tracking-wider font-semibold">Health Score</p>
      <p className={`text-[10px] mt-1 font-bold ${getStatusColor(score)}`}>{getStatusText(score)}</p>
    </div>
  );
}
