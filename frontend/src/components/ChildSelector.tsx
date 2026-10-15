'use client';

import { useState, useEffect } from 'react';
import { fetchParentChildren } from '@/lib/api';

interface ChildSelectorProps {
  currentStudentId: number;
  onSelect: (id: number) => void;
  disabled?: boolean;
  /**
   * parentId = 0 means "not yet loaded from localStorage".
   * The component will show a placeholder and skip fetching until
   * a real (> 0) parentId is provided.
   *
   * Set via: localStorage.setItem('sss_parent_id', '<id>')  then refresh.
   * Discover seeded IDs via: GET /debug/seeded-parents
   */
  parentId?: number;
}

export default function ChildSelector({
  currentStudentId,
  onSelect,
  disabled,
  parentId = 0,
}: ChildSelectorProps) {
  const [children, setChildren] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Skip fetch when parentId is 0 (not yet set in localStorage).
    if (!parentId) {
      setLoading(false);
      return;
    }

    const loadChildren = async () => {
      setLoading(true);
      try {
        const data = await fetchParentChildren(parentId);
        console.log('[SSS] ChildSelector: parent', parentId, '→', data.length, 'children', data);
        setChildren(data);

        // Auto-select the first child when the current studentId is not in the list
        // (covers fresh load with studentId=0 and parent switch).
        if (data.length > 0 && !data.find((c: any) => c.student_id === currentStudentId)) {
          console.log('[SSS] ChildSelector: auto-selecting student_id', data[0].student_id);
          onSelect(data[0].student_id);
        }
      } catch (error) {
        console.error('[SSS] ChildSelector: failed to load children for parent', parentId, error);
      } finally {
        setLoading(false);
      }
    };

    loadChildren();
  // Re-run only when parentId changes (not on every onSelect reference churn).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parentId]);

  // ── Skeleton while loading ────────────────────────────────────────────────
  if (loading) {
    return <div className="h-14 w-48 bg-gray-200 animate-pulse rounded-full" />;
  }

  // ── Parent ID not set — show a hint for the developer ────────────────────
  if (!parentId) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-400 font-medium px-3 py-2 bg-gray-50 rounded-full border border-gray-200">
        <span>👤</span>
        <span>Set <code className="font-mono">sss_parent_id</code> in localStorage</span>
      </div>
    );
  }

  // ── No children returned for this parent ─────────────────────────────────
  if (children.length === 0) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-400 font-medium px-3 py-2 bg-gray-50 rounded-full border border-gray-200">
        <span>👤</span>
        <span>No children found (parent {parentId})</span>
      </div>
    );
  }

  // ── Normal dropdown ───────────────────────────────────────────────────────
  const activeChild = children.find(c => c.student_id === currentStudentId);

  return (
    <div className="flex flex-col w-full min-w-0">
      <label className="text-xs font-semibold text-gray-500 mb-1 ml-1">
        Select Child
      </label>

      <div className="flex items-center w-full min-w-0 bg-white border border-gray-200 rounded-full px-3 py-1.5 shadow-sm">
        <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold mr-2 shrink-0">
          {activeChild?.full_name?.charAt(0) || 'S'}
        </div>

        <div className="relative flex-1 min-w-0">
          {/* Visible student name */}
          <div className="flex items-center min-w-0 pr-6 text-gray-800 text-sm font-semibold">
            <span className="whitespace-nowrap overflow-hidden text-ellipsis">
              {activeChild?.full_name} • {activeChild?.class_name}{' '}
              {activeChild?.section}
            </span>
          </div>

          {/* Native select for choosing child */}
          <select
            value={currentStudentId}
            onChange={e => onSelect(Number(e.target.value))}
            disabled={disabled || loading}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          >
            {children.map(child => (
              <option key={child.student_id} value={child.student_id}>
                {child.full_name} • {child.class_name} {child.section}
              </option>
            ))}
          </select>

          {/* Dropdown arrow */}
          <span className="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none text-gray-700">
            ▼
          </span>
        </div>
      </div>
    </div>
  );
}
