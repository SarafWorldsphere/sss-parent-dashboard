'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import {
  XMarkIcon,
  ArrowRightOnRectangleIcon,
} from '@heroicons/react/24/outline';

export default function Sidebar() {
  const pathname = usePathname();

  const [isOpen, setIsOpen] = useState(false);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [showToast, setShowToast] = useState(false);

  /*
   * Listen for sidebar toggle event
   * dispatched by TopBar hamburger button.
   */
  useEffect(() => {
    const handleToggle = () => {
      setIsOpen((previous) => !previous);
    };

    window.addEventListener('sssSidebarToggle', handleToggle);

    return () => {
      window.removeEventListener('sssSidebarToggle', handleToggle);
    };
  }, []);

  /*
   * Automatically close mobile sidebar
   * whenever the route changes.
   */
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  /*
   * Sidebar navigation items.
   *
   * These are application navigation definitions,
   * not user-specific/hard-coded data.
   */
  const menuItems = [
    {
      name: 'Dashboard',
      icon: '🏠',
      path: '/parent/dashboard',
    },
    {
      name: 'Assessments',
      icon: '📝',
      path: '/parent/assessments',
    },
    {
      name: 'Assignments',
      icon: '📄',
      path: '/parent/assignments',
    },
    {
      name: 'Quiz Performance',
      icon: '📊',
      path: '/parent/quiz',
    },
    {
      name: 'Teacher Remarks',
      icon: '💬',
      path: '/parent/remarks',
    },
    {
      name: 'Notices',
      icon: '🔔',
      path: '/parent/notices',
    },
    {
      name: 'Communication Center',
      icon: '🏫',
      path: '/parent/communication',
    },
  ];

  /*
   * Logout handler.
   */
  const handleLogoutConfirm = () => {
    setShowLogoutDialog(false);
    setShowToast(true);

    /*
     * Redirect to the application's login page
     * after displaying the success message.
     */
    window.setTimeout(() => {
      window.location.replace('https://staging.sss.swais.in');
    }, 1000);
  };

  /*
   * Cancel logout.
   */
  const handleLogoutCancel = () => {
    setShowLogoutDialog(false);
  };

  return (
    <>
      {/* =========================================================
          MOBILE OVERLAY
          ========================================================= */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* =========================================================
          SIDEBAR
          ========================================================= */}
      <aside
        className={`
          w-64
          bg-slate-900/95
          backdrop-blur-md
          text-white
          flex
          flex-col
          h-screen
          fixed
          left-0
          top-0
          overflow-y-auto
          z-40
          border-r
          border-white/5
          transition-transform
          duration-300
          ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        {/* =======================================================
            SIDEBAR HEADER
            ======================================================= */}
        <div className="p-6 flex items-center gap-3 border-b border-white/10">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Image
              src="/logo.jpg"
              alt="SSS School Logo"
              width={45}
              height={45}
              className="rounded-full"
              priority
            />

            <div className="min-w-0">
              <h1 className="font-bold text-lg leading-tight">
                SSS SCHOOL
              </h1>

              <p className="text-xs text-gray-400">
                Parent Dashboard
              </p>
            </div>
          </div>

          {/* Mobile Close Button */}
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="
              md:hidden
              text-gray-400
              hover:text-white
              transition-colors
              shrink-0
            "
            aria-label="Close menu"
          >
            <XMarkIcon className="w-8 h-8" />
          </button>
        </div>

        {/* =======================================================
            NAVIGATION
            ======================================================= */}
        <nav className="flex-1 py-6">
          <ul className="space-y-2 px-4">
            {menuItems.map((item) => {
              const isActive = pathname.startsWith(item.path);

              return (
                <li key={item.path}>
                  <Link
                    href={item.path}
                    onClick={() => setIsOpen(false)}
                    className={`
                      flex
                      items-center
                      gap-3
                      px-4
                      py-3
                      rounded-lg
                      transition-colors
                      ${
                        isActive
                          ? 'bg-orange-600 text-white'
                          : 'text-slate-300 hover:bg-white/10 hover:text-white'
                      }
                    `}
                  >
                    <span className="text-lg">
                      {item.icon}
                    </span>

                    <span className="font-medium">
                      {item.name}
                    </span>
                  </Link>
                </li>
              );
            })}

            {/* =====================================================
                LOGOUT
                Directly below Communication Center
                ===================================================== */}
            <li>
              <button
                type="button"
                onClick={() => setShowLogoutDialog(true)}
                className="
                  w-full
                  flex
                  items-center
                  gap-3
                  px-4
                  py-3
                  rounded-lg
                  text-red-400
                  hover:bg-red-500/10
                  hover:text-red-300
                  transition-colors
                  text-left
                "
              >
                <ArrowRightOnRectangleIcon className="w-5 h-5" />

                <span className="font-medium">
                  Logout
                </span>
              </button>
            </li>
          </ul>
        </nav>

        {/* =======================================================
            BOTTOM INFORMATION CARD
            ======================================================= */}
        <div className="p-4 mt-auto">
          <div
            className="
              bg-white/5
              border
              border-white/10
              rounded-xl
              p-4
              text-center
              text-slate-300
              shadow-sm
            "
          >
            <div className="flex justify-center mb-2">
              <span className="text-4xl">
                👨‍👩‍👦
              </span>
            </div>

            <p className="text-sm font-medium leading-tight">
              Stay connected with your child&apos;s learning journey.
            </p>
          </div>
        </div>
      </aside>

      {/* =========================================================
          LOGOUT CONFIRMATION DIALOG
          ========================================================= */}
      {showLogoutDialog && (
        <div
          className="
            fixed
            inset-0
            z-[200]
            flex
            items-center
            justify-center
            p-4
          "
          role="dialog"
          aria-modal="true"
          aria-labelledby="logout-title"
        >
          {/* Dialog Overlay */}
          <div
            className="
              absolute
              inset-0
              bg-black/40
              backdrop-blur-sm
            "
            onClick={handleLogoutCancel}
            aria-hidden="true"
          />

          {/* Dialog Box */}
          <div
            className="
              relative
              bg-slate-800
              rounded-2xl
              shadow-2xl
              w-full
              max-w-sm
              z-[210]
              overflow-hidden
              border
              border-white/10
            "
          >
            <div className="p-6">
              {/* Dialog Header */}
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="
                    w-11
                    h-11
                    rounded-full
                    bg-red-500/20
                    flex
                    items-center
                    justify-center
                    text-xl
                    shrink-0
                  "
                >
                  👋
                </div>

                <div>
                  <h3
                    id="logout-title"
                    className="
                      font-black
                      text-white
                      text-lg
                      leading-tight
                    "
                  >
                    Log out?
                  </h3>

                  <p className="text-sm text-slate-400 mt-0.5">
                    Are you sure you want to logout?
                  </p>
                </div>
              </div>

              {/* Dialog Buttons */}
              <div className="flex gap-3 mt-6">
                {/* Cancel */}
                <button
                  type="button"
                  onClick={handleLogoutCancel}
                  className="
                    flex-1
                    py-2.5
                    rounded-xl
                    border
                    font-semibold
                    text-sm
                    text-slate-300
                    hover:bg-white/10
                    transition-colors
                  "
                  style={{
                    borderColor: 'rgba(255,255,255,0.15)',
                  }}
                >
                  Cancel
                </button>

                {/* Logout */}
                <button
                  type="button"
                  onClick={handleLogoutConfirm}
                  className="
                    flex-1
                    py-2.5
                    rounded-xl
                    font-bold
                    text-sm
                    text-white
                    bg-red-500
                    hover:bg-red-600
                    transition-colors
                  "
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          LOGOUT SUCCESS TOAST
          ========================================================= */}
      {showToast && (
        <div
          className="
            fixed
            top-4
            right-4
            z-[300]
            bg-green-600
            text-white
            text-sm
            font-semibold
            px-4
            py-2.5
            rounded-xl
            shadow-lg
          "
          role="status"
          aria-live="polite"
        >
          You have been logged out successfully.
        </div>
      )}
    </>
  );
}
