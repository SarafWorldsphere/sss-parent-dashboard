'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import TopBar from '@/components/TopBar';
import { fetchAssessmentHistory } from '@/lib/api';
import { 
  fetchAssessmentSummary,
  translateText,
  textToVoice
} from '@/lib/aiService';
import { useDashboard } from '@/lib/DashboardContext';
import { useTranslation } from '@/lib/multilingual';

// ── Types ─────────────────────────────────────────────────────────────────────

type Assessment = {
  result_id: number;
  assessment_id: number;
  title: string;
  assessment_type: string;
  subject: string;
  chapter_name: string;
  teacher_name: string;
  assessment_date: string;   // "15 Jan 2025"
  date_iso: string;          // "2025-01-15"
  marks_obtained: number;
  max_marks: number;
  percentage: number;
  performance_badge: string;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, { text: string; bg: string; border: string; hex: string }> = {
  'Excellent':          { text: '#15803D', bg: '#F0FDF4', border: '#BBF7D0', hex: '#22C55E' },
  'Good':               { text: '#1D4ED8', bg: '#EFF6FF', border: '#BFDBFE', hex: '#3B82F6' },
  'Average':            { text: '#C2410C', bg: '#FFF7ED', border: '#FED7AA', hex: '#F97316' },
  'Needs Improvement':  { text: '#DC2626', bg: '#FEF2F2', border: '#FECACA', hex: '#EF4444' },
};

const PIE_COLORS = [
  '#EA580C', '#3B82F6', '#22C55E', '#A855F7',
  '#EAB308', '#14B8A6', '#EF4444', '#F97316',
];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const QUARTERS: Record<string, number[]> = {
  'Quarter 1': [0, 1, 2],
  'Quarter 2': [3, 4, 5],
  'Quarter 3': [6, 7, 8],
  'Quarter 4': [9, 10, 11],
};

const TIMELINE_OPTIONS = [
  'All Time',
  'Current Academic Year',
  ...MONTH_NAMES,
  'Quarter 1',
  'Quarter 2',
  'Quarter 3',
  'Quarter 4',
  'Custom Date Range',
];
const UI_TEXT = {
  title: 'Assessments',
  subtitle: "View your child's assessment history and academic performance.",

  allSubjects: 'All Subjects',
  allTime: 'All Time',
  currentAcademicYear: 'Current Academic Year',
  customDateRange: 'Custom Date Range',

  from: 'From',
  to: 'To',

  totalAssessments: 'Total Assessments',
  completed: 'Completed',

  averagePercentage: 'Average Percentage',
  overallPerformance: 'Overall performance',

  highestScore: 'Highest Score',
  topResult: 'Top result',

  lowestScore: 'Lowest Score',
  needsFocus: 'Needs focus',

  performanceTrend: 'Performance Trend',
  percentageOverTime: 'Percentage over time',

  subjectWisePerformance: 'Subject-wise Performance',
  averagePercentageBySubject: 'Average percentage by subject',

  noDataForFilters: 'No data for selected filters',

  noAssessments: 'No assessments found.',
  adjustFilters: 'Try adjusting your subject or timeline filters.',

  viewDetails: 'View Details',

  assessmentInformation: 'Assessment Information',

  subject: 'Subject',
  chapter: 'Chapter',
  teacher: 'Teacher',
  assessmentType: 'Assessment Type',
  date: 'Date',
  maxMarks: 'Max Marks',

  outOf: 'out of',
  marks: 'marks',

  aiPerformanceSummary: 'AI Performance Summary',
  generatingAISummary: 'Generating AI summary...',
  noAISummary: 'No AI summary available.',

  performance: 'Performance',
  encouragement: 'Encouragement',
  homeSupportTips: 'Home Support Tips',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const statusColor = (badge: string) =>
  STATUS_COLORS[badge] ?? STATUS_COLORS['Average'];

const normalizeSubject = (subject: string) => {
  const value = (subject ?? '').trim();
  return value === '' || value === '-' || value === '—'
    ? 'TEST_Social Studies'
    : value;
};

// ── Sub-components ────────────────────────────────────────────────────────────

const CircularProgress = ({ pct, colorHex }: { pct: number; colorHex: string }) => {
  const size = 56, stroke = 5;
  const r = (size - stroke) / 2;
  const circum = r * 2 * Math.PI;
  const offset = circum - (Math.min(pct, 100) / 100) * circum;
  return (
    <div className="relative flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.1)" strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={colorHex} strokeWidth={stroke} fill="none"
          strokeDasharray={circum} strokeDashoffset={offset} strokeLinecap="round" />
      </svg>
      <span className="absolute text-xs font-black" style={{ color: colorHex }}>{Math.round(pct)}%</span>
    </div>
  );
};

const StatCard = ({ label, value, sub }: { label: string; value: string; sub: string }) => (
 <div className="bg-white/5 rounded-2xl border border-white/10 p-5">
    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{label}</p>
    <p className="text-3xl font-black text-white">{value}</p>
    <p className="text-xs font-semibold text-slate-400 mt-1">{sub}</p>
  </div>
);

// ── Skeleton placeholders ─────────────────────────────────────────────────────

const SkeletonCard = () => (
   <div className="bg-white/5 rounded-2xl border border-white/10 p-5 animate-pulse">
    <div className="h-3 bg-white/10 rounded w-2/3 mb-3" />
    <div className="h-8 bg-white/10 rounded w-1/2 mb-2" />
    <div className="h-3 bg-white/10 rounded w-1/3" />
  </div>
);

const SkeletonAssessmentCard = () => (
 <div className="bg-white/5 rounded-2xl border border-white/10 p-5 animate-pulse flex gap-4 items-start">
    <div className="w-14 h-14 rounded-full bg-white/10 shrink-0" />
    <div className="flex-1 space-y-2">
     <div className="h-3 bg-white/10 rounded w-1/4" />
      <div className="h-4 bg-white/10 rounded w-3/4" />
      <div className="h-3 bg-white/10 rounded w-1/2" />
      <div className="h-6 bg-white/10 rounded w-1/3" />
    </div>
  </div>
);

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AssessmentsPage() {
  const { studentId, setStudentId, parentId, language, setLanguage } = useDashboard();

    const uiTextList = useMemo(
    () => Object.values(UI_TEXT),
    [],
  );

  const {
    displayed: translatedUI,
    translating: translatingUI,
  } = useTranslation(uiTextList, language);

  const t = useMemo(() => {
    const keys = Object.keys(UI_TEXT) as Array<keyof typeof UI_TEXT>;

    return keys.reduce((result, key, index) => {
      result[key] = translatedUI[index] ?? UI_TEXT[key];
      return result;
    }, {} as Record<keyof typeof UI_TEXT, string>);
  }, [translatedUI]);

  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [isLoading, setIsLoading]     = useState(true);

  const [subjectFilter,  setSubjectFilter]  = useState('All Subjects');
  const [timelineFilter, setTimelineFilter] = useState('All Time');
  const [customStart,    setCustomStart]    = useState('');
  const [customEnd,      setCustomEnd]      = useState('');

  const [modalData, setModalData] = useState<Assessment | null>(null);
  const [aiSummary, setAiSummary] = useState<any>(null);
  
  // 🚀 AI CACHE FIX: Stores previously generated summaries to prevent redundant API calls
  const [summaryCache, setSummaryCache] = useState<Record<number, any>>({});
  
  const [loadingAI, setLoadingAI] = useState(false);
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (!modalData) {
      setAiSummary(null);
      return;
    }

    // 🚀 CACHE FIX: Load from memory instantly if we already generated it!
    if (summaryCache[modalData.result_id]) {
      setAiSummary(summaryCache[modalData.result_id]);
      return;
    }

    const loadSummary = async () => {
      setLoadingAI(true);

      try {
        const response = await fetchAssessmentSummary({
          student_name: "Student", // You can dynamically pass the real student name here later
          subject: modalData.subject,
          test_name: modalData.title,
          marks_obtained: modalData.marks_obtained,
          total_marks: modalData.max_marks,
          teacher_remarks: "", 
        });

        console.log("Assessment Summary API Response:", response);

        const fetchedSummary = response.summary ?? response.ai_summary ?? response.result ?? response;
        
        setAiSummary(fetchedSummary);
        
        // Save to cache so it is instant next time!
        setSummaryCache(prev => ({ ...prev, [modalData.result_id]: fetchedSummary }));

      } catch (err) {
        console.error(err);
        setAiSummary(null);
      } finally {
        setLoadingAI(false);
      }
    };

    loadSummary();
  }, [modalData, summaryCache]);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!studentId) return;
    const load = async () => {
      setIsLoading(true);
      setModalData(null);
      setSubjectFilter('All Subjects');
      setTimelineFilter('All Time');
      setCustomStart('');
      setCustomEnd('');
      try {
        console.log('[SSS] Assessments: fetching for student_id', studentId);
        const data = await fetchAssessmentHistory(studentId);
        setAssessments(data ?? []);
      } catch (e) {
        console.error('[SSS] Assessments: failed to load', e);
        setAssessments([]);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [studentId]);

  // ── Derived subjects list ──────────────────────────────────────────────────

  const subjects = useMemo(
    () => [
      'All Subjects',
      ...Array.from(new Set(assessments.map(a => normalizeSubject(a.subject)))),
    ],
    [assessments],
  );

  // ── Client-side filter ────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    return assessments.filter(a => {
      if (subjectFilter !== 'All Subjects' && normalizeSubject(a.subject) !== subjectFilter) return false;
      if (timelineFilter === 'All Time') return true;
      if (!a.date_iso) return true;

      const d   = new Date(a.date_iso);
      const now = new Date();
      const yr  = now.getFullYear();
      const mo  = now.getMonth(); // 0-indexed

      if (timelineFilter === 'Current Academic Year') {
        // Indian academic year: April → March
        const startYr   = mo >= 3 ? yr : yr - 1;
        const startDate = new Date(startYr, 3, 1); // 1 Apr
        return d >= startDate;
      }

      const monthIdx = MONTH_NAMES.indexOf(timelineFilter);
      if (monthIdx !== -1) {
        return d.getFullYear() === yr && d.getMonth() === monthIdx;
      }

      if (QUARTERS[timelineFilter]) {
        return QUARTERS[timelineFilter].includes(d.getMonth());
      }

      if (timelineFilter === 'Custom Date Range') {
        if (customStart && d < new Date(customStart)) return false;
        if (customEnd   && d > new Date(customEnd + 'T23:59:59')) return false;
        return true;
      }

      return true;
    });
  }, [assessments, subjectFilter, timelineFilter, customStart, customEnd]);

  // ── Summary cards ─────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    if (!filtered.length) return { total: 0, avg: 0, highest: 0, lowest: 0 };
    const pcts = filtered.map(a => a.percentage);
    return {
      total:   filtered.length,
      avg:     pcts.reduce((s, v) => s + v, 0) / pcts.length,
      highest: Math.max(...pcts),
      lowest:  Math.min(...pcts),
    };
  }, [filtered]);

  const stopAudio = () => {
  if (audio) {
    audio.pause();
    audio.currentTime = 0;
    setAudio(null);
    setIsPlaying(false);
  }
};

  // ── Chart data ────────────────────────────────────────────────────────────

  const trendData = useMemo(
    () =>
      [...filtered]
        .sort((a, b) => a.date_iso.localeCompare(b.date_iso))
        .map(a => ({ label: a.assessment_date, percentage: a.percentage })),
    [filtered],
  );

  const subjectData = useMemo(() => {
    const map: Record<string, number[]> = {};
    for (const a of filtered) {
      const subject = normalizeSubject(a.subject);
      (map[subject] = map[subject] ?? []).push(a.percentage);
    }
    return Object.entries(map).map(([subject, vals]) => ({
      subject,
      avg_percentage: Math.round(vals.reduce((s, v) => s + v, 0) / vals.length),
    }));
  }, [filtered]);

  // ── Render ────────────────────────────────────────────────────────────────

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

      <div className="flex-1 p-4 md:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-6">

          {/* ── HEADER ────────────────────────────────────────────────────── */}
          <div>
          <h1 className="text-3xl font-black text-white leading-tight">Assessments</h1>
            <p className="text-sm font-medium text-slate-400 mt-1">
            {t.subtitle}
            </p>
          </div>

          {/* ── FILTER BAR ────────────────────────────────────────────────── */}
          <div className="bg-white/5 rounded-xl border border-white/10 p-3 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              {/* Subject filter */}
              <select
                value={subjectFilter}
                onChange={e => setSubjectFilter(e.target.value)}
                 className="bg-slate-800 border border-white/10 text-white text-sm font-semibold rounded-lg px-3 py-2 outline-none min-w-[160px]"
              >
                {subjects.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>

              {/* Timeline filter */}
              <select
                value={timelineFilter}
                onChange={e => { setTimelineFilter(e.target.value); setCustomStart(''); setCustomEnd(''); }}
                 className="bg-slate-800 border border-white/10 text-white text-sm font-semibold rounded-lg px-3 py-2 outline-none min-w-[200px]"
              >
                {TIMELINE_OPTIONS.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>

              {filtered.length > 0 && (
                 <span className="text-xs font-semibold text-slate-400 ml-auto">
                  {filtered.length} result{filtered.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            {/* Custom date range inputs */}
            {timelineFilter === 'Custom Date Range' && (
              <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-white/10">
                <div className="flex items-center gap-2">
                   <label className="text-xs font-bold text-slate-400 whitespace-nowrap">From</label>
                  <input
                    type="date"
                    value={customStart}
                    onChange={e => setCustomStart(e.target.value)}
                    className="bg-slate-800 border border-white/10 text-white text-sm font-semibold rounded-lg px-3 py-2 outline-none"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-slate-400 whitespace-nowrap">To</label>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={e => setCustomEnd(e.target.value)}
                    className="bg-slate-800 border border-white/10 text-white text-sm font-semibold rounded-lg px-3 py-2 outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* ── LOADING ───────────────────────────────────────────────────── */}
          {isLoading ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[0, 1, 2, 3].map(i => <SkeletonCard key={i} />)}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[0, 1, 2].map(i => <SkeletonAssessmentCard key={i} />)}
              </div>
            </>
          ) : (
            <>
              {/* ── SUMMARY CARDS ──────────────────────────────────────────── */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard
                  label={t.totalAssessments}
                  value={stats.total.toString()}
                  sub={t.completed}
                />
                <StatCard
                  label={t.averagePercentage}
                  value={`${stats.avg.toFixed(1)}%`}
                  sub={t.overallPerformance}
                />
                <StatCard
                  label={t.highestScore}
                  value={`${stats.highest}%`}
                  sub={t.topResult}
                />
                <StatCard
                  label={t.lowestScore}
                  value={`${stats.lowest}%`}
                  sub={t.needsFocus}
                />
              </div>

              {/* ── CHARTS ────────────────────────────────────────────────── */}
              {filtered.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                  {/* Chart 1 — Performance Trend */}
                  <div className="bg-white/5 rounded-2xl border border-white/10 p-5">
                    <p className="text-xs font-black uppercase tracking-wider text-slate-400 mb-1">
                      Performance Trend
                    </p>
                    <p className="text-sm font-bold text-slate-300 mb-4">
                      {t.percentageOverTime}
                    </p>
                    <div style={{ height: 240 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={trendData}
                          margin={{ top: 5, right: 10, left: -20, bottom: 40 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                          <XAxis
                            dataKey="label"
                            tick={{ fontSize: 10, fill: '#94A3B8', fontWeight: 600 }}
                            angle={-40}
                            textAnchor="end"
                            interval="preserveStartEnd"
                          />
                          <YAxis
                            domain={[0, 100]}
                            tick={{ fontSize: 10, fill: '#94A3B8', fontWeight: 600 }}
                            tickFormatter={(v: number) => `${v}%`}
                          />
                          <Tooltip
                            formatter={(v: unknown) => [`${v ?? 0}%`, 'Percentage']}
                            contentStyle={{
                              border: '1px solid rgba(255,255,255,0.1)',
                              background: '#1e293b',
                              color: '#f1f5f9',
                              fontWeight: 600,
                            }}
                          />
                          <Line
                            type="monotone"
                            dataKey="percentage"
                            stroke="#EA580C"
                            strokeWidth={2.5}
                            dot={{ r: 4, fill: '#EA580C', strokeWidth: 0 }}
                            activeDot={{ r: 6 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Chart 2 — Subject-wise Performance */}
                  <div className="bg-white/5 rounded-2xl border border-white/10 p-5">
                    <p className="text-xs font-black uppercase tracking-wider text-slate-400 mb-1">
                      {t.subjectWisePerformance}
                    </p>
                    <p className="text-sm font-bold text-slate-300 mb-4">
                      {t.averagePercentageBySubject}
                    </p>
                    {subjectData.length > 0 ? (
                      <div style={{ height: 240 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={subjectData}
                              dataKey="avg_percentage"
                              nameKey="subject"
                              cx="50%"
                              cy="50%"
                              outerRadius={80}
                              // eslint-disable-next-line @typescript-eslint/no-explicit-any
                              label={((p: any) => `${p.name ?? ''} ${p.value ?? 0}%`) as any}
                              labelLine={{ stroke: '#D1D5DB' }}
                            >
                              {subjectData.map((_, i) => (
                                <Cell
                                  key={i}
                                  fill={PIE_COLORS[i % PIE_COLORS.length]}
                                />
                              ))}
                            </Pie>
                            <Tooltip
                              formatter={(v: unknown) => [`${v ?? 0}%`, 'Avg %']}
                              contentStyle={{
                                borderRadius: 12,
                                border: '1px solid rgba(255,255,255,0.1)',
                                background: '#1e293b',
                                color: '#f1f5f9',
                                fontSize: 12,
                                fontWeight: 600,
                              }}
                            />
                            <Legend
                              iconType="circle"
                              iconSize={8}
                              wrapperStyle={{ fontSize: 11, fontWeight: 600, color: '#94A3B8' }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                     <div className="h-60 flex items-center justify-center text-slate-400 text-sm font-semibold">
                        {t.noDataForFilters}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── ASSESSMENT CARDS ──────────────────────────────────────── */}
              {filtered.length === 0 ? (
                  <div className="py-20 text-center bg-white/5 rounded-2xl border border-white/10 border-dashed">
                  <p className="text-4xl mb-3">📋</p>
                  <p className="text-white font-bold"> {t.noAssessments}</p>
                  <p className="text-slate-400 text-sm mt-1">
                    {t.adjustFilters}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {filtered.map(a => {
                    const c = statusColor(a.performance_badge);
                    return (
                      <div
                        key={a.result_id}
                       className="bg-white/5 rounded-2xl border border-white/10 p-5 hover:bg-white/10 transition-all flex items-start gap-4"
                      >
                        <CircularProgress pct={a.percentage} colorHex={c.hex} />

                        <div className="flex-1 min-w-0">
                          {/* Subject + type */}
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <p
                              className="text-xs font-black uppercase tracking-wider"
                              style={{ color: c.hex }}
                            >
                              {normalizeSubject(a.subject)}
                            </p>
                            <span className="text-[10px] font-bold text-slate-400 bg-white/10 px-2 py-0.5 rounded-md">
                              {a.assessment_type}
                            </span>
                          </div>

                          {/* Title */}
                          <h3 className="text-base font-black text-white leading-snug line-clamp-2 mb-1">
                            {a.title}
                          </h3>

                          {/* Chapter */}
                           <p className="text-xs text-slate-400 font-semibold truncate mb-2">
                            📖 {a.chapter_name}
                          </p>

                          {/* Teacher + Date */}
                          <div className="flex flex-wrap items-center gap-2 mb-3">
                           <p className="text-xs font-bold text-slate-400">
                              👤 {a.teacher_name}
                            </p>
                             <span className="text-slate-600">·</span>
                            <p className="text-xs font-bold text-slate-400">
                              {a.assessment_date}
                            </p>
                          </div>

                          {/* Marks row */}
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className="text-[10px] font-black px-2 py-1 rounded-lg"
                              style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}
                            >
                              {a.performance_badge}
                            </span>
                             <span className="text-xs font-bold text-slate-400 bg-white/10 px-2 py-0.5 rounded-md shrink-0">
                              {a.marks_obtained} / {a.max_marks}
                            </span>
                          </div>

                          {/* View Details */}
                          <button
                            onClick={() => setModalData(a)}
                            className="mt-3 w-full text-xs font-bold py-2 rounded-xl border border-white/10 text-slate-300 hover:bg-orange-500/10 hover:border-orange-500/40 hover:text-orange-400 transition-colors"
                          >
                            {t.viewDetails}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── DETAIL MODAL ──────────────────────────────────────────────────── */}
      {modalData && (() => {
        const c = statusColor(modalData.performance_badge);
        return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            onClick={() => {
              stopAudio();
              setModalData(null);
            }}
          >
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm z-[100]" />
            <div
               className="relative bg-slate-800 rounded-3xl shadow-2xl flex flex-col w-full max-w-lg overflow-hidden z-[110] border border-white/10"
              onClick={e => e.stopPropagation()}
            >
              {/* Modal header controls */}
              <div className="shrink-0 p-6 pb-0 flex justify-between items-start">
                 <div className="w-10 h-10 rounded-full flex items-center justify-center text-xl bg-white/10">
                 📝
                </div>
                <button
                  onClick={() => {
                    stopAudio();
                    setModalData(null);
                  }}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-white/10 hover:text-white transition-colors text-xl font-bold"
                >
                  ×
                </button>
              </div>

              {/* Title block */}
               <div className="px-6 py-4 border-b border-white/10">
                <h2 className="text-2xl font-black text-white leading-tight">
                  {modalData.title}
                </h2>
               <p className="text-sm font-bold text-slate-400 mt-1">
                  {modalData.assessment_type} · {modalData.assessment_date}
                </p>
              </div>

              {/* Scrollable body */}
              <div className="p-6 space-y-5 overflow-y-auto max-h-[65vh]">

                {/* Result block */}
                <div
                  className="flex items-center gap-5 p-4 rounded-2xl"
                  style={{ background: c.bg, border: `1px solid ${c.border}` }}
                >
                  <CircularProgress pct={modalData.percentage} colorHex={c.hex} />
                  <div>
                    <p className="text-xs font-black uppercase tracking-wider" style={{ color: c.hex }}>
                      {modalData.performance_badge}
                    </p>
                    <p className="text-sm font-bold mt-1" style={{ color: c.text }}>
                      {modalData.marks_obtained} out of {modalData.max_marks} marks
                    </p>
                  </div>
                </div>

                {/* Assessment details grid */}
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-3">
                    {t.assessmentInformation}
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: t.subject,        value: normalizeSubject(modalData.subject) },
                      { label: t.chapter,        value: modalData.chapter_name },
                      { label: t.teacher,        value: modalData.teacher_name },
                      { label: t.assessmentType, value: modalData.assessment_type },
                      { label: t.date,           value: modalData.assessment_date },
                      { label: t.maxMarks,      value: String(modalData.max_marks) },
                    ].map(({ label, value }) => (
                     <div key={label} className="p-3 bg-white/5 rounded-xl border border-white/10">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                          {label}
                        </p>
                         <p className="text-sm font-bold text-white leading-snug">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* ── AI PERFORMANCE SUMMARY ─────────────────────────────── */}
                <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4">

                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">✨</span>
                      <p className="text-sm font-black text-orange-700">
                        {t.aiPerformanceSummary}
                      </p>
                    </div>

                    {/* AI Actions */}
                    {aiSummary && (
                      <div className="flex items-center gap-2">

                        {/* Translate */}
                        <button
                          onClick={async () => {
                            try {
                              // 🚀 FIX: Concurrent translation for all fields instantly!
                              const [perfRes, encRes, tipsRes] = await Promise.all([
                                translateText(aiSummary.performance_breakdown || "", language),
                                translateText(aiSummary.encouraging_feedback || "", language),
                                translateText(
                                  Array.isArray(aiSummary.home_support_tips) 
                                    ? aiSummary.home_support_tips.join(" ") 
                                    : (aiSummary.home_support_tips || ""), 
                                  language
                                )
                              ]);

                              const translatedSummary = {
                                ...aiSummary,
                                performance_breakdown: perfRes.translated_text,
                                encouraging_feedback: encRes.translated_text,
                                home_support_tips: tipsRes.translated_text,
                              };

                              setAiSummary(translatedSummary);
                              
                              // Save the translated version back to the cache!
                              if (modalData?.result_id) {
                                setSummaryCache(prev => ({
                                  ...prev,
                                  [modalData.result_id]: translatedSummary
                                }));
                              }

                            } catch (error) {
                              console.error(error);
                            }
                          }}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold border border-orange-200 bg-white text-orange-700 hover:bg-orange-100 transition-colors"
                        >
                          🌐 Translate
                        </button>

                        {/* Listen */}
                        <button
                          onClick={async () => {
                            try {
                              stopAudio();

                              // 🚀 FIX: Pure string without English labels to prevent robotic TTS glitches
                              const summaryText = `
                                ${aiSummary.summary_title ?? ''}.
                                ${aiSummary.performance_breakdown ?? ''}.
                                ${aiSummary.encouraging_feedback ?? ''}.
                                ${Array.isArray(aiSummary.home_support_tips) ? aiSummary.home_support_tips.join(". ") : (aiSummary.home_support_tips ?? '')}
                              `.trim();

                              const audioResponse = await textToVoice(summaryText, language);
                              
                              // Create Object URL from the returned Blob
                              const audioUrl = URL.createObjectURL(audioResponse);
                              const newAudio = new Audio(audioUrl);

                              newAudio.onended = () => {
                                URL.revokeObjectURL(audioUrl);
                                setAudio(null);
                                setIsPlaying(false);
                              };

                              setAudio(newAudio);
                              setIsPlaying(true);
                              await newAudio.play();

                            } catch (error) {
                              console.error("Assessment summary voice generation failed:", error);
                            }
                          }}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold border border-orange-200 bg-white text-orange-700 hover:bg-orange-100 transition-colors"
                        >
                          🔊 Listen
                        </button>

                        {/* Stop */}
                        {isPlaying && (
                          <button
                            onClick={stopAudio}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold border border-red-200 bg-white text-red-700 hover:bg-red-100 transition-colors"
                          >
                            ⏹ Stop
                          </button>
                        )}

                      </div>
                    )}
                  </div>

                  {/* Loading */}
                  {loadingAI ? (
                    <div className="py-4">
                      <p className="text-sm font-semibold text-gray-500">
                        ✨ Generating AI summary...
                      </p>
                    </div>
                  ) : aiSummary ? (
                    <div className="space-y-4">

                      {/* Summary Title */}
                      {aiSummary.summary_title && (
                        <div>
                          <h4 className="font-black text-orange-700">
                            {aiSummary.summary_title}
                          </h4>
                        </div>
                      )}

                      {/* Performance */}
                      {aiSummary.performance_breakdown && (
                        <div>
                          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                            {t.performance}
                          </p>
                          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap mt-1">
                            {aiSummary.performance_breakdown}
                          </p>
                        </div>
                      )}

                      {/* Encouragement */}
                      {aiSummary.encouraging_feedback && (
                        <div>
                          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                            {t.encouragement}
                          </p>
                          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap mt-1">
                            {aiSummary.encouraging_feedback}
                          </p>
                        </div>
                      )}

                      {/* Home Support */}
                      {aiSummary.home_support_tips && (
                        <div>
                          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                            {t.homeSupportTips}
                          </p>
                          
                          {/* 🚀 FIX: Safely map arrays to a nice bulleted list to prevent React crashes */}
                          <div className="text-sm text-gray-700 leading-relaxed mt-1">
                            {Array.isArray(aiSummary.home_support_tips) ? (
                              <ul className="list-disc pl-5 space-y-1">
                                {aiSummary.home_support_tips.map((tip: string, idx: number) => (
                                  <li key={idx}>{tip}</li>
                                ))}
                              </ul>
                            ) : (
                              <p className="whitespace-pre-wrap">{aiSummary.home_support_tips}</p>
                            )}
                          </div>
                          
                        </div>
                      )}

                    </div>
                  ) : (
                    <div className="py-3">
                      <p className="text-sm text-gray-500">
                        {t.noAISummary}
                      </p>
                    </div>
                  )}

                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}