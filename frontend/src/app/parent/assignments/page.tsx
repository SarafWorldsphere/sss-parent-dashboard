'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';

import { useTTS, translateCached } from '@/lib/multilingual';
import TopBar from '@/components/TopBar';

import {
  fetchAssignmentsHistory,
  fetchAssignmentAnalytics,
  submitAssignment,
} from '@/lib/api';

import { fetchDueDateAlert } from '@/lib/aiService';

import { useDashboard } from '@/lib/DashboardContext';
import AIInsightPanel from '@/components/AIInsightPanel';

type Assignment = {
  assignment_id: number;
  assignment_title: string;
  assignment_text?: string | null;
  subject: string;
  chapter_name?: string | null;
  teacher_name?: string | null;
  due_date: string;
  status: string;

  marks_obtained?: number | null;
  total_marks?: number | null;

  submitted_at?: string | null;
  submission_text?: string | null;

  teacher_remarks?: string | null;

  /* Uploaded file fields */
  file_path?: string | null;
  file_url?: string | null;
  file_name?: string | null;
  filename?: string | null;
  attachment?: string | null;

  /* Google Drive */
  drive_link?: string | null;
};

type Analytics = {
  total: number;
  submitted: number;
  pending: number;
  overdue: number;
  graded: number;
  completion_pct: number;
};

const STATUS_STYLES: Record<
  string,
  {
    bg: string;
    text: string;
    border: string;
  }
> = {
  Upcoming: {
    bg: '#F3E8FF',
    text: '#7E22CE',
    border: '#D8B4FE',
  },

  Ongoing: {
    bg: '#E0F2FE',
    text: '#0369A1',
    border: '#7DD3FC',
  },

  Submitted: {
    bg: '#DBEAFE',
    text: '#1D4ED8',
    border: '#93C5FD',
  },

  Graded: {
    bg: '#DCFCE7',
    text: '#15803D',
    border: '#86EFAC',
  },

  Overdue: {
    bg: '#FEE2E2',
    text: '#DC2626',
    border: '#FCA5A5',
  },
};

const TABS = [
  'All',
  'Upcoming',
  'Ongoing',
  'Submitted',
  'Graded',
  'Overdue',
] as const;

type Tab = (typeof TABS)[number];

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const ALLOWED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const formatDate = (date?: string | null) => {
  if (!date) return '–';

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return '–';
  }

  return parsed.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const getDaysTag = (
  dueDate: string,
  status: string
) => {
  if (
    !dueDate ||
    status === 'Graded' ||
    status === 'Submitted'
  ) {
    return null;
  }

  const due = new Date(dueDate).getTime();

  if (Number.isNaN(due)) {
    return null;
  }

  const days = Math.ceil(
    (due - Date.now()) / 86400000
  );

  if (days < 0) {
    return {
      text: `${Math.abs(days)}d overdue`,
      color: '#DC2626',
    };
  }

  if (days === 0) {
    return {
      text: 'Due today',
      color: '#EA580C',
    };
  }

  if (days === 1) {
    return {
      text: 'Tomorrow',
      color: '#EA580C',
    };
  }

  return {
    text: `${days} days left`,
    color: days <= 7 ? '#EA580C' : '#6B7280',
  };
};

const Badge = ({
  status,
}: {
  status: string;
}) => {
  const style =
    STATUS_STYLES[status] ?? {
      bg: '#F3F4F6',
      text: '#374151',
      border: '#D1D5DB',
    };

  return (
    <span
      style={{
        background: style.bg,
        color: style.text,
        border: `1px solid ${style.border}`,
      }}
      className="text-[11px] font-bold px-2.5 py-0.5 rounded-lg"
    >
      {status || 'Unknown'}
    </span>
  );
};

export default function AssignmentsPage() {
  const {
    studentId,
    setStudentId,
    parentId,
    language,
    setLanguage,
  } = useDashboard();

  const router = useRouter();

  const { speak } = useTTS();

  const [aiStatus, setAiStatus] = useState<
    'idle' | 'loading' | 'success' | 'error'
  >('idle');

  const [aiAnalysis, setAiAnalysis] =
    useState<string | null>(null);

  const [aiErrorType, setAiErrorType] =
    useState<string | null>(null);

  const [assignments, setAssignments] =
    useState<Assignment[]>([]);

  const [analytics, setAnalytics] =
    useState<Analytics>({
      total: 0,
      submitted: 0,
      pending: 0,
      overdue: 0,
      graded: 0,
      completion_pct: 0,
    });

  const [isLoading, setIsLoading] =
    useState(true);

  const [tab, setTab] =
    useState<Tab>('All');

  const [search, setSearch] =
    useState('');

  const [subjectFilter, setSubjectFilter] =
    useState('All');

  const [statusFilter, setStatusFilter] =
    useState('All');

  const [drawer, setDrawer] =
    useState<Assignment | null>(null);

  const [modal, setModal] =
    useState(false);

  const [target, setTarget] =
    useState<Assignment | null>(null);

  const [text, setText] =
    useState('');

  const [submitting, setSubmitting] =
    useState(false);

  const [toast, setToast] = useState<{
    message: string;
    success: boolean;
  } | null>(null);

  const [aiAlert, setAiAlert] =
    useState<any>(null);

  const [aiLoading, setAiLoading] =
    useState(false);

  const [attachment, setAttachment] =
    useState<File | null>(null);

  const [driveLink, setDriveLink] =
    useState('');

  const [attachmentError, setAttachmentError] =
    useState('');

  /*
   * ---------------------------------------------------------
   * FILE HELPERS
   * ---------------------------------------------------------
   */

  const getFileSource = (
    assignment: Assignment
  ): string | null => {
    return (
      assignment.file_path ??
      assignment.file_url ??
      assignment.attachment ??
      null
    );
  };

  const getFileName = (
    assignment: Assignment
  ): string | null => {
    /*
     * Prefer an actual filename returned by backend.
     */
    if (assignment.file_name) {
      return assignment.file_name;
    }

    if (assignment.filename) {
      return assignment.filename;
    }

    /*
     * Otherwise derive filename from path/url.
     */
    const source =
      getFileSource(assignment);

    if (!source) {
      return null;
    }

    try {
      const cleanSource =
        source.split('?')[0];

      const parts =
        cleanSource.split('/');

      const name =
        parts[parts.length - 1];

      if (!name) {
        return 'Attached file';
      }

      return decodeURIComponent(name);
    } catch {
      return 'Attached file';
    }
  };

  const getFileUrl = (
    assignment: Assignment
  ): string | null => {
    const source =
      getFileSource(assignment);

    if (!source) {
      return null;
    }

    if (
      source.startsWith('http://') ||
      source.startsWith('https://')
    ) {
      return source;
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_API_URL ??
      'http://localhost:8000';

    return `${baseUrl.replace(
      /\/$/,
      ''
    )}/${source.replace(
      /^\//,
      ''
    )}`;
  };

  /*
   * Normalize assignment returned by API.
   *
   * This makes frontend compatible with:
   * file_path
   * file_url
   * file_name
   * filename
   * attachment
   */
  const normalizeAssignment = (
    assignment: any
  ): Assignment => {
    return {
      ...assignment,

      assignment_id:
        Number(
          assignment.assignment_id
        ),

      file_path:
        assignment.file_path ??
        assignment.file_url ??
        assignment.attachment ??
        null,

      file_url:
        assignment.file_url ??
        assignment.file_path ??
        null,

      file_name:
        assignment.file_name ??
        assignment.filename ??
        null,

      filename:
        assignment.filename ??
        assignment.file_name ??
        null,

      drive_link:
        assignment.drive_link ??
        null,
    };
  };

  /*
   * ---------------------------------------------------------
   * TOAST
   * ---------------------------------------------------------
   */

  const notify = (
    message: string,
    success = true
  ) => {
    setToast({
      message,
      success,
    });

    setTimeout(() => {
      setToast(null);
    }, 3000);
  };

  /*
   * ---------------------------------------------------------
   * LOAD ASSIGNMENTS
   * ---------------------------------------------------------
   */

  const load = async () => {
    if (!studentId) {
      setAssignments([]);
      setAnalytics({
        total: 0,
        submitted: 0,
        pending: 0,
        overdue: 0,
        graded: 0,
        completion_pct: 0,
      });

      setIsLoading(false);

      return;
    }

    setIsLoading(true);

    try {
      const [
        assignmentResponse,
        analyticsResponse,
      ] = await Promise.all([
        fetchAssignmentsHistory(
          studentId
        ),
        fetchAssignmentAnalytics(
          studentId
        ),
      ]);

      const normalizedAssignments =
        Array.isArray(
          assignmentResponse
        )
          ? assignmentResponse.map(
              normalizeAssignment
            )
          : [];

      setAssignments(
        normalizedAssignments
      );

      setAnalytics(
        analyticsResponse ?? {
          total: 0,
          submitted: 0,
          pending: 0,
          overdue: 0,
          graded: 0,
          completion_pct: 0,
        }
      );
    } catch (error) {
      console.error(
        'Assignment load error:',
        error
      );

      setAssignments([]);

      notify(
        'Unable to load assignments.',
        false
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();

    setDrawer(null);
    setTab('All');
    setStatusFilter('All');
    setSubjectFilter('All');
    setSearch('');
  }, [studentId]);

  /*
   * ---------------------------------------------------------
   * SUBJECTS
   * ---------------------------------------------------------
   */

  const subjects = useMemo(() => {
    const values =
      assignments
        .map(
          (assignment) =>
            assignment.subject
        )
        .filter(Boolean);

    return [
      'All',
      ...Array.from(
        new Set(values)
      ),
    ];
  }, [assignments]);

  /*
   * ---------------------------------------------------------
   * FILTERED ROWS
   * ---------------------------------------------------------
   */

  const rows = useMemo(() => {
    return assignments.filter(
      (assignment) => {
        if (
          statusFilter !== 'All' &&
          assignment.status !==
            statusFilter
        ) {
          return false;
        }

        if (
          subjectFilter !== 'All' &&
          assignment.subject !==
            subjectFilter
        ) {
          return false;
        }

        if (search.trim()) {
          const query =
            search
              .trim()
              .toLowerCase();

          const title =
            (
              assignment.assignment_title ??
              ''
            ).toLowerCase();

          const subject =
            (
              assignment.subject ??
              ''
            ).toLowerCase();

          const chapter =
            (
              assignment.chapter_name ??
              ''
            ).toLowerCase();

          if (
            !title.includes(query) &&
            !subject.includes(query) &&
            !chapter.includes(query)
          ) {
            return false;
          }
        }

        return true;
      }
    );
  }, [
    assignments,
    subjectFilter,
    statusFilter,
    search,
  ]);

  /*
   * ---------------------------------------------------------
   * TAB COUNTS
   * ---------------------------------------------------------
   */

  const counts = useMemo(() => {
    return TABS.reduce(
      (result, currentTab) => {
        result[currentTab] =
          currentTab === 'All'
            ? assignments.length
            : assignments.filter(
                (assignment) =>
                  assignment.status ===
                  currentTab
              ).length;

        return result;
      },
      {} as Record<Tab, number>
    );
  }, [assignments]);

  /*
   * ---------------------------------------------------------
   * AI OVERALL INSIGHT
   * ---------------------------------------------------------
   */

  const generateAssignmentInsight =
    async () => {
      try {
        setAiStatus('loading');
        setAiErrorType(null);

        const total =
          analytics.total;

        const submitted =
          analytics.submitted +
          analytics.graded;

        const pending =
          analytics.pending;

        const overdue =
          analytics.overdue;

        const completion =
          analytics.completion_pct;

        let insight = '';

        if (total === 0) {
          insight =
            'There are currently no assignments available for this student.';
        } else if (overdue > 0) {
          insight = `The student has ${overdue} overdue assignment${
            overdue > 1 ? 's' : ''
          }. Please review the pending work and help the student complete it as soon as possible.`;
        } else if (completion >= 80) {
          insight = `The student is performing well in assignment completion. ${submitted} out of ${total} assignments have been completed, with an overall completion rate of ${completion}%.`;
        } else {
          insight = `The student has completed ${submitted} out of ${total} assignments. There are ${pending} pending assignment${
            pending !== 1
              ? 's'
              : ''
          }. Regular follow-up can help improve assignment completion.`;
        }

        const translated =
          await translateCached(
            insight,
            language
          );

        setAiAnalysis(
          translated
        );

        setAiStatus('success');
      } catch (error) {
        console.error(
          'Assignment insight error:',
          error
        );

        setAiStatus('error');
        setAiErrorType(
          'ai-unavailable'
        );
      }
    };

  /*
   * ---------------------------------------------------------
   * FILE VALIDATION
   * ---------------------------------------------------------
   */

  const handleFileChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file =
      event.target.files?.[0];

    if (!file) {
      return;
    }

    setAttachmentError('');

    if (
      !ALLOWED_TYPES.includes(
        file.type
      )
    ) {
      setAttachment(null);

      setAttachmentError(
        'Only PDF, DOC, DOCX, JPG and PNG files are allowed.'
      );

      return;
    }

    if (
      file.size > MAX_FILE_SIZE
    ) {
      setAttachment(null);

      setAttachmentError(
        'File size should not exceed 10 MB.'
      );

      return;
    }

    setAttachment(file);
    setDriveLink('');
  };

  /*
   * ---------------------------------------------------------
   * GOOGLE DRIVE VALIDATION
   * ---------------------------------------------------------
   */

  const validateDriveLink = (
    url: string
  ) => {
    return /^https:\/\/(drive\.google\.com|docs\.google\.com)\//.test(
      url
    );
  };

  /*
   * ---------------------------------------------------------
   * SUBMIT ASSIGNMENT
   * ---------------------------------------------------------
   */

  const doSubmit = async () => {
  if (!text.trim() || !target) {
    return;
  }

  if (!target.assignment_id) {
    notify(
      'Invalid assignment ID.',
      false
    );
    return;
  }

  if (!studentId) {
    notify(
      'Student ID not found.',
      false
    );
    return;
  }

  if (attachment && driveLink) {
    notify(
      'Please upload a file OR provide a Drive link, not both.',
      false
    );
    return;
  }

  if (
    driveLink &&
    !validateDriveLink(driveLink)
  ) {
    notify(
      'Please enter a valid Google Drive link.',
      false
    );
    return;
  }

  setSubmitting(true);

  try {
    // =========================================================
    // 1. CREATE FORMDATA
    // =========================================================

    const formData = new FormData();

    formData.append(
      'assignment_id',
      String(target.assignment_id)
    );

    formData.append(
      'student_id',
      String(studentId)
    );

    formData.append(
      'submission_text',
      text.trim()
    );

    // =========================================================
    // 2. ADD FILE
    // =========================================================

    if (attachment) {
      formData.append(
        'file',
        attachment
      );
    }

    // =========================================================
    // 3. ADD DRIVE LINK
    // =========================================================

    if (driveLink?.trim()) {
      formData.append(
        'drive_link',
        driveLink.trim()
      );
    }

    // =========================================================
    // 4. DEBUG FORMDATA
    // =========================================================

    console.log(
      '======================================'
    );

    console.log(
      'SUBMISSION FORMDATA'
    );

    console.log(
      '======================================'
    );

    for (
      const [key, value]
      of formData.entries()
    ) {
      if (value instanceof File) {
        console.log(
          `${key}: FILE`,
          {
            name: value.name,
            type: value.type,
            size: value.size
          }
        );
      } else {
        console.log(
          `${key}:`,
          value
        );
      }
    }

    console.log(
      '======================================'
    );

    // =========================================================
    // 5. SUBMIT TO BACKEND
    // =========================================================

    const response =
      await submitAssignment(
        formData
      );

    console.log(
      '======================================'
    );

    console.log(
      'Submission API response:',
      response
    );

    console.log(
      'Returned file_path:',
      response?.file_path
    );

    console.log(
      'Returned file_url:',
      response?.file_url
    );

    console.log(
      'Returned file_name:',
      response?.file_name
    );

    console.log(
      'Returned filename:',
      response?.filename
    );

    console.log(
      'Returned attachment:',
      response?.attachment
    );

    console.log(
      'Returned drive_link:',
      response?.drive_link
    );

    console.log(
      '======================================'
    );

    // =========================================================
    // 6. NORMALIZE RESPONSE
    // =========================================================

    const updatedAssignment =
      normalizeAssignment({
        ...target,
        ...response,

        assignment_id:
          response?.assignment_id ??
          target.assignment_id,

        submission_text:
          response?.submission_text ??
          text.trim(),

        submitted_at:
          response?.submitted_at ??
          new Date().toISOString(),

        status:
          response?.status ??
          'Submitted',

        file_path:
          response?.file_path ??
          response?.file_url ??
          response?.attachment ??
          target.file_path ??
          null,

        file_url:
          response?.file_url ??
          response?.file_path ??
          target.file_url ??
          null,

        file_name:
          response?.file_name ??
          response?.filename ??
          target.file_name ??
          target.filename ??
          null,

        filename:
          response?.filename ??
          response?.file_name ??
          target.filename ??
          target.file_name ??
          null,

        attachment:
          response?.attachment ??
          response?.file_path ??
          response?.file_url ??
          target.attachment ??
          null,

        drive_link:
          response?.drive_link ??
          (
            response?.file_path?.startsWith?.(
              'https://drive.google.com/'
            )
              ? response.file_path
              : null
          ) ??
          target.drive_link ??
          null
      });

    console.log(
      'Normalized assignment after submission:',
      updatedAssignment
    );

    console.log(
      'Uploaded filename:',
      getFileName(
        updatedAssignment
      )
    );

    // =========================================================
    // 7. UPDATE ASSIGNMENTS TABLE
    // =========================================================

    setAssignments(
      (previous) =>
        previous.map(
          (assignment) =>
            assignment.assignment_id ===
            updatedAssignment.assignment_id
              ? updatedAssignment
              : assignment
        )
    );

    // =========================================================
    // 8. UPDATE DRAWER
    // =========================================================

    setDrawer(
      (current) =>
        current?.assignment_id ===
        updatedAssignment.assignment_id
          ? updatedAssignment
          : current
    );

    // =========================================================
    // 9. RELOAD LATEST DATA
    // =========================================================

    await load();

    // =========================================================
    // 10. CLOSE / RESET MODAL
    // =========================================================

    setModal(false);

    setText('');

    setAttachment(null);

    setDriveLink('');

    setAttachmentError('');

    setTarget(null);

    // =========================================================
    // 11. SUCCESS MESSAGE
    // =========================================================

    notify(
      'Submitted successfully!'
    );

  } catch (error: any) {

    // =========================================================
    // ERROR LOGGING
    // =========================================================

    console.error(
      '======================================'
    );

    console.error(
      'SUBMISSION FAILED'
    );

    console.error(
      '======================================'
    );

    console.error(
      'Status:',
      error?.response?.status
    );

    console.error(
      'Full response:',
      error?.response?.data
    );

    const detail =
      error?.response?.data?.detail;

    console.error(
      '422 DETAIL:',
      JSON.stringify(
        detail,
        null,
        2
      )
    );

    // =========================================================
    // SAFE ERROR MESSAGE
    // =========================================================

    let message =
      'Submission failed.';

    if (
      typeof detail ===
      'string'
    ) {
      message = detail;

    } else if (
      Array.isArray(detail)
    ) {
      message = detail
        .map(
          (item: any) => {

            if (
              typeof item ===
              'string'
            ) {
              return item;
            }

            const location =
              Array.isArray(
                item?.loc
              )
                ? item.loc.join(
                    ' → '
                  )
                : '';

            const msg =
              item?.msg ??
              'Invalid submission data.';

            return location
              ? `${location}: ${msg}`
              : msg;
          }
        )
        .join('\n');
    }

    console.error(
      'User error message:',
      message
    );

    notify(
      message,
      false
    );

  } finally {

    setSubmitting(false);
  }
};
  /*
   * ---------------------------------------------------------
   * OPEN SUBMISSION MODAL
   * ---------------------------------------------------------
   */

  const openModal = (
    assignment?: Assignment
  ) => {
    setTarget(
      assignment ?? null
    );

    setText(
      assignment?.submission_text ?? ''
    );

    setAttachment(null);

    setDriveLink(
      assignment?.drive_link ?? ''
    );

    setAttachmentError('');

    setModal(true);
  };


  /*
   * ---------------------------------------------------------
   * AI DUE DATE ALERT
   * ---------------------------------------------------------
   */

  const handleDueDateAlert = async (
    assignment: Assignment
  ) => {
    try {
      setAiLoading(true);

      setAiAlert(null);

      const response =
        await fetchDueDateAlert({
          assignment_title:
            assignment.assignment_title,

          subject:
            assignment.subject,

          due_date:
            assignment.due_date,

          description:
            assignment.assignment_text ?? '',

          student_name:
            String(studentId ?? ''),
        });

      setAiAlert(response);

    } catch (error) {

      console.error(
        'AI reminder error:',
        error
      );

      notify(
        'Unable to generate AI reminder.',
        false
      );

    } finally {

      setAiLoading(false);
    }
  };

  // Automatically generate the AI reminder whenever a parent opens
  // an assignment in the Overview drawer. The parent no longer needs
  // to click the AI Reminder button manually.
  useEffect(() => {
    if (!drawer) {
      setAiAlert(null);
      return;
    }

    handleDueDateAlert(drawer);
  }, [drawer?.assignment_id]);

  /*
   * ---------------------------------------------------------
   * METRIC CARDS
   * ---------------------------------------------------------
   */

  const cards = [
    {
      label: 'Total',
      value: analytics.total,
      note: 'All assignments',
      icon: '📋',
      color: '#6366F1',
    },
    {
      label: 'Ongoing',
      value: analytics.pending,
      note: 'Pending assignments',
      icon: '⚡',
      color: '#0369A1',
    },
    {
      label: 'Submitted',
      value:
        analytics.submitted +
        analytics.graded,
      note: `${analytics.completion_pct}% done`,
      icon: '✅',
      color: '#15803D',
    },
    {
      label: 'Overdue',
      value: analytics.overdue,
      note: 'Need attention',
      icon: '🚨',
      color: '#DC2626',
    },
    {
      label: 'Graded',
      value: analytics.graded,
      note: 'Marks received',
      icon: '🎯',
      color: '#D97706',
    },
  ];

  return (
    <div className="min-h-full flex flex-col font-sans">
      <TopBar
        studentId={studentId}
        setStudentId={setStudentId}
        parentId={parentId}
        language={language}
        setLanguage={setLanguage}
        isLoading={isLoading}
      />

      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-xl shadow-lg text-sm font-semibold text-white ${
            toast.success
              ? 'bg-green-600'
              : 'bg-red-600'
          }`}
        >
          {toast.message}
        </div>
      )}

      <div className="flex-1 p-4 md:p-5">
        <div className="max-w-7xl mx-auto space-y-4">

          {/* HEADER */}
          <div className="flex justify-between items-center">
            <div>
              <h1
                className="text-2xl font-black"
                style={{
                  color: '#F8FAFC',
                }}
              >
                Assignments
              </h1>

              <p
                className="text-sm mt-0.5"
                style={{
                  color: '#94A3B8',
                }}
              >
                Track, submit, and monitor all assignments.
              </p>
            </div>

            <button
              onClick={() =>
                openModal()
              }
              className="text-white text-sm font-bold px-4 py-2.5 rounded-xl shadow-sm hover:opacity-90 transition-opacity flex items-center gap-2"
              style={{
                background: '#EA580C',
              }}
            >
              + New Submission
            </button>
          </div>

          {isLoading ? (
            <div className="flex justify-center items-center h-60">
              <div
                className="animate-spin rounded-full h-10 w-10 border-b-2"
                style={{
                  borderColor: '#EA580C',
                }}
              />
            </div>
          ) : (
            <>
              {/* AI INSIGHT */}
              <div
                className="bg-white rounded-2xl border shadow-sm overflow-hidden"
                style={{
                  borderColor: '#FED7AA',
                }}
              >
                <div
                  className="px-5 py-4 flex items-center gap-3"
                  style={{
                    background: '#FFF7ED',
                  }}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                    style={{
                      background: '#FFEDD5',
                    }}
                  >
                    ✨
                  </div>

                  <div>
                    <h2
                      className="text-base font-black"
                      style={{
                        color: '#111827',
                      }}
                    >
                      Overall Assignment AI Insight
                    </h2>

                    <p
                      className="text-xs mt-0.5"
                      style={{
                        color: '#9A3412',
                      }}
                    >
                      Summary based on assignment progress
                    </p>
                  </div>
                </div>

                <div className="px-5 py-2">
                  <AIInsightPanel
                    status={aiStatus}
                    analysis={aiAnalysis}
                    errorType={aiErrorType}
                    onGenerate={
                      generateAssignmentInsight
                    }
                    buttonLabel="Generate Overall Assignment Insight"
                    insightLabel="Overall Assignment AI Insight"
                  />
                </div>
              </div>

              {/* CARDS */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {cards.map((card) => (
                  <div
                    key={card.label}
                    className="bg-slate-800 rounded-xl border p-4"
                    style={{
                      borderColor:
                        'rgba(255,255,255,0.1)',
                    }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-base"
                        style={{
                          background:
                            `${card.color}18`,
                        }}
                      >
                        {card.icon}
                      </div>

                      <span
                        className="text-xs font-semibold"
                        style={{
                          color: '#94A3B8',
                        }}
                      >
                        {card.label}
                      </span>
                    </div>

                    <p
                      className="text-2xl font-black"
                      style={{
                        color: '#F8FAFC',
                      }}
                    >
                      {card.value}
                    </p>

                    <p
                      className="text-[11px] mt-0.5"
                      style={{
                        color: '#64748B',
                      }}
                    >
                      {card.note}
                    </p>
                  </div>
                ))}
              </div>

              {/* FILTERS */}
              <div
                className="bg-slate-800 rounded-xl border p-3 flex flex-wrap gap-2.5 items-center"
                style={{
                  borderColor:
                    'rgba(255,255,255,0.1)',
                }}
              >
                <select
                  value={subjectFilter}
                  onChange={(event) =>
                    setSubjectFilter(
                      event.target.value
                    )
                  }
                  className="text-sm font-medium rounded-lg px-3 py-2 border outline-none cursor-pointer"
                  style={{
                    color: '#F8FAFC',
                    borderColor:
                      'rgba(255,255,255,0.1)',
                    background: '#334155',
                  }}
                >
                  {subjects.map(
                    (subject) => (
                      <option
                        key={subject}
                        value={subject}
                        style={{
                          background:
                            '#334155',
                          color:
                            '#F8FAFC',
                        }}
                      >
                        {subject === 'All'
                          ? 'All Subjects'
                          : subject}
                      </option>
                    )
                  )}
                </select>

                <select
                  value={statusFilter}
                  onChange={(event) => {
                    const value =
                      event.target
                        .value as Tab;

                    setStatusFilter(
                      value
                    );

                    setTab(value);
                  }}
                  className="text-sm font-medium rounded-lg px-3 py-2 border outline-none cursor-pointer"
                  style={{
                    color: '#F8FAFC',
                    borderColor:
                      'rgba(255,255,255,0.1)',
                    background: '#334155',
                  }}
                >
                  {TABS.map(
                    (status) => (
                      <option
                        key={status}
                        value={status}
                        style={{
                          background:
                            '#334155',
                          color:
                            '#F8FAFC',
                        }}
                      >
                        {status === 'All'
                          ? 'All Status'
                          : status}
                      </option>
                    )
                  )}
                </select>

                <div className="flex-1 relative min-w-[200px]">
                  <span className="absolute left-3 top-2.5 text-base">
                    🔍
                  </span>

                  <input
                    value={search}
                    onChange={(event) =>
                      setSearch(
                        event.target.value
                      )
                    }
                    placeholder="Search by title, subject, chapter..."
                    className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg outline-none placeholder:text-slate-400"
                    style={{
                      color: '#F8FAFC',
                      borderColor:
                        'rgba(255,255,255,0.1)',
                      background: '#334155',
                    }}
                  />
                </div>

                {(search ||
                  subjectFilter !==
                    'All' ||
                  statusFilter !==
                    'All') && (
                  <button
                    onClick={() => {
                      setSearch('');
                      setSubjectFilter(
                        'All'
                      );
                      setStatusFilter(
                        'All'
                      );
                      setTab('All');
                    }}
                    className="text-xs font-semibold"
                    style={{
                      color: '#EA580C',
                    }}
                  >
                    Clear ×
                  </button>
                )}
              </div>

              {/* TABS */}
              <div
                className="flex border-b overflow-x-auto"
                style={{
                  borderColor:
                    'rgba(255,255,255,0.1)',
                }}
              >
                {TABS.map((item) => (
                  <button
                    key={item}
                    onClick={() => {
                      setTab(item);
                      setStatusFilter(
                        item
                      );
                    }}
                    className="px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 -mb-px transition-colors flex items-center gap-1.5"
                    style={{
                      borderColor:
                        tab === item
                          ? '#EA580C'
                          : 'transparent',

                      color:
                        tab === item
                          ? '#EA580C'
                          : '#94A3B8',
                    }}
                  >
                    {item}

                    <span
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{
                        background:
                          tab === item
                            ? 'rgba(234,88,12,0.15)'
                            : 'rgba(255,255,255,0.08)',

                        color:
                          tab === item
                            ? '#EA580C'
                            : '#64748B',
                      }}
                    >
                      {counts[item]}
                    </span>
                  </button>
                ))}
              </div>

              {/* TABLE */}
              <div
                className="bg-slate-900 rounded-xl border overflow-hidden"
                style={{
                  borderColor:
                    'rgba(255,255,255,0.1)',
                }}
              >
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead
                      style={{
                        background:
                          '#1e293b',
                        borderBottom:
                          '1px solid rgba(255,255,255,0.1)',
                      }}
                    >
                      <tr>
                        {[
                          'Assignment',
                          'Subject',
                          'Due Date',
                          'Submitted On',
                          'Marks',
                          'Status',
                          'Action',
                        ].map(
                          (heading) => (
                            <th
                              key={heading}
                              className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider"
                              style={{
                                color:
                                  '#94A3B8',
                              }}
                            >
                              {heading}
                            </th>
                          )
                        )}
                      </tr>
                    </thead>

                    <tbody>
                      {rows.length === 0 ? (
                        <tr>
                          <td
                            colSpan={7}
                            className="text-center py-14"
                          >
                            <div className="text-3xl mb-2">
                              📭
                            </div>

                            <p
                              className="font-semibold"
                              style={{
                                color:
                                  '#CBD5E1',
                              }}
                            >
                              No assignments found
                            </p>

                            <p
                              className="text-xs mt-1"
                              style={{
                                color:
                                  '#64748B',
                              }}
                            >
                              Try adjusting your filters
                            </p>
                          </td>
                        </tr>
                      ) : (
                        rows.map(
                          (
                            assignment,
                            index
                          ) => {
                            const days =
                              getDaysTag(
                                assignment.due_date,
                                assignment.status
                              );

                            return (
                              <tr
                                key={
                                  assignment.assignment_id ??
                                  index
                                }
                                onClick={() =>
                                  setDrawer(
                                    assignment
                                  )
                                }
                                className="transition-colors border-b cursor-pointer"
                                style={{
                                  borderColor:
                                    'rgba(255,255,255,0.05)',
                                }}
                                onMouseEnter={(
                                  event
                                ) => {
                                  event.currentTarget.style.background =
                                    'rgba(234,88,12,0.1)';
                                }}
                                onMouseLeave={(
                                  event
                                ) => {
                                  event.currentTarget.style.background =
                                    '';
                                }}
                              >
                                <td className="px-4 py-3">
                                  <p
                                    className="font-bold"
                                    style={{
                                      color:
                                        '#F8FAFC',
                                    }}
                                  >
                                    {
                                      assignment.assignment_title
                                    }
                                  </p>

                                  {assignment.chapter_name && (
                                    <p
                                      className="text-xs mt-0.5"
                                      style={{
                                        color:
                                          '#64748B',
                                      }}
                                    >
                                      {
                                        assignment.chapter_name
                                      }
                                    </p>
                                  )}
                                </td>

                                <td
                                  className="px-4 py-3 font-medium whitespace-nowrap"
                                  style={{
                                    color:
                                      '#CBD5E1',
                                  }}
                                >
                                  {
                                    assignment.subject
                                  }
                                </td>

                                <td className="px-4 py-3">
                                  <p
                                    className="whitespace-nowrap"
                                    style={{
                                      color:
                                        '#CBD5E1',
                                    }}
                                  >
                                    {formatDate(
                                      assignment.due_date
                                    )}
                                  </p>

                                  {days && (
                                    <p
                                      className="text-[11px] font-semibold mt-0.5"
                                      style={{
                                        color:
                                          days.color,
                                      }}
                                    >
                                      {
                                        days.text
                                      }
                                    </p>
                                  )}
                                </td>

                                <td
                                  className="px-4 py-3 whitespace-nowrap"
                                  style={{
                                    color:
                                      '#94A3B8',
                                  }}
                                >
                                  {assignment.submitted_at
                                    ? formatDate(
                                        assignment.submitted_at
                                      )
                                    : '–'}
                                </td>

                                <td
                                  className="px-4 py-3 font-bold whitespace-nowrap"
                                  style={{
                                    color:
                                      '#F8FAFC',
                                  }}
                                >
                                  {assignment.marks_obtained !=
                                  null ? (
                                    <>
                                      {
                                        assignment.marks_obtained
                                      }

                                      <span
                                        style={{
                                          color:
                                            '#64748B',
                                          fontWeight:
                                            400,
                                        }}
                                      >
                                        /
                                        {assignment.total_marks ??
                                          '–'}
                                      </span>
                                    </>
                                  ) : (
                                    '–'
                                  )}
                                </td>

                                <td className="px-4 py-3">
                                  <Badge
                                    status={
                                      assignment.status
                                    }
                                  />
                                </td>

                                <td
                                  className="px-4 py-3"
                                  onClick={(event) =>
                                    event.stopPropagation()
                                  }
                                >
                                  <button
                                    onClick={() =>
                                      setDrawer(
                                        assignment
                                      )
                                    }
                                    className="text-xs font-bold px-3 py-1.5 rounded-lg border"
                                    style={{
                                      color:
                                        '#E2E8F0',
                                      borderColor:
                                        'rgba(255,255,255,0.1)',
                                    }}
                                  >
                                    View
                                  </button>
                                </td>
                              </tr>
                            );
                          }
                        )
                      )}
                    </tbody>
                  </table>
                </div>

                <div
                  className="px-4 py-2.5 border-t text-xs"
                  style={{
                    borderColor:
                      'rgba(255,255,255,0.05)',
                    color:
                      '#64748B',
                  }}
                >
                  Showing {rows.length} of{' '}
                  {analytics.total} assignments
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* =====================================================
          ASSIGNMENT DETAILS DRAWER
          ===================================================== */}

      {drawer && (
        <div
          className="fixed inset-0 z-[100] flex items-start justify-center p-4 pt-20 md:pt-24"
          onClick={() =>
            setDrawer(null)
          }
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

          <div
            className="relative bg-slate-800 border border-white/10 rounded-2xl shadow-2xl flex flex-col w-full overflow-hidden z-[110]"
            style={{
              maxWidth: '820px',
              maxHeight: '85vh',
            }}
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            {/* DRAWER HEADER */}
            <div
              className="shrink-0 px-6 pt-7 pb-6 border-b"
              style={{
                background:
                  'rgba(255,255,255,0.05)',
                borderColor:
                  'rgba(255,255,255,0.1)',
              }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h2
                    className="text-3xl font-black break-words leading-tight"
                    style={{
                      color:
                        '#F8FAFC',
                    }}
                  >
                    {
                      drawer.assignment_title
                    }
                  </h2>

                  {drawer.chapter_name && (
                    <p
                      className="text-sm mt-1.5 flex items-center gap-1.5"
                      style={{
                        color:
                          '#94A3B8',
                      }}
                    >
                      📖
                      <span>
                        {
                          drawer.chapter_name
                        }
                      </span>
                    </p>
                  )}

                  <div className="flex flex-wrap gap-2.5 mt-4">
                    <span
                      className="text-xs font-bold px-3 py-1 rounded-lg"
                      style={{
                        background:
                          'rgba(234,88,12,0.15)',
                        color:
                          '#EA580C',
                      }}
                    >
                      {drawer.subject}
                    </span>

                    <Badge
                      status={
                        drawer.status
                      }
                    />
                  </div>
                </div>

                <button
                  onClick={() =>
                    setDrawer(null)
                  }
                  className="w-10 h-10 rounded-full flex items-center justify-center text-2xl hover:bg-white/10"
                  style={{
                    color:
                      '#94A3B8',
                  }}
                >
                  ×
                </button>
              </div>
            </div>

            {/* DRAWER BODY */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-6 space-y-5">

                {/* DESCRIPTION */}
                <div>
                  <p
                    className="text-xs font-bold uppercase tracking-wider mb-2"
                    style={{
                      color:
                        '#64748B',
                    }}
                  >
                    Description
                  </p>

                  <div
                    className="rounded-xl p-4"
                    style={{
                      background:
                        'rgba(255,255,255,0.05)',
                      border:
                        '1px solid rgba(255,255,255,0.1)',
                    }}
                  >
                    <p
                      className="text-sm leading-relaxed"
                      style={{
                        color:
                          drawer.assignment_text
                            ? '#E2E8F0'
                            : '#64748B',
                        fontStyle:
                          drawer.assignment_text
                            ? 'normal'
                            : 'italic',
                      }}
                    >
                      {drawer.assignment_text ??
                        'No description provided.'}
                    </p>
                  </div>
                </div>

                {/* INFORMATION */}
                <div>
                  <p
                    className="text-xs font-bold uppercase tracking-wider mb-2.5"
                    style={{
                      color:
                        '#64748B',
                    }}
                  >
                    Assignment Information
                  </p>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {[
                      {
                        icon: '👤',
                        label: 'Teacher',
                        value:
                          drawer.teacher_name ??
                          '–',
                      },
                      {
                        icon: '📅',
                        label: 'Due Date',
                        value:
                          formatDate(
                            drawer.due_date
                          ),
                      },
                      {
                        icon: '📤',
                        label: 'Submitted On',
                        value:
                          drawer.submitted_at
                            ? formatDate(
                                drawer.submitted_at
                              )
                            : 'Not submitted',
                      },
                      {
                        icon: '🎯',
                        label: 'Marks Obtained',
                        value:
                          drawer.marks_obtained !=
                          null
                            ? String(
                                drawer.marks_obtained
                              )
                            : '–',
                      },
                      {
                        icon: '📊',
                        label: 'Total Marks',
                        value:
                          drawer.total_marks !=
                          null
                            ? String(
                                drawer.total_marks
                              )
                            : '–',
                      },
                      {
                        icon: '📋',
                        label: 'Chapter',
                        value:
                          drawer.chapter_name ??
                          '–',
                      },
                    ].map(
                      (item) => (
                        <div
                          key={item.label}
                          className="rounded-xl p-3.5"
                          style={{
                            background:
                              'rgba(255,255,255,0.05)',
                            border:
                              '1px solid rgba(255,255,255,0.1)',
                          }}
                        >
                          <p
                            className="text-[10px] font-bold uppercase tracking-wider mb-1"
                            style={{
                              color:
                                '#64748B',
                            }}
                          >
                            {item.icon}{' '}
                            {item.label}
                          </p>

                          <p
                            className="text-sm font-bold"
                            style={{
                              color:
                                '#F8FAFC',
                            }}
                          >
                            {item.value}
                          </p>
                        </div>
                      )
                    )}
                  </div>
                </div>

                {/* STATUS */}
                {(() => {
                  const days =
                    getDaysTag(
                      drawer.due_date,
                      drawer.status
                    );

                  let message =
                    '';

                  let background =
                    '';

                  let border =
                    '';

                  let color =
                    '';

                  let icon =
                    '';

                  if (
                    drawer.status ===
                    'Overdue'
                  ) {
                    background =
                      '#FEF2F2';
                    border =
                      '#FECACA';
                    color =
                      '#DC2626';
                    icon = '⚠️';

                    message =
                      days
                        ? `Assignment overdue by ${days.text.replace(
                            'd overdue',
                            ' days'
                          )}.`
                        : 'Assignment is overdue.';
                  } else if (
                    drawer.status ===
                    'Ongoing'
                  ) {
                    background =
                      '#EFF6FF';
                    border =
                      '#BFDBFE';
                    color =
                      '#1D4ED8';
                    icon = '⏰';

                    message =
                      days
                        ? `Due in ${days.text}.`
                        : 'Assignment is active.';
                  } else if (
                    drawer.status ===
                    'Upcoming'
                  ) {
                    background =
                      '#F3E8FF';
                    border =
                      '#D8B4FE';
                    color =
                      '#7E22CE';
                    icon = '📌';

                    message =
                      days
                        ? `Upcoming — ${days.text}.`
                        : 'Assignment is upcoming.';
                  } else if (
                    drawer.status ===
                    'Submitted'
                  ) {
                    background =
                      '#EFF6FF';
                    border =
                      '#BFDBFE';
                    color =
                      '#1D4ED8';
                    icon = '📩';

                    message =
                      'Submission sent. Waiting for evaluation.';
                  } else if (
                    drawer.status ===
                    'Graded'
                  ) {
                    background =
                      '#F0FDF4';
                    border =
                      '#BBF7D0';
                    color =
                      '#15803D';
                    icon = '✅';

                    message =
                      'Assignment evaluated successfully.';
                  }

                  if (!message) {
                    return null;
                  }

                  return (
                    <div
                      className="rounded-xl p-4 flex items-center gap-3"
                      style={{
                        background,
                        border: `1px solid ${border}`,
                      }}
                    >
                      <span className="text-xl">
                        {icon}
                      </span>

                      <p
                        className="text-sm font-semibold"
                        style={{
                          color,
                        }}
                      >
                        {message}
                      </p>
                    </div>
                  );
                })()}

                {/* AI REMINDER */}
                {aiAlert && (
                  <div
                    className="rounded-xl p-4"
                    style={{
                      background:
                        '#F0FDF4',
                      border:
                        '1px solid #BBF7D0',
                    }}
                  >
                    <p className="font-bold text-sm mb-2">
                      🤖{' '}
                      {
                        aiAlert.alert_title
                      }
                    </p>

                    <p className="text-sm leading-relaxed">
                      {
                        aiAlert.notification_message
                      }
                    </p>

                    <p className="text-xs mt-3">
                      <b>
                        Parent Action:
                      </b>{' '}
                      {
                        aiAlert.suggested_parent_action
                      }
                    </p>
                  </div>
                )}

                {/* TEACHER REMARKS */}
                <div>
                  <p
                    className="text-xs font-bold uppercase tracking-wider mb-2"
                    style={{
                      color:
                        '#9CA3AF',
                    }}
                  >
                    Teacher Remarks
                  </p>

                  {drawer.teacher_remarks ? (
                    <div
                      className="rounded-xl p-4"
                      style={{
                        background:
                          '#EFF6FF',
                        border:
                          '1px solid #BFDBFE',
                      }}
                    >
                      <p
                        className="text-[10px] font-bold uppercase mb-1.5"
                        style={{
                          color:
                            '#1D4ED8',
                        }}
                      >
                        💬 Feedback from{' '}
                        {
                          drawer.teacher_name ??
                          'Teacher'
                        }
                      </p>

                      <p
                        className="text-sm"
                        style={{
                          color:
                            '#1E40AF',
                        }}
                      >
                        "{drawer.teacher_remarks}"
                      </p>
                    </div>
                  ) : (
                    <p
                      className="text-sm italic py-1"
                      style={{
                        color:
                          '#64748B',
                      }}
                    >
                      No remarks added yet.
                    </p>
                  )}
                </div>

                {/* =================================================
                    STUDENT SUBMISSION
                    ================================================= */}

                <div>
                  <p
                    className="text-xs font-bold uppercase tracking-wider mb-2"
                    style={{
                      color:
                        '#64748B',
                    }}
                  >
                    Student Submission
                  </p>

                  {drawer.submission_text ||
                  getFileSource(drawer) ||
                  drawer.drive_link ? (
                    <div
                      className="rounded-xl p-4 space-y-3"
                      style={{
                        background:
                          '#F0FDF4',
                        border:
                          '1px solid #BBF7D0',
                      }}
                    >
                      {/* SUBMISSION TEXT */}
                      {drawer.submission_text && (
                        <div>
                          <p
                            className="text-[10px] font-bold uppercase tracking-wider mb-1"
                            style={{
                              color:
                                '#15803D',
                            }}
                          >
                            Submission Text
                          </p>

                          <p
                            className="text-sm whitespace-pre-wrap"
                            style={{
                              color:
                                '#166534',
                            }}
                          >
                            {
                              drawer.submission_text
                            }
                          </p>
                        </div>
                      )}

                      {/* =================================================
                          UPLOADED FILE
                          ================================================= */}

                      {getFileSource(
                        drawer
                      ) && (
                        <div
                          className="flex items-center justify-between gap-3 rounded-xl p-3"
                          style={{
                            background:
                              '#DCFCE7',
                            border:
                              '1px solid #BBF7D0',
                          }}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="text-2xl">
                              📎
                            </span>

                            <div className="min-w-0">
                              <p
                                className="text-xs font-bold"
                                style={{
                                  color:
                                    '#166534',
                                }}
                              >
                                Submitted File
                              </p>

                              {/* ACTUAL FILE NAME */}
                              <p
                                className="text-xs truncate mt-0.5"
                                style={{
                                  color:
                                    '#15803D',
                                }}
                                title={
                                  getFileName(
                                    drawer
                                  ) ??
                                  undefined
                                }
                              >
                                {getFileName(
                                  drawer
                                ) ??
                                  'Attached file'}
                              </p>
                            </div>
                          </div>

                          <a
                            href={
                              getFileUrl(
                                drawer
                              ) ?? '#'
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(
                              event
                            ) => {
                              if (
                                !getFileUrl(
                                  drawer
                                )
                              ) {
                                event.preventDefault();
                              }
                            }}
                            className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold text-white"
                            style={{
                              background:
                                '#16A34A',
                            }}
                          >
                            View File
                          </a>
                        </div>
                      )}

                      {/* GOOGLE DRIVE */}
                      {drawer.drive_link && (
                        <div
                          className="flex items-center justify-between gap-3 rounded-xl p-3"
                          style={{
                            background:
                              '#EFF6FF',
                            border:
                              '1px solid #BFDBFE',
                          }}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="text-2xl">
                              🔗
                            </span>

                            <div className="min-w-0">
                              <p
                                className="text-xs font-bold"
                                style={{
                                  color:
                                    '#1D4ED8',
                                }}
                              >
                                Google Drive Submission
                              </p>

                              <p
                                className="text-xs truncate"
                                style={{
                                  color:
                                    '#2563EB',
                                }}
                                title={
                                  drawer.drive_link
                                }
                              >
                                {
                                  drawer.drive_link
                                }
                              </p>
                            </div>
                          </div>

                          <a
                            href={
                              drawer.drive_link
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold text-white"
                            style={{
                              background:
                                '#2563EB',
                            }}
                          >
                            Open Drive
                          </a>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div
                      className="rounded-xl p-5 text-center"
                      style={{
                        background:
                          'rgba(255,255,255,0.05)',
                        border:
                          '1px dashed #475569',
                      }}
                    >
                      <p className="text-2xl">
                        📭
                      </p>

                      <p
                        className="text-sm font-semibold"
                        style={{
                          color:
                            '#94A3B8',
                        }}
                      >
                        No submission uploaded yet.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* DRAWER FOOTER */}
            <div
              className="shrink-0 px-6 py-4 border-t flex flex-wrap gap-3"
              style={{
                borderColor:
                  'rgba(255,255,255,0.1)',
                background:
                  'rgba(255,255,255,0.05)',
              }}
            >
              {[
                'Upcoming',
                'Ongoing',
                'Overdue',
              ].includes(
                drawer.status
              ) && (
                <button
                  onClick={() => {
                    openModal(
                      drawer
                    );

                    setDrawer(null);
                  }}
                  className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white"
                  style={{
                    background:
                      '#EA580C',
                  }}
                >
                  Submit Assignment
                </button>
              )}

              {drawer.status ===
                'Submitted' && (
                <button
                  onClick={() => {
                    openModal(
                      drawer
                    );

                    setDrawer(null);
                  }}
                  className="flex-1 py-2.5 rounded-xl font-bold text-sm border"
                  style={{
                    color:
                      '#CBD5E1',
                    borderColor:
                      'rgba(255,255,255,0.1)',
                    background:
                      'rgba(255,255,255,0.05)',
                  }}
                >
                  Update Submission
                </button>
              )}

              {drawer.status ===
                'Graded' && (
                <div
                  className="flex-1 rounded-xl py-2.5 text-center"
                  style={{
                    background:
                      '#F0FDF4',
                    border:
                      '1px solid #BBF7D0',
                  }}
                >
                  <p
                    className="text-sm font-bold"
                    style={{
                      color:
                        '#15803D',
                    }}
                  >
                    ✅ Graded —{' '}
                    {drawer.marks_obtained ??
                      '–'}{' '}
                    marks received
                  </p>
                </div>
              )}

              <button
                onClick={() => {
                  const subject =
                    encodeURIComponent(
                      `Re: ${drawer.assignment_title} (${drawer.subject})`
                    );

                  router.push(
                    `/parent/communication?new=1&subject=${subject}&category=Academic`
                  );

                  setDrawer(null);
                }}
                className="px-4 py-2.5 rounded-xl font-semibold text-sm border flex items-center gap-1.5"
                style={{
                  color:
                    '#1D4ED8',
                  borderColor:
                    '#BFDBFE',
                  background:
                    '#EFF6FF',
                }}
              >
                💬 Ask Teacher
              </button>

              <button
                onClick={() =>
                  setDrawer(null)
                }
                className="px-5 py-2.5 rounded-xl font-semibold text-sm border"
                style={{
                  color:
                    '#94A3B8',
                  borderColor:
                    'rgba(255,255,255,0.1)',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          SUBMISSION MODAL
          ===================================================== */}

      {modal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => {
              if (!submitting) {
                setModal(false);
              }
            }}
          />

          <div className="relative bg-slate-800 border border-white/10 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden z-[110]">

            {/* MODAL HEADER */}
            <div
              className="p-5 border-b flex justify-between items-center"
              style={{
                borderColor:
                  'rgba(255,255,255,0.1)',
                background:
                  'rgba(255,255,255,0.05)',
              }}
            >
              <h3
                className="font-black text-lg"
                style={{
                  color:
                    '#F8FAFC',
                }}
              >
                Submit Assignment
              </h3>

              <button
                disabled={submitting}
                onClick={() => {
                  setModal(false);
                  setText('');
                  setAttachment(null);
                  setDriveLink('');
                  setAttachmentError('');
                  setTarget(null);
                }}
                className="text-2xl leading-none"
                style={{
                  color:
                    '#64748B',
                }}
              >
                ×
              </button>
            </div>

            <div className="p-5 space-y-4">

              {/* ASSIGNMENT SELECTOR */}
              {!target ? (
                <div>
                  <label
                    className="block text-xs font-bold mb-1.5 uppercase tracking-wide"
                    style={{
                      color:
                        '#E2E8F0',
                    }}
                  >
                    Select Assignment
                  </label>

                  <select
                    defaultValue=""
                    onChange={(event) => {
                      const selected =
                        assignments.find(
                          (assignment) =>
                            assignment.assignment_id ===
                            Number(
                              event.target
                                .value
                            )
                        );

                      setTarget(
                        selected ??
                          null
                      );
                    }}
                    className="w-full border rounded-xl px-3 py-2.5 text-sm font-medium outline-none"
                    style={{
                      color:
                        '#F8FAFC',
                      borderColor:
                        'rgba(255,255,255,0.1)',
                      background:
                        '#334155',
                    }}
                  >
                    <option
                      value=""
                      style={{
                        background:
                          '#334155',
                        color:
                          '#F8FAFC',
                      }}
                    >
                      — Choose an assignment —
                    </option>

                    {assignments
                      .filter(
                        (
                          assignment
                        ) =>
                          [
                            'Upcoming',
                            'Ongoing',
                            'Overdue',
                          ].includes(
                            assignment.status
                          )
                      )
                      .map(
                        (
                          assignment
                        ) => (
                          <option
                            key={
                              assignment.assignment_id
                            }
                            value={
                              assignment.assignment_id
                            }
                            style={{
                              background:
                                '#334155',
                              color:
                                '#F8FAFC',
                            }}
                          >
                            {
                              assignment.assignment_title
                            }{' '}
                            ·{' '}
                            {
                              assignment.subject
                            }{' '}
                            · Due{' '}
                            {formatDate(
                              assignment.due_date
                            )}
                          </option>
                        )
                      )}
                  </select>
                </div>
              ) : (
                <div
                  className="rounded-xl p-4"
                  style={{
                    background:
                      'rgba(234,88,12,0.1)',
                    border:
                      '1px solid rgba(234,88,12,0.25)',
                  }}
                >
                  <div className="flex justify-between items-start gap-3">
                    <div>
                      <p
                        className="text-[10px] font-bold uppercase tracking-wider"
                        style={{
                          color:
                            '#EA580C',
                        }}
                      >
                        Submitting for
                      </p>

                      <p
                        className="font-bold mt-0.5"
                        style={{
                          color:
                            '#F8FAFC',
                        }}
                      >
                        {
                          target.assignment_title
                        }
                      </p>

                      <p
                        className="text-xs mt-0.5"
                        style={{
                          color:
                            '#94A3B8',
                        }}
                      >
                        {target.subject} ·
                        Due{' '}
                        {formatDate(
                          target.due_date
                        )}
                      </p>

                      {target.teacher_name && (
                        <p
                          className="text-xs mt-0.5"
                          style={{
                            color:
                              '#94A3B8',
                          }}
                        >
                          Teacher:{' '}
                          {
                            target.teacher_name
                          }
                        </p>
                      )}
                    </div>

                    <button
                      disabled={submitting}
                      onClick={() =>
                        setTarget(
                          null
                        )
                      }
                      className="text-xs font-bold"
                      style={{
                        color:
                          '#EA580C',
                      }}
                    >
                      Change
                    </button>
                  </div>
                </div>
              )}

              {/* TEXT */}
              <div>
                <label
                  className="block text-xs font-bold mb-1.5 uppercase tracking-wide"
                  style={{
                    color:
                      '#E2E8F0',
                  }}
                >
                  Submission Text{' '}
                  <span
                    style={{
                      color:
                        '#DC2626',
                    }}
                  >
                    *
                  </span>
                </label>

                <textarea
                  rows={5}
                  value={text}
                  onChange={(event) =>
                    setText(
                      event.target.value
                    )
                  }
                  placeholder="Write your answer or describe your submission..."
                  className="w-full border rounded-xl px-4 py-3 text-sm outline-none resize-none bg-slate-700 placeholder:text-slate-500"
                  style={{
                    color:
                      '#F8FAFC',
                    borderColor:
                      'rgba(255,255,255,0.1)',
                    lineHeight:
                      '1.6',
                  }}
                />
              </div>

              {/* ATTACHMENT */}
              <div>
                <label
                  className="block text-xs font-bold mb-2 uppercase tracking-wide"
                  style={{
                    color:
                      '#E2E8F0',
                  }}
                >
                  Attachment (Optional)
                </label>

                <div
                  className="border-2 border-dashed rounded-xl p-4"
                  style={{
                    borderColor:
                      'rgba(255,255,255,0.1)',
                  }}
                >
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                    onChange={
                      handleFileChange
                    }
                    disabled={submitting}
                    className="block w-full text-sm text-slate-300"
                  />

                  {attachment && (
                    <div
                      className="mt-3 rounded-lg p-3"
                      style={{
                        background:
                          'rgba(34,197,94,0.1)',
                        border:
                          '1px solid rgba(34,197,94,0.25)',
                      }}
                    >
                      <p
                        className="text-xs font-bold"
                        style={{
                          color:
                            '#86EFAC',
                        }}
                      >
                        📎 Selected File
                      </p>

                      <p
                        className="text-xs mt-1 truncate"
                        style={{
                          color:
                            '#BBF7D0',
                        }}
                        title={
                          attachment.name
                        }
                      >
                        {attachment.name}
                      </p>

                      <p
                        className="text-[10px] mt-1"
                        style={{
                          color:
                            '#86EFAC',
                        }}
                      >
                        {(
                          attachment.size /
                          1024 /
                          1024
                        ).toFixed(
                          2
                        )}{' '}
                        MB
                      </p>
                    </div>
                  )}

                  <p
                    className="text-center text-xs my-3"
                    style={{
                      color:
                        '#9CA3AF',
                    }}
                  >
                    OR
                  </p>

                  <input
                    type="url"
                    placeholder="https://drive.google.com/..."
                    value={driveLink}
                    disabled={submitting}
                    onChange={(event) => {
                      setDriveLink(
                        event.target.value
                      );

                      if (
                        event.target.value
                      ) {
                        setAttachment(
                          null
                        );
                      }

                      setAttachmentError(
                        ''
                      );
                    }}
                    className="w-full text-sm border rounded-lg px-3 py-2 outline-none"
                    style={{
                      color:
                        '#F8FAFC',
                      borderColor:
                        'rgba(255,255,255,0.1)',
                      background:
                        '#334155',
                    }}
                  />

                  <p
                    className="text-xs mt-2"
                    style={{
                      color:
                        '#9CA3AF',
                    }}
                  >
                    Supported formats:
                    PDF, DOC, DOCX, JPG,
                    PNG (Max 10 MB)
                  </p>

                  {attachmentError && (
                    <p className="text-red-500 text-xs mt-2">
                      {attachmentError}
                    </p>
                  )}
                </div>
              </div>

              {/* SUBMIT BUTTON */}
              <button
                onClick={doSubmit}
                disabled={
                  !text.trim() ||
                  !target ||
                  submitting
                }
                className="w-full py-3 rounded-xl font-bold text-sm text-white transition-opacity"
                style={{
                  background:
                    !text.trim() ||
                    !target ||
                    submitting
                      ? '#FED7AA'
                      : '#EA580C',

                  cursor:
                    !text.trim() ||
                    !target ||
                    submitting
                      ? 'not-allowed'
                      : 'pointer',
                }}
              >
                {submitting
                  ? 'Submitting…'
                  : 'Submit Assignment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}