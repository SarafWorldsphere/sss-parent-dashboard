// ════════════════════════════════════════════════════════════════════════════
// ORPHANED COMPONENT — SubjectPerformanceChart
// Was: a Recharts bar chart for per-subject scores on the Analytics page.
// The Analytics page was removed. Dashboard now renders inline progress bars
// (no external component needed). Not imported by: any page or component.
// ════════════════════════════════════════════════════════════════════════════
'use client';
import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export default function SubjectPerformanceChart({ data }: { data: any[] }) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) return <div className="h-64 w-full mt-4 bg-gray-50 animate-pulse rounded-xl"></div>;
  if (!data || data.length === 0) return null;

  return (
    <div className="h-64 w-full mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <XAxis dataKey="subject" tick={{ fontSize: 12, fill: '#6B7280' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 12, fill: '#6B7280' }} axisLine={false} tickLine={false} />
          <Tooltip 
            cursor={{ fill: '#F3F4F6' }} 
            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
          />
          <Bar dataKey="score" radius={[6, 6, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.score >= 75 ? '#10B981' : entry.score >= 50 ? '#F59E0B' : '#EF4444'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
