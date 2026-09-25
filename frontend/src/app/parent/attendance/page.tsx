'use client';
// REMOVED: Attendance module has been removed from the parent portal.
// This page redirects to the dashboard. The original implementation is
// preserved below (commented out) for reference if attendance is reinstated.

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AttendancePage() {
  const router = useRouter();
  useEffect(() => { router.replace('/parent/dashboard'); }, [router]);
  return (
    <div className="flex items-center justify-center min-h-screen bg-[#F9FAFB]">
      <p className="text-gray-400 text-sm">Redirecting to dashboard…</p>
    </div>
  );
}

// ── ORIGINAL ATTENDANCE PAGE (preserved, not active) ──────────────────────
//
// import { useState, useEffect, useCallback, useMemo } from 'react';
// import TopBar from '@/components/TopBar';
// import { useDashboard } from '@/lib/DashboardContext';
// import { fetchAttendanceData, fetchLeaveRequests, submitLeaveRequest } from '@/lib/api';
//
// interface AttendanceDay {
//   date: string;
//   status: 'Present' | 'Absent' | 'HalfDay' | 'Holiday';
// }
//
// interface AttendanceOverview {
//   percentage: number;
//   present_days: number;
//   absent_days: number;
//   half_days: number;
//   total_school_days: number;
// }
//
// interface LeaveRequest {
//   leave_request_id: number;
//   from_date: string;
//   to_date: string;
//   reason: string;
//   parent_note?: string;
//   status: 'Pending' | 'Approved' | 'Rejected';
//   created_at: string;
// }
//
// ... (full heatmap, leave form, and leave history UI preserved in git history)
