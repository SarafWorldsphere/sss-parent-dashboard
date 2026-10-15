'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';

import TopBar from '@/components/TopBar';
import SpeakBtn from '@/components/SpeakBtn';
import { fetchRemarksHistory } from '@/lib/api';
import { useDashboard } from '@/lib/DashboardContext';
import { useTranslation, useTTS } from '@/lib/multilingual';

type RemarkData = {
  remark_id: number;
  teacher_name: string;
  subject: string;
  comment: string;
  date: string;
  ticket_id?: number | null;
  is_read?: boolean;
};

const COLORS = [
  { dot: '#22C55E', bg: '#DCFCE7', text: '#166534' },
  { dot: '#3B82F6', bg: '#DBEAFE', text: '#1E3A8A' },
  { dot: '#F97316', bg: '#FFEDD5', text: '#9A3412' },
  { dot: '#A855F7', bg: '#F3E8FF', text: '#6B21A8' },
  { dot: '#EC4899', bg: '#FCE7F3', text: '#9D174D' },
];

const getInitials = (name: string) => {
  const cleanedName = name
    .replace(/^(Mr|Mrs|Ms|Miss|Dr)\.?\s*/i, '')
    .trim();

  const parts = cleanedName.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  if (parts.length === 1 && parts[0].length >= 2) {
    return parts[0].substring(0, 2).toUpperCase();
  }

  return 'TR';
};

function getReadRemarkIds(studentId: number): Set<number> {
  if (typeof window === 'undefined') return new Set<number>();

  try {
    const raw = localStorage.getItem(`sss_read_remarks_${studentId}`);
    return raw ? new Set<number>(JSON.parse(raw)) : new Set<number>();
  } catch {
    return new Set<number>();
  }
}

function saveReadRemarkIds(studentId: number, ids: Set<number>) {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(
      `sss_read_remarks_${studentId}`,
      JSON.stringify([...ids])
    );
  } catch {
    // Ignore localStorage errors.
  }
}

function RemarkModal({
  remark,
  displayText,
  onClose,
  onTalkToTeacher,
}: {
  remark: RemarkData;
  displayText: string;
  onClose: () => void;
  onTalkToTeacher: () => void;
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[92dvh] overflow-hidden flex flex-col border border-white/10 min-w-0">
        <div className="flex items-start justify-between gap-3 px-4 sm:px-6 py-4 border-b border-white/10 shrink-0">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <span className="text-xl shrink-0">💬</span>
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-white break-words [overflow-wrap:anywhere]">
                {remark.teacher_name}
              </h3>
              <p className="text-xs text-slate-400 mt-1 break-words [overflow-wrap:anywhere]">
                {remark.subject} · {remark.date}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close remark details"
            className="text-gray-400 hover:text-white text-2xl font-bold leading-none shrink-0 p-1"
          >
            ×
          </button>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto flex-1 min-h-0">
          <p className="text-sm font-medium text-slate-300 leading-relaxed whitespace-pre-line break-words [overflow-wrap:anywhere]">
            {displayText}
          </p>
        </div>

        <div className="px-4 sm:px-6 pb-4 sm:pb-6 pt-3 shrink-0 flex flex-col sm:flex-row gap-3 border-t border-white/10">
          <button
            onClick={onClose}
            className="w-full sm:flex-1 py-3 rounded-xl border font-semibold text-sm text-slate-300 hover:bg-white/10 transition-colors"
            style={{ borderColor: 'rgba(255,255,255,0.15)' }}
          >
            Close
          </button>
          <button
            onClick={onTalkToTeacher}
            className="w-full sm:flex-1 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors"
            style={{
              color: '#7E22CE',
              background: '#F3E8FF',
              border: '1px solid #E9D5FF',
            }}
          >
            💬 Talk to Teacher
          </button>
        </div>
      </div>
    </div>
  );
}

export default function RemarksHistory() {
  const router = useRouter();

  const {
  studentId,
  setStudentId,
  parentId,
  parentName,
  language,
  setLanguage,
} = useDashboard()

  const [remarks, setRemarks] = useState<RemarkData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [subj, setSubj] = useState('All Subjects');
  const [readIds, setReadIds] = useState<Set<number>>(new Set());
  const [modalRemark, setModalRemark] = useState<{
    remark: RemarkData;
    displayText: string;
  } | null>(null);

  const { speaking, speak, fallbackLang } = useTTS();

  useEffect(() => {
    if (!studentId) {
      setReadIds(new Set<number>());
      return;
    }

    setReadIds(getReadRemarkIds(studentId));
  }, [studentId]);

  useEffect(() => {
    if (!studentId) {
      setRemarks([]);
      setReadIds(new Set<number>());
      setSubj('All Subjects');
      setModalRemark(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    const loadHistory = async () => {
      setIsLoading(true);
      setSubj('All Subjects');
      setModalRemark(null);

      try {
        const result = await fetchRemarksHistory(studentId);

        if (cancelled) return;

        const loadedRemarks: RemarkData[] = Array.isArray(result)
          ? result
          : [];

        setRemarks(loadedRemarks);

        const ids = new Set<number>(
          loadedRemarks.map((remark) => remark.remark_id)
        );

        saveReadRemarkIds(studentId, ids);
        setReadIds(ids);
      } catch (error) {
        if (cancelled) return;

        console.error('[SSS] Remarks: failed to load', error);
        setRemarks([]);
        setReadIds(new Set<number>());
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    loadHistory();

    return () => {
      cancelled = true;
    };
  }, [studentId]);

  const subjects = useMemo(
    () => [
      'All Subjects',
      ...Array.from(
        new Set(remarks.map((remark) => remark.subject).filter(Boolean))
      ),
    ],
    [remarks]
  );

  const filtered = useMemo(() => {
    if (subj === 'All Subjects') return remarks;
    return remarks.filter((remark) => remark.subject === subj);
  }, [remarks, subj]);

  const commentTexts = useMemo(
    () => filtered.map((remark) => remark.comment || ''),
    [filtered]
  );

  const { displayed: translatedComments, translating } = useTranslation(
    commentTexts,
    language
  );

  const handleTalkToTeacher = (remark: RemarkData) => {
    setModalRemark(null);

    if (remark.ticket_id) {
      router.push(`/parent/communication?conv=${remark.ticket_id}`);
    } else {
      const subject = encodeURIComponent(
        `Re: Teacher Remark - ${remark.subject}`
      );

      router.push(
        `/parent/communication?new=1&subject=${subject}&category=Academic`
      );
    }
  };

  return (
    <div className="min-h-full min-w-0 flex flex-col font-sans text-slate-200 overflow-x-hidden">
     <TopBar
      studentId={studentId}
      setStudentId={setStudentId}
      parentId={parentId}
      parentName={parentName}
      language={language}
      setLanguage={setLanguage}
      isLoading={isLoading}
    />
    
      <div className="flex-1 min-w-0 p-3 sm:p-4 md:p-8">
        <div className="max-w-4xl mx-auto min-w-0">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 sm:mb-8">
            <div className="min-w-0">
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className="text-2xl sm:text-3xl shrink-0"
                  style={{ color: '#A855F7' }}
                >
                  💬
                </span>
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight break-words">
                  Teacher Remarks History
                </h1>
              </div>
              <p className="text-slate-400 font-medium mt-2 ml-0 sm:ml-11 text-sm">
                View all remarks and feedback shared by teachers.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 min-w-0">
              {translating && (
                <span className="text-[11px] text-purple-400 font-semibold flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full border-2 border-purple-400 border-t-transparent animate-spin inline-block" />
                  Translating…
                </span>
              )}

              <div
                className="flex items-center gap-2 rounded-xl px-3 sm:px-4 py-2.5 min-w-0 w-full sm:w-auto"
                style={{
                  background: '#1e293b',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              >
                <span className="text-slate-400 shrink-0">🔻</span>
                <select
                  value={subj}
                  onChange={(event) => setSubj(event.target.value)}
                  aria-label="Filter remarks by subject"
                  className="border-none outline-none text-sm font-bold text-white flex-1 min-w-0 cursor-pointer"
                  style={{ background: '#1e293b', color: '#F8FAFC' }}
                >
                  {subjects.map((subject) => (
                    <option
                      key={subject}
                      value={subject}
                      style={{ background: '#1e293b', color: '#F8FAFC' }}
                    >
                      {subject}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {!studentId ? (
            <div className="py-16 sm:py-20 px-4 text-center bg-white/5 rounded-3xl border border-white/10 border-dashed">
              <p className="text-4xl mb-3">👨‍🎓</p>
              <p className="text-white font-bold text-lg">No child selected</p>
              <p className="text-slate-400 text-sm mt-2">
                Select a child to view teacher remarks.
              </p>
            </div>
          ) : isLoading ? (
            <div className="flex flex-col justify-center min-h-64 items-center gap-3">
              <div className="animate-spin rounded-full h-10 w-10 border-2 border-purple-500 border-t-transparent" />
              <p className="text-sm text-slate-400">
                Loading teacher remarks…
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 sm:py-20 px-4 text-center bg-white/5 rounded-3xl border border-white/10 border-dashed">
              <p className="text-4xl mb-3">📭</p>
              <p className="text-white font-bold text-lg">No remarks found.</p>
              <p className="text-slate-400 text-sm mt-2">
                Check back later for teacher feedback.
              </p>
            </div>
          ) : (
            <div className="relative pb-10 min-w-0">
              <div className="absolute left-[13px] top-5 bottom-0 w-0.5 bg-white/10 z-0 hidden sm:block" />

              <div
                className={`space-y-4 sm:space-y-6 relative z-10 transition-opacity duration-200 ${
                  translating ? 'opacity-60' : 'opacity-100'
                }`}
              >
                {filtered.map((remark, index) => {
                  const colorConfig = COLORS[index % COLORS.length];
                  const initials = getInitials(remark.teacher_name || 'TR');
                  const isUnread = !readIds.has(remark.remark_id);
                  const displayText =
                    translatedComments[index] ?? remark.comment ?? '';
                  const ttsKey = `remark_${remark.remark_id ?? index}`;
                  const isFallback = !!fallbackLang && speaking === ttsKey;

                  return (
                    <div
                      key={remark.remark_id || index}
                      className="flex gap-2 sm:gap-5 items-start relative min-w-0"
                    >
                      <div className="hidden sm:flex shrink-0 w-7 flex-col items-center pt-5">
                        <div
                          className="w-3 h-3 rounded-full relative z-10"
                          style={{
                            backgroundColor: colorConfig.dot,
                            boxShadow: '0 0 0 4px #1e293b',
                          }}
                        />
                      </div>

                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => setModalRemark({ remark, displayText })}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            setModalRemark({ remark, displayText });
                          }
                        }}
                        className={`flex-1 min-w-0 bg-white/5 rounded-2xl border hover:bg-white/10 transition-all p-3 sm:p-5 cursor-pointer ${
                          isUnread
                            ? 'border-purple-500/40'
                            : 'border-white/10'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 sm:gap-3 mb-3 min-w-0">
                          <div className="flex items-start gap-2 sm:gap-3 min-w-0 flex-1">
                            <div
                              className="w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center font-black text-sm tracking-wider shrink-0"
                              style={{
                                backgroundColor: colorConfig.bg,
                                color: colorConfig.text,
                              }}
                            >
                              {initials}
                            </div>

                            <div className="min-w-0 flex-1">
                              <h3 className="font-black text-white text-sm sm:text-base leading-tight break-words [overflow-wrap:anywhere]">
                                {remark.teacher_name || 'Teacher'}
                              </h3>
                              <div className="flex flex-wrap items-center gap-2 mt-2 min-w-0">
                                <span className="max-w-full text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-slate-300 bg-white/10 px-2 py-1 rounded border border-white/10 break-words [overflow-wrap:anywhere]">
                                  {remark.subject || 'General'}
                                </span>
                                <span className="text-[10px] sm:text-xs font-bold text-slate-400 break-words">
                                  {remark.date}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div
                            className="flex items-center gap-1 sm:gap-2 shrink-0"
                            onClick={(event) => event.stopPropagation()}
                          >
                            {isUnread && (
                              <span className="bg-[#F3E8FF] text-[#7E22CE] text-[9px] sm:text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-md">
                                New
                              </span>
                            )}
                            <SpeakBtn
                              textKey={ttsKey}
                              speaking={speaking}
                              fallback={isFallback}
                              onSpeak={() => speak(displayText, language, ttsKey)}
                            />
                          </div>
                        </div>

                        <p className="text-sm font-medium text-slate-300 leading-relaxed sm:ml-14 line-clamp-3 break-words [overflow-wrap:anywhere]">
                          {displayText}
                        </p>

                        <div
                          className="sm:ml-14 mt-3 flex flex-wrap items-center gap-3"
                          onClick={(event) => event.stopPropagation()}
                        >
                          {remark.ticket_id ? (
                            <a
                              href={`/parent/communication?conv=${remark.ticket_id}`}
                              className="text-[11px] font-bold text-purple-300 hover:underline break-words"
                            >
                              View full conversation →
                            </a>
                          ) : (
                            <button
                              onClick={() => handleTalkToTeacher(remark)}
                              className="text-[11px] font-bold text-purple-300 hover:underline text-left"
                            >
                              💬 Talk to Teacher
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-center gap-1.5 mt-8 text-xs font-bold text-slate-500 text-center">
                <span>ⓘ</span>
                Showing latest remarks on top
              </div>
            </div>
          )}
        </div>
      </div>

      {modalRemark && (
        <RemarkModal
          remark={modalRemark.remark}
          displayText={modalRemark.displayText}
          onClose={() => setModalRemark(null)}
          onTalkToTeacher={() => handleTalkToTeacher(modalRemark.remark)}
        />
      )}
    </div>
  );
}
