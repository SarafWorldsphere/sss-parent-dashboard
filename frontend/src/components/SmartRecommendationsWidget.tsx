// ════════════════════════════════════════════════════════════════════════════
// ORPHANED COMPONENT — SmartRecommendationsWidget
// Was: a standalone card showing rule-based recommendations on the old
// dashboard. Dashboard redesign renders recommendations inline.
// Not imported by: any page or component.
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { LightBulbIcon } from '@heroicons/react/24/outline';
import { ChevronRightIcon } from '@heroicons/react/20/solid';

export default function SmartRecommendationsWidget({ recommendations }: { recommendations: any[] }) {
  if (!recommendations || recommendations.length === 0) return null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 h-[140px] flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <LightBulbIcon className="w-5 h-5 text-orange-500" />
        <h3 className="font-bold text-gray-800 text-sm">Smart Recommendations</h3>
      </div>
      <div className="space-y-2 flex-1">
        {recommendations.map((rec, idx) => (
          <div key={idx} className="flex justify-between items-center bg-gray-50 rounded-lg p-3 border border-gray-100 hover:border-orange-200 transition-colors group cursor-pointer">
            <div className="flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full ${rec.type === 'academic' ? 'bg-blue-400' : rec.type === 'task' ? 'bg-orange-400' : 'bg-green-400'}`}></div>
              <p className="text-xs font-medium text-gray-700">{rec.message}</p>
            </div>
            <ChevronRightIcon className="w-4 h-4 text-gray-400 group-hover:text-orange-500" />
          </div>
        ))}
      </div>
    </div>
  );
}
