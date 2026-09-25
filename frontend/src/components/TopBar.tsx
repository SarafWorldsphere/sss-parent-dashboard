'use client';

import {
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';

import ChildSelector from './ChildSelector';
import LanguageSelector from './LanguageSelector';
import { fetchNotifications } from '@/lib/api';
import Link from 'next/link';

import {
  BellIcon,
  Bars3Icon,
} from '@heroicons/react/24/outline';

/* ============================================================
   TYPES
   ============================================================ */

interface TopBarProps {
  studentId: number;
  setStudentId: (studentId: number) => void;

  parentId?: number;
  parentName?: string;

  language: string;
  setLanguage: (language: string) => void;

  isLoading?: boolean;
}

interface Notification {
  id: string;
  type?: string;
  title?: string;
  message?: string;
  date?: string;
  link?: string;
}

/* ============================================================
   LOCAL STORAGE HELPERS
   ============================================================ */

function getReadIds(
  studentId: number,
  kind: 'notif'
): Set<string> {
  if (typeof window === 'undefined') {
    return new Set<string>();
  }

  try {
    const raw = localStorage.getItem(
      `sss_read_${kind}_${studentId}`
    );

    return raw
      ? new Set<string>(JSON.parse(raw))
      : new Set<string>();
  } catch {
    return new Set<string>();
  }
}

function saveReadIds(
  studentId: number,
  kind: 'notif',
  ids: Set<string>
): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(
      `sss_read_${kind}_${studentId}`,
      JSON.stringify([...ids])
    );
  } catch {
    // Ignore localStorage errors
  }
}

/* ============================================================
   NOTIFICATION ICON
   ============================================================ */

function notifIcon(type?: string): string {
  const map: Record<string, string> = {
    ticket_reply: '💬',
    announcement: '📢',
    warning: '⚠️',
    success: '✅',
    info: '💡',
  };

  return type && map[type]
    ? map[type]
    : '🔔';
}

/* ============================================================
   DYNAMIC PARENT INITIALS
   ============================================================ */

function getInitials(name?: string): string {
  if (!name || !name.trim()) {
    return 'P';
  }

  const words = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 1) {
    return words[0]
      .substring(0, 2)
      .toUpperCase();
  }

  return `${words[0][0]}${
    words[words.length - 1][0]
  }`.toUpperCase();
}

/* ============================================================
   TOP BAR
   ============================================================ */

export default function TopBar({
  studentId,
  setStudentId,
  parentId = 0,
  parentName,
  language,
  setLanguage,
  isLoading = false,
}: TopBarProps) {
  /* ==========================================================
     STATE
     ========================================================== */

  const [showNotifications, setShowNotifications] =
    useState(false);

  const [notifications, setNotifications] =
    useState<Notification[]>([]);

  const [readIds, setReadIds] =
    useState<Set<string>>(new Set());

  const bellRef =
    useRef<HTMLDivElement>(null);

  /* ==========================================================
     DYNAMIC PARENT DISPLAY
     ========================================================== */

  const displayParentName =
    parentName?.trim() || 'Parent';

  const parentInitials =
    getInitials(displayParentName);

  /* ==========================================================
     LOAD NOTIFICATIONS
     ========================================================== */

  const loadNotifications = useCallback(
    async () => {
      if (!studentId) {
        setNotifications([]);
        return;
      }

      try {
        const data =
          await fetchNotifications(studentId);

        setNotifications(
          Array.isArray(data)
            ? data
            : []
        );
      } catch {
        setNotifications([]);
      }
    },
    [studentId]
  );

  /* ==========================================================
     FETCH NOTIFICATIONS
     ========================================================== */

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  /* ==========================================================
     RESTORE NOTIFICATION READ STATE
     ========================================================== */

  useEffect(() => {
    if (!studentId) {
      setReadIds(new Set<string>());
      return;
    }

    const ids =
      getReadIds(studentId, 'notif');

    try {
      const raw =
        localStorage.getItem(
          `sss_read_notices_${studentId}`
        );

      if (raw) {
        const noticeIds: number[] =
          JSON.parse(raw);

        for (const noticeId of noticeIds) {
          ids.add(`not_${noticeId}`);
        }
      }
    } catch {
      // Ignore invalid localStorage data
    }

    setReadIds(ids);
  }, [studentId]);

  /* ==========================================================
     REAL-TIME NOTIFICATION READ SYNC
     ========================================================== */

  useEffect(() => {
    const handler = (event: Event) => {
      const {
        noticeId,
        sid,
      } =
        (event as CustomEvent).detail ?? {};

      if (sid !== studentId) {
        return;
      }

      setReadIds((previous) => {
        const next =
          new Set(previous);

        next.add(`not_${noticeId}`);

        return next;
      });
    };

    window.addEventListener(
      'sssNoticeRead',
      handler
    );

    return () => {
      window.removeEventListener(
        'sssNoticeRead',
        handler
      );
    };
  }, [studentId]);

  /* ==========================================================
     CLOSE NOTIFICATION DROPDOWN
     ========================================================== */

  useEffect(() => {
    if (!showNotifications) {
      return;
    }

    const handler = (event: MouseEvent) => {
      const target =
        event.target as Node;

      if (
        bellRef.current &&
        !bellRef.current.contains(target)
      ) {
        setShowNotifications(false);
      }
    };

    document.addEventListener(
      'mousedown',
      handler
    );

    return () => {
      document.removeEventListener(
        'mousedown',
        handler
      );
    };
  }, [showNotifications]);

  /* ==========================================================
     UNREAD NOTIFICATIONS
     ========================================================== */

  const unreadNotifications =
    notifications.filter(
      (notification) =>
        !readIds.has(notification.id)
    );

  const unreadCount =
    unreadNotifications.length;

  /* ==========================================================
     MARK ONE NOTIFICATION AS READ
     ========================================================== */

  const markOneRead = (
    id: string
  ): void => {
    const next =
      new Set(readIds);

    next.add(id);

    setReadIds(next);

    if (!studentId) {
      return;
    }

    saveReadIds(
      studentId,
      'notif',
      next
    );

    /*
     * Maintain notice-specific
     * read state for the Notices page.
     */
    if (id.startsWith('not_')) {
      const noticeId =
        parseInt(
          id.slice(4),
          10
        );

      if (!Number.isNaN(noticeId)) {
        try {
          const raw =
            localStorage.getItem(
              `sss_read_notices_${studentId}`
            );

          const existing: Set<number> =
            raw
              ? new Set<number>(
                  JSON.parse(raw)
                )
              : new Set<number>();

          existing.add(noticeId);

          localStorage.setItem(
            `sss_read_notices_${studentId}`,
            JSON.stringify(
              [...existing]
            )
          );
        } catch {
          // Ignore localStorage errors
        }
      }
    }
  };

  /* ==========================================================
     MARK ALL NOTIFICATIONS AS READ
     ========================================================== */

  const markAllRead = (): void => {
    const next =
      new Set(
        notifications.map(
          (notification) =>
            notification.id
        )
      );

    setReadIds(next);

    if (!studentId) {
      return;
    }

    saveReadIds(
      studentId,
      'notif',
      next
    );

    const noticeIds: number[] = [];

    for (const id of next) {
      if (id.startsWith('not_')) {
        const number =
          parseInt(
            id.slice(4),
            10
          );

        if (!Number.isNaN(number)) {
          noticeIds.push(number);
        }
      }
    }

    if (noticeIds.length > 0) {
      try {
        const raw =
          localStorage.getItem(
            `sss_read_notices_${studentId}`
          );

        const existing: Set<number> =
          raw
            ? new Set<number>(
                JSON.parse(raw)
              )
            : new Set<number>();

        for (
          const noticeId of noticeIds
        ) {
          existing.add(noticeId);
        }

        localStorage.setItem(
          `sss_read_notices_${studentId}`,
          JSON.stringify(
            [...existing]
          )
        );
      } catch {
        // Ignore localStorage errors
      }
    }
  };

  /* ==========================================================
     UI
     ========================================================== */

  return (
    <header
      className="
        flex
        flex-col
        md:flex-row
        justify-between
        items-start
        md:items-center
        gap-4
        bg-slate-900/80
        backdrop-blur-md
        p-4
        border-b
        border-white/10
        sticky
        top-0
        z-20
      "
    >
      {/* ======================================================
          LEFT SECTION
          ====================================================== */}

      <div
        className="
          flex
          items-center
          gap-3
          w-full
          md:w-auto
        "
      >
        {/* Mobile Sidebar Button */}
        <button
          type="button"
          onClick={() =>
            window.dispatchEvent(
              new Event(
                'sssSidebarToggle'
              )
            )
          }
          className="
            md:hidden
            text-slate-400
            hover:text-white
            transition-colors
            shrink-0
          "
          aria-label="Open menu"
        >
          <Bars3Icon className="w-6 h-6" />
        </button>

        {/* Child Selector */}
        <ChildSelector
          currentStudentId={
            studentId
          }
          onSelect={
            setStudentId
          }
          parentId={
            parentId
          }
          disabled={
            isLoading
          }
        />

        {/* Language Selector */}
        <LanguageSelector
          currentLang={
            language
          }
          onSelect={
            setLanguage
          }
          disabled={
            isLoading
          }
        />
      </div>

      {/* ======================================================
          RIGHT SECTION
          ====================================================== */}

      <div
        className="
          flex
          items-center
          gap-6
          w-full
          md:w-auto
          justify-end
        "
      >
        {/* ====================================================
            NOTIFICATIONS
            ==================================================== */}

        <div
          ref={bellRef}
          className="relative"
        >
          <button
            type="button"
            onClick={() => {
              setShowNotifications(
                (previous) =>
                  !previous
              );
            }}
            className="
              relative
              text-slate-400
              hover:text-white
              transition-colors
            "
            aria-label="Notifications"
            aria-expanded={
              showNotifications
            }
          >
            <BellIcon className="w-6 h-6" />

            {/* Unread Count */}
            {unreadCount > 0 && (
              <span
                className="
                  absolute
                  -top-1
                  -right-1
                  bg-red-500
                  text-white
                  text-[10px]
                  w-4
                  h-4
                  flex
                  items-center
                  justify-center
                  rounded-full
                  font-bold
                  shadow-sm
                "
              >
                {unreadCount > 9
                  ? '9+'
                  : unreadCount}
              </span>
            )}
          </button>

          {/* ==================================================
              NOTIFICATION DROPDOWN
              ================================================== */}

          {showNotifications && (
            <div
              className="
                absolute
                top-10
                right-0
                w-80
                bg-slate-800
                border
                border-white/10
                rounded-2xl
                shadow-xl
                z-50
                overflow-hidden
              "
            >
              {/* Header */}
              <div
                className="
                  p-4
                  bg-white/5
                  border-b
                  border-white/10
                  flex
                  justify-between
                  items-center
                "
              >
                <h3
                  className="
                    font-bold
                    text-white
                    text-sm
                  "
                >
                  Notifications{' '}

                  {unreadCount > 0 && (
                    <span className="text-orange-500">
                      ({unreadCount} new)
                    </span>
                  )}
                </h3>

                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={
                      markAllRead
                    }
                    className="
                      text-xs
                      text-orange-600
                      font-semibold
                      hover:underline
                    "
                  >
                    Mark all as read
                  </button>
                )}
              </div>

              {/* Notification List */}
              <div
                className="
                  max-h-80
                  overflow-y-auto
                "
              >
                {unreadNotifications.length === 0 ? (
                  <div className="p-6 text-center">
                    <p className="text-2xl mb-2">
                      ✅
                    </p>

                    <p
                      className="
                        text-sm
                        text-slate-400
                        font-medium
                      "
                    >
                      You&apos;re all caught up!
                    </p>

                    <p
                      className="
                        text-xs
                        text-slate-500
                        mt-1
                      "
                    >
                      No new notifications.
                    </p>
                  </div>
                ) : (
                  unreadNotifications.map(
                    (notification) => (
                      <Link
                        key={
                          notification.id
                        }
                        href={
                          notification.link ||
                          '#'
                        }
                        onClick={() => {
                          markOneRead(
                            notification.id
                          );

                          setShowNotifications(
                            false
                          );
                        }}
                        className="
                          p-4
                          border-b
                          border-white/5
                          hover:bg-orange-500/10
                          transition-colors
                          flex
                          gap-3
                          items-start
                          cursor-pointer
                          block
                          bg-orange-500/5
                        "
                      >
                        {/* Icon */}
                        <span
                          className="
                            text-xl
                            shrink-0
                          "
                        >
                          {notifIcon(
                            notification.type
                          )}
                        </span>

                        {/* Content */}
                        <div
                          className="
                            flex-1
                            min-w-0
                          "
                        >
                          <div
                            className="
                              flex
                              items-center
                              gap-2
                            "
                          >
                            <p
                              className="
                                text-sm
                                text-white
                                font-semibold
                                truncate
                                flex-1
                              "
                            >
                              {
                                notification.title
                              }
                            </p>

                            <span
                              className="
                                shrink-0
                                w-2
                                h-2
                                rounded-full
                                bg-orange-500
                              "
                            />
                          </div>

                          <p
                            className="
                              text-xs
                              text-slate-400
                              mt-0.5
                              line-clamp-2
                            "
                          >
                            {
                              notification.message
                            }
                          </p>

                          <p
                            className="
                              text-[10px]
                              text-slate-500
                              mt-1
                              uppercase
                              font-semibold
                              tracking-wider
                            "
                          >
                            {notification.date
                              ? new Date(
                                  notification.date
                                ).toLocaleDateString(
                                  'en-IN',
                                  {
                                    day: 'numeric',
                                    month: 'short',
                                  }
                                )
                              : 'Just now'}
                          </p>
                        </div>
                      </Link>
                    )
                  )
                )}
              </div>

              {/* View All */}
              <div
                className="
                  p-3
                  bg-white/5
                  border-t
                  border-white/10
                  text-center
                "
              >
                <Link
                  href="/parent/communication"
                  onClick={() =>
                    setShowNotifications(
                      false
                    )
                  }
                  className="
                    text-xs
                    font-bold
                    text-slate-400
                    hover:text-orange-400
                    uppercase
                    tracking-wider
                  "
                >
                  View All Communications →
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* ====================================================
            PARENT PROFILE DISPLAY
            No dropdown
            No Dashboard
            No Logout
            ==================================================== */}

        <div
          className="
            flex
            items-center
            gap-3
            border-l
            pl-6
            border-white/10
          "
        >
          {/* Dynamic Initials */}
          <div
            className="
              w-10
              h-10
              rounded-full
              bg-orange-200
              flex
              items-center
              justify-center
              text-orange-700
              font-black
              text-sm
              shadow-sm
              shrink-0
            "
            aria-label={
              displayParentName
            }
          >
            {parentInitials}
          </div>

          {/* Dynamic Parent Name */}
          <div
            className="
              text-sm
              hidden
              sm:block
              text-left
            "
          >
            <p
              className="
                text-slate-400
                text-xs
              "
            >
              Welcome,
            </p>

            <p
              className="
                font-bold
                text-white
              "
            >
              {displayParentName}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
