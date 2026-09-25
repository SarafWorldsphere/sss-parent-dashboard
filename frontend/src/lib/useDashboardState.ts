import { useState, useEffect } from 'react';
import { fetchParentByEmail, fetchParentChildren } from '@/lib/api';

export function useDashboardState() {
  const [mounted, setMounted] = useState(false);
  const [studentId, setStudentId] = useState<number>(0);
  const [parentId, setParentId] = useState<number>(0);
  const [language, setLanguage] = useState<string>('en');

  useEffect(() => {
    let cancelled = false;

    const loadDashboardContext = async () => {
      try {
        const savedStudent = localStorage.getItem('sss_student_id');
        const savedParent = localStorage.getItem('sss_parent_id');
        const savedLang = localStorage.getItem('sss_language');

        const sid = savedStudent ? Number(savedStudent) : 0;

        if (savedLang) {
          setLanguage(savedLang);
        }

        const sessionRaw =
          sessionStorage.getItem('sssUserSession') ||
          localStorage.getItem('sssUserSession');

        if (!sessionRaw) {
          console.warn(
            '[SSS] No sssUserSession found. Waiting for parent context.'
          );

          if (!cancelled) {
            setMounted(true);
          }
          return;
        }

        let session: any;

        try {
          session = JSON.parse(sessionRaw);
        } catch {
          console.warn('[SSS] Invalid sssUserSession JSON.');

          if (!cancelled) {
            setMounted(true);
          }
          return;
        }

        const email =
          session?.email ||
          session?.user?.email ||
          '';

        if (!email) {
          console.warn(
            '[SSS] Logged-in session does not contain an email.'
          );

          if (!cancelled) {
            setMounted(true);
          }
          return;
        }

        console.log('[SSS] Authenticated email:', email);

        const parent = await fetchParentByEmail(email);

        if (cancelled) return;

        const resolvedParentId = Number(parent?.parent_id || 0);

        if (resolvedParentId <= 0) {
          console.warn('[SSS] Parent ID could not be resolved.');
          setMounted(true);
          return;
        }

        setParentId(resolvedParentId);
        localStorage.setItem(
          'sss_parent_id',
          resolvedParentId.toString()
        );

        // Clear any previous user's student context.
        setStudentId(0);
        localStorage.removeItem('sss_student_id');

        console.log(
          '[SSS] Parent resolved:',
          resolvedParentId,
          parent?.full_name
        );

        const children =
          await fetchParentChildren(resolvedParentId);

        if (cancelled) return;

        if (Array.isArray(children) && children.length > 0) {
          const existingChild = children.find(
            (child: any) =>
              Number(child?.student_id) === sid
          );

          const selectedStudentId = existingChild
            ? Number(existingChild.student_id)
            : Number(children[0].student_id);

          if (selectedStudentId > 0) {
            setStudentId(selectedStudentId);

            localStorage.setItem(
              'sss_student_id',
              selectedStudentId.toString()
            );

            console.log(
              '[SSS] Student resolved:',
              selectedStudentId,
              existingChild?.full_name ||
                children[0]?.full_name
            );
          }
        } else {
          console.warn(
            '[SSS] No children found for parent:',
            resolvedParentId
          );

          setStudentId(0);
          localStorage.removeItem('sss_student_id');

          console.log(
            '[SSS] Cleared previous student context.'
          );
        }

        setMounted(true);
      } catch (error) {
        console.error(
          '[SSS] Failed to resolve parent/student context:',
          error
        );

        if (!cancelled) {
          setMounted(true);
        }
      }
    };

    loadDashboardContext();

    return () => {
      cancelled = true;
    };
  }, []);

  const updateStudentId = (id: number) => {
    setStudentId(id);

    if (id > 0) {
      localStorage.setItem(
        'sss_student_id',
        id.toString()
      );
    } else {
      localStorage.removeItem('sss_student_id');
    }

    console.log('[SSS] studentId updated →', id);
  };

  const updateParentId = (id: number) => {
    setParentId(id);

    if (id > 0) {
      localStorage.setItem(
        'sss_parent_id',
        id.toString()
      );
    } else {
      localStorage.removeItem('sss_parent_id');
    }

    console.log('[SSS] parentId updated →', id);
  };

  const updateLanguage = (lang: string) => {
    setLanguage(lang);
    localStorage.setItem('sss_language', lang);
  };

  return {
    mounted,
    studentId,
    setStudentId: updateStudentId,
    parentId,
    setParentId: updateParentId,
    language,
    setLanguage: updateLanguage,
  };
}