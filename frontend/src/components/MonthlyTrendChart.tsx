// ════════════════════════════════════════════════════════════════════════════
// ORPHANED COMPONENT — MonthlyTrendChart
// Was: a Recharts line chart showing monthly score trends on the Analytics
// page (/parent/analytics). Analytics page was removed entirely.
// Not imported by: any page or component.
// ════════════════════════════════════════════════════════════════════════════
'use client';
import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function MonthlyTrendChart({ data }: { data: any[] }) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) return <div className="h-64 w-full mt-4 bg-gray-50 animate-pulse rounded-xl"></div>;
  if (!data || data.length === 0) return null;

  return (
    <div className="h-64 w-full mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
          <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#6B7280' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 12, fill: '#6B7280' }} axisLine={false} tickLine={false} />
          <Tooltip 
            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
          />
          <Line type="monotone" dataKey="score" stroke="#F97316" strokeWidth={3} dot={{ r: 4, fill: '#F97316' }} activeDot={{ r: 6 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
