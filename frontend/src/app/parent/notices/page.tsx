'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import SpeakBtn from '@/components/SpeakBtn';
import { fetchNoticesHistory } from '@/lib/api';
import { useDashboard } from '@/lib/DashboardContext';
import { useTranslation, useTTS } from '@/lib/multilingual';

type NoticeData = {
  notice_id: number;
  notice_title: string;
  notice_text: string;
  notice_date: string;
  applicable_class: string;
  posted_by_name: string;
  is_read?: boolean;
};

function getReadNoticeIds(studentId: number): Set<number> {
  if (typeof window === 'undefined') return new Set<number>();
  try {
    const raw = localStorage.getItem(`sss_read_notices_${studentId}`);
    return raw ? new Set<number>(JSON.parse(raw)) : new Set<number>();
  } catch {
    return new Set<number>();
  }
}

function saveReadNoticeIds(studentId: number, ids: Set<number>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`sss_read_notices_${studentId}`, JSON.stringify([...ids]));
  } catch {
    // Ignore localStorage errors.
  }
}

function NoticeModal({
  notice,
  displayTitle,
  displayText,
  onClose,
  onTalkToTeacher,
}: {
  notice: NoticeData;
  displayTitle: string;
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
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-2 backdrop-blur-sm sm:p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[92dvh] w-full min-w-0 max-w-lg flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-800 shadow-2xl">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-white/10 px-4 py-4 sm:px-6">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <span className="shrink-0 text-xl" style={{ color: '#F97316' }}>📢</span>
            <div className="min-w-0 flex-1">
              <h3 className="break-words font-bold text-white [overflow-wrap:anywhere]">{displayTitle}</h3>
              <p className="mt-1 break-words text-xs text-slate-400 [overflow-wrap:anywhere]">
                Posted by {notice.posted_by_name || 'School'} · {notice.notice_date}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close notice details"
            className="shrink-0 rounded-lg p-1 text-2xl font-bold leading-none text-slate-400 hover:text-white"
          >
            ×
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          <p className="whitespace-pre-line break-words text-sm font-medium leading-relaxed text-slate-300 [overflow-wrap:anywhere]">
            {displayText}
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-3 border-t border-white/10 px-4 pb-4 pt-3 sm:flex-row sm:px-6 sm:pb-6">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl border py-3 text-sm font-semibold text-slate-300 transition-colors hover:bg-white/10 sm:flex-1"
            style={{ borderColor: 'rgba(255,255,255,0.15)' }}
          >
            Close
          </button>
          <button
            type="button"
            onClick={onTalkToTeacher}
            className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-colors sm:flex-1"
            style={{ color: '#EA580C', background: '#FFF7ED', border: '1px solid #FED7AA' }}
          >
            💬 Talk to Teacher
          </button>
        </div>
      </div>
    </div>
  );
}

export default function NoticesHistory() {
  const router = useRouter();
  const {
    studentId,
    setStudentId,
    parentId,
    parentName,
    language,
    setLanguage,
  } = useDashboard();

  const [notices, setNotices] = useState<NoticeData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [readIds, setReadIds] = useState<Set<number>>(new Set<number>());
  const [modalNotice, setModalNotice] = useState<{
    notice: NoticeData;
    displayTitle: string;
    displayText: string;
  } | null>(null);

  const { speaking, speak, fallbackLang } = useTTS();

  useEffect(() => {
    if (!studentId) {
      setReadIds(new Set<number>());
      setNotices([]);
      setModalNotice(null);
      setIsLoading(false);
      return;
    }
    setReadIds(getReadNoticeIds(studentId));
  }, [studentId]);

  useEffect(() => {
    if (!studentId) {
      setNotices([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    const loadData = async () => {
      setIsLoading(true);
      try {
        const result = await fetchNoticesHistory(studentId);
        if (cancelled) return;
        setNotices(Array.isArray(result) ? result : []);
      } catch (error) {
        if (cancelled) return;
        console.error('[SSS] Notices: failed to load', error);
        setNotices([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    loadData();
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  const filtered = notices;
  const idKey = useMemo(() => filtered.map((notice) => notice.notice_id).join(','), [filtered]);
  const titleTexts = useMemo(
    () => filtered.map((notice) => notice.notice_title || ''),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [idKey]
  );
  const bodyTexts = useMemo(
    () => filtered.map((notice) => notice.notice_text || ''),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [idKey]
  );

  const { displayed: displayedTitles, translating: translatingTitles } = useTranslation(titleTexts, language);
  const { displayed: displayedTexts, translating: translatingBody } = useTranslation(bodyTexts, language);
  const translating = translatingTitles || translatingBody;

  useEffect(() => {
    if (typeof window === 'undefined' || notices.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const openId = params.get('open');
    if (!openId) return;

    const targetId = Number.parseInt(openId, 10);
    if (Number.isNaN(targetId)) return;
    const index = notices.findIndex((notice) => notice.notice_id === targetId);
    if (index === -1) return;

    const notice = notices[index];
    const displayTitle = displayedTitles[index] ?? notice.notice_title ?? '';
    const displayText = displayedTexts[index] ?? notice.notice_text ?? '';
    setModalNotice({ notice, displayTitle, displayText });

    setReadIds((previous) => {
      if (previous.has(targetId)) return previous;
      const next = new Set(previous);
      next.add(targetId);
      saveReadNoticeIds(studentId, next);
      window.dispatchEvent(new CustomEvent('sssNoticeRead', {
        detail: { noticeId: targetId, sid: studentId },
      }));
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notices, displayedTitles, displayedTexts]);

  const markNoticeRead = (noticeId: number) => {
    if (readIds.has(noticeId)) return;
    const next = new Set(readIds);
    next.add(noticeId);
    setReadIds(next);
    saveReadNoticeIds(studentId, next);
    window.dispatchEvent(new CustomEvent('sssNoticeRead', {
      detail: { noticeId, sid: studentId },
    }));
  };

  const openNotice = (notice: NoticeData, index: number) => {
    markNoticeRead(notice.notice_id);
    setModalNotice({
      notice,
      displayTitle: displayedTitles[index] ?? notice.notice_title ?? '',
      displayText: displayedTexts[index] ?? notice.notice_text ?? '',
    });
  };

  const handleTalkToTeacher = (notice: NoticeData) => {
    setModalNotice(null);
    const subject = encodeURIComponent(`Re: Notice - ${notice.notice_title}`);
    router.push(`/parent/communication?new=1&subject=${subject}&category=Academic`);
  };

  return (
    <div className="flex min-h-full min-w-0 flex-col overflow-x-hidden font-sans text-slate-200">
      <TopBar
        studentId={studentId}
        setStudentId={setStudentId}
        parentId={parentId}
        parentName={parentName}
        language={language}
        setLanguage={setLanguage}
        isLoading={isLoading}
      />

      <main className="min-w-0 flex-1 p-3 sm:p-4 md:p-8">
        <div className="mx-auto min-w-0 max-w-5xl">
          <header className="mb-6 flex min-w-0 flex-col justify-between gap-4 sm:mb-8 sm:flex-row sm:items-center">
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-3">
                <span className="shrink-0 text-2xl sm:text-3xl" style={{ color: '#F97316' }}>📢</span>
                <h1 className="break-words text-xl font-black tracking-tight text-white sm:text-2xl">Notices History</h1>
              </div>
              <p className="ml-0 mt-2 text-sm font-medium text-slate-400 sm:ml-11 sm:mt-1">
                All important notices and announcements.
              </p>
            </div>
            {translating && (
              <span className="flex shrink-0 items-center gap-2 text-[11px] font-semibold text-orange-400">
                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-orange-400 border-t-transparent" />
                Translating…
              </span>
            )}
          </header>

          {!studentId ? (
            <div className="rounded-3xl border border-dashed border-white/10 bg-white/5 px-4 py-16 text-center sm:py-20">
              <p className="mb-3 text-4xl">👨‍🎓</p>
              <p className="text-lg font-bold text-white">No child selected</p>
              <p className="mt-2 text-sm text-slate-400">Select a child to view notices.</p>
            </div>
          ) : isLoading ? (
            <div className="flex min-h-64 flex-col items-center justify-center gap-3">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
              <p className="text-sm text-slate-400">Loading notices…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-white/10 bg-white/5 px-4 py-16 text-center sm:py-20">
              <p className="mb-3 text-4xl">📭</p>
              <p className="text-lg font-bold text-white">No notices found.</p>
              <p className="mt-2 text-sm text-slate-400">There are no announcements for this class right now.</p>
            </div>
          ) : (
            <div className={`min-w-0 space-y-4 pb-10 transition-opacity duration-200 sm:space-y-6 ${translating ? 'opacity-60' : 'opacity-100'}`}>
              {filtered.map((notice, index) => {
                const isUnread = !readIds.has(notice.notice_id);
                const displayTitle = displayedTitles[index] ?? notice.notice_title ?? '';
                const displayText = displayedTexts[index] ?? notice.notice_text ?? '';
                const ttsKey = `notice_${notice.notice_id ?? index}`;
                const isFallback = !!fallbackLang && speaking === ttsKey;

                return (
                  <article
                    key={notice.notice_id || index}
                    role="button"
                    tabIndex={0}
                    aria-label={`Open notice: ${displayTitle}`}
                    onClick={() => openNotice(notice, index)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        openNotice(notice, index);
                      }
                    }}
                    className={`relative flex min-w-0 cursor-pointer flex-col gap-3 rounded-2xl border bg-white/5 p-3 transition-all hover:bg-white/10 sm:gap-5 sm:p-5 md:flex-row md:items-start md:p-6 ${isUnread ? 'border-orange-500/40' : 'border-white/10'}`}
                  >
                    <div className="hidden h-16 w-16 shrink-0 items-center justify-center rounded-full border-[6px] border-[#FFF7ED] bg-orange-50 text-2xl text-orange-500 md:flex">📢</div>

                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-start gap-2 sm:gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-50 text-lg text-orange-500 sm:h-10 sm:w-10 md:hidden">📢</div>
                        <h3 className="min-w-0 flex-1 break-words whitespace-normal pt-1 text-base font-black leading-snug text-white [overflow-wrap:anywhere] sm:text-lg">
                          {displayTitle}
                        </h3>
                      </div>
                      <p className="mt-3 line-clamp-3 whitespace-pre-line break-words text-sm font-medium leading-relaxed text-slate-300 [overflow-wrap:anywhere] sm:mt-2">
                        {displayText}
                      </p>
                      <p className="mt-3 break-words text-xs font-bold text-slate-400 sm:mt-4">
                        Posted by: <span className="text-slate-300">{notice.posted_by_name || 'School'}</span>
                      </p>
                    </div>

                    <div
                      className="flex w-full flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3 sm:gap-3 md:w-auto md:min-w-[145px] md:flex-col md:items-end md:border-0 md:pt-0"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        {isUnread && (
                          <span className="rounded-full bg-[#EA580C] px-3 py-1 text-[10px] font-black uppercase tracking-wider text-white shadow-sm">New</span>
                        )}
                        <SpeakBtn
                          textKey={ttsKey}
                          speaking={speaking}
                          fallback={isFallback}
                          onSpeak={() => speak(`${displayTitle}. ${displayText}`, language, ttsKey)}
                        />
                      </div>
                      <div className="flex max-w-full items-center gap-2 rounded-lg border border-[#FED7AA] bg-[#FFF7ED] px-2.5 py-1.5 text-[#EA580C] sm:px-3">
                        <span className="shrink-0 text-sm">🗓️</span>
                        <span className="break-words text-[11px] font-black tracking-wide sm:text-xs">{notice.notice_date}</span>
                      </div>
                    </div>
                  </article>
                );
              })}
              <div className="mt-8 flex items-center justify-center gap-1.5 text-center text-xs font-bold text-slate-500">
                <span>ⓘ</span> Showing latest notices on top
              </div>
            </div>
          )}
        </div>
      </main>

      {modalNotice && (
        <NoticeModal
          notice={modalNotice.notice}
          displayTitle={modalNotice.displayTitle}
          displayText={modalNotice.displayText}
          onClose={() => setModalNotice(null)}
          onTalkToTeacher={() => handleTalkToTeacher(modalNotice.notice)}
        />
      )}
    </div>
  );
}
