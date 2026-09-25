'use client';

import { useState, useCallback } from 'react';
import { fetchAIAnalytics, buildUserInfo } from '@/lib/aiService';
import type { AIAnalyticsScope } from '@/lib/aiTypes';

type Status = 'idle' | 'loading' | 'success' | 'error' | 'disabled';

interface UseAIAnalyticsReturn {
  status: Status;
  analysis: string | null;
  errorType: string | null;
  generate: () => Promise<void>;
  reset: () => void;
}

export function useAIAnalytics(
  scope: AIAnalyticsScope,
  parentId: number,
  subject?: string,
): UseAIAnalyticsReturn {
  const [status, setStatus] = useState<Status>('idle');
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<string | null>(null);

  const generate = useCallback(async () => {
    if (status === 'loading') return;

    setStatus('loading');
    setAnalysis(null);
    setErrorType(null);

    try {
      const result = await fetchAIAnalytics({
        scope,
        subject,
        userInfo: buildUserInfo(parentId),
      });

      if (!result.success) {
        if (
          result.error === 'disabled' ||
          result.error === 'not-ready'
        ) {
          setStatus('disabled');
        } else {
          setStatus('error');
          setErrorType(result.error ?? 'unknown');
        }

        return;
      }

      const analysisText =
        typeof result.data === 'string'
          ? result.data
          : result.data?.analysis ??
            result.data?.insight ??
            result.data?.result ??
            JSON.stringify(result.data);

      setAnalysis(analysisText);
      setStatus('success');
    } catch (error) {
      console.error('AI Analytics generation failed:', error);

      setStatus('error');
      setErrorType('unknown');
    }
  }, [scope, subject, parentId, status]);

  const reset = useCallback(() => {
    setStatus('idle');
    setAnalysis(null);
    setErrorType(null);
  }, []);

  return {
    status,
    analysis,
    errorType,
    generate,
    reset,
  };
}