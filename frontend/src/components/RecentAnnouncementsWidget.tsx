// ════════════════════════════════════════════════════════════════════════════
// ORPHANED COMPONENT — RecentAnnouncementsWidget
// Was: showed recent school notices/announcements on the old dashboard.
// Dashboard redesign surfaces notices through the notifications feed and the
// dedicated /parent/notices page. Not imported by: any page or component.
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { MegaphoneIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';

export default function RecentAnnouncementsWidget({ notices }: { notices: any[] }) {
  if (!notices || notices.length === 0) return null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 h-[140px] flex flex-col">
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2">
          <MegaphoneIcon className="w-5 h-5 text-orange-500" />
          <h3 className="font-bold text-gray-800 text-sm">Recent Announcements</h3>
        </div>
        <Link href="/parent/notices" className="text-xs font-semibold text-orange-600 hover:text-orange-700">
          View All
        </Link>
      </div>
      <div className="space-y-3">
        {notices.map((notice, idx) => (
          <div key={idx} className="bg-orange-50/50 p-3 rounded-lg border border-orange-100">
            <div className="flex justify-between items-start mb-1">
              <h4 className="font-semibold text-sm text-gray-800 line-clamp-1">{notice.title}</h4>
              <span className="text-[10px] text-gray-500 whitespace-nowrap ml-2">{notice.date}</span>
            </div>
            <p className="text-xs text-gray-600 line-clamp-2">{notice.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
