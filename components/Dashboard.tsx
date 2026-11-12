'use client';
import { useMemo, useState, useEffect, useCallback } from 'react';
import type { GasResponse, StatusBucket, Ticket } from '@/lib/types';
import { Header } from './Header';
import { FilterBar } from './FilterBar';
import { KanbanBoard } from './KanbanBoard';
import { ListView } from './ListView';
import { CustomerView } from './CustomerView';
import { Footer } from './Footer';
import { useAutoRefresh } from './useAutoRefresh';

const AUTO_REFRESH_MS = 2 * 60 * 1000; // 2분 — 백엔드 10분 sync에 맞춰 적정

const COLUMN_META: { key: StatusBucket; label: string; dotClass: string }[] = [
  { key: 'open', label: '접수', dotClass: 'bg-slate-400' },
  { key: 'inProgress', label: '작업 중', dotClass: 'bg-blue-600 animate-pulse' },
  { key: 'done', label: '완료', dotClass: 'bg-emerald-500' },
  { key: 'closed', label: '종료', dotClass: 'bg-slate-500' },
  { key: 'rejected', label: '반영불가', dotClass: 'bg-rose-400' },
];

type ViewMode = 'customer' | 'kanban' | 'list';
type FilterKey = 'all' | 'customerRequested' | 'internalRequested' | 'unassigned' | 'stale' | 'highDemand' | string; // string = area

const STALE_DAYS = 14;
const HIGH_DEMAND_REQUESTS = 3;

export function isStale(t: Ticket): boolean {
  if (t.statusBucket !== 'open' && t.statusBucket !== 'inProgress') return false;
  if (!t.firstReported) return false;
  const normalized = t.firstReported.includes('T') ? t.firstReported : t.firstReported.replace(' ', 'T') + '+09:00';
  const d = new Date(normalized);
  if (isNaN(d.getTime())) return false;
  const days = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24);
  return days >= STALE_DAYS;
}

export function isUnassigned(t: Ticket): boolean {
  return !t.assignee && (t.statusBucket === 'open' || t.statusBucket === 'inProgress');
}

export function isHighDemand(t: Ticket): boolean {
  return t.requestCount >= HIGH_DEMAND_REQUESTS && (t.statusBucket === 'open' || t.statusBucket === 'inProgress');
}

export function isCustomerRequested(t: Ticket): boolean {
  // 백엔드가 계산한 통합 플래그 우선 (고객사 필드 + 고객 대응 Slack 채널)
  if (t.customerSourced === true) return true;
  // Fallback: 플래그가 없거나 false면 customers 배열로만 판단 (하위 호환)
  return Array.isArray(t.customers) && t.customers.length > 0;
}

export function isInternalRequested(t: Ticket): boolean {
  return !isCustomerRequested(t);
}

export function Dashboard({ initialData }: { initialData: GasResponse }) {
  const [data, setData] = useState<GasResponse>(initialData);
  const [loading, setLoading] = useState(false);
  // 기본: 칸반 뷰 (기존 레이아웃 유지)
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [filter, setFilter] = useState<FilterKey>('all');
  // 다중 선택. 빈 배열이면 "선택 없음 = 전체".
  const [customerFilters, setCustomerFilters] = useState<string[]>([]);
  const [reporterFilters, setReporterFilters] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState<boolean>(true);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<number>(() => Date.now());

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/tickets', { cache: 'no-store' });
      const next = (await res.json()) as GasResponse;
      setData(next);
      setLastRefreshedAt(Date.now());
    } finally {
      setLoading(false);
    }
  }, []);

  const { secondsUntilNext, pausedByVisibility } = useAutoRefresh({
    intervalMs: AUTO_REFRESH_MS,
    enabled: autoRefreshEnabled,
    onRefresh: refresh,
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === '/') {
        e.preventDefault();
        const inp = document.getElementById('ticket-search') as HTMLInputElement | null;
        inp?.focus();
      } else if (e.key === 'r' && !e.metaKey && !e.ctrlKey) {
        refresh();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [refresh]);

  // 요청자 리스트에서 담당자 본인은 제외 — "요청자"는 "외부 요청 전달자"로 좁혀 정의.
  // 담당자 이름이 "홍길동"이고 요청자가 "홍길동 (고객-문의)"일 때, 괄호 접미사(채널명)를
  // 제거한 바탕 이름이 담당자와 같으면 외부 요청자가 아니라고 판단하여 제외.
  const tickets = useMemo(() => {
    const raw = data.tickets || [];
    const assignees = new Set<string>();
    raw.forEach((t) => { if (t.assignee) assignees.add(t.assignee); });
    const stripSuffix = (name: string) => name.replace(/\s*\([^)]*\)\s*$/, '').trim();
    return raw.map((t) => ({
      ...t,
      reporters: (t.reporters || []).filter((r) => {
        if (!r) return false;
        const bare = stripSuffix(r);
        return !assignees.has(bare) && !assignees.has(r);
      }),
    }));
  }, [data]);

  const areas = useMemo(() => {
    const s = new Set<string>();
    tickets.forEach((t) => t.area && s.add(t.area));
    return Array.from(s).sort();
  }, [tickets]);

  const customers = useMemo(() => {
    const s = new Set<string>();
    tickets.forEach((t) => t.customers.forEach((c) => s.add(c)));
    return Array.from(s).sort();
  }, [tickets]);

  const reporters = useMemo(() => {
    const s = new Set<string>();
    tickets.forEach((t) => (t.reporters || []).forEach((r) => r && s.add(r)));
    return Array.from(s).sort();
  }, [tickets]);

  // 각 고객사·요청자별 티켓 수 — 드롭다운에서 보여줌.
  const customerCounts = useMemo(() => {
    const m: Record<string, number> = {};
    tickets.forEach((t) => t.customers.forEach((c) => { m[c] = (m[c] || 0) + 1; }));
    return m;
  }, [tickets]);

  const reporterCounts = useMemo(() => {
    const m: Record<string, number> = {};
    tickets.forEach((t) => (t.reporters || []).forEach((r) => { if (r) m[r] = (m[r] || 0) + 1; }));
    return m;
  }, [tickets]);

  // 데이터 갱신 시 사라진 항목을 자동 선택 해제. 참조가 같으면 리렌더 방지.
  useEffect(() => {
    setCustomerFilters((prev) => {
      const next = prev.filter((c) => customers.includes(c));
      return next.length === prev.length ? prev : next;
    });
  }, [customers]);

  useEffect(() => {
    setReporterFilters((prev) => {
      const next = prev.filter((r) => reporters.includes(r));
      return next.length === prev.length ? prev : next;
    });
  }, [reporters]);

  const filtered = useMemo(() => {
    let out = tickets;
    // 고객사 다중선택 — 선택된 중 하나라도 매칭(OR), 필터 간에는 AND
    if (customerFilters.length > 0) {
      out = out.filter((t) => t.customers.some((c) => customerFilters.includes(c)));
    }
    // 요청자 다중선택 — 선택된 중 하나라도 매칭(OR), 필터 간에는 AND
    if (reporterFilters.length > 0) {
      out = out.filter((t) => (t.reporters || []).some((r) => reporterFilters.includes(r)));
    }
    // Status/badge 필터
    if (filter === 'customerRequested') out = out.filter(isCustomerRequested);
    else if (filter === 'internalRequested') out = out.filter(isInternalRequested);
    else if (filter === 'unassigned') out = out.filter(isUnassigned);
    else if (filter === 'stale') out = out.filter(isStale);
    else if (filter === 'highDemand') out = out.filter(isHighDemand);
    else if (filter !== 'all') out = out.filter((t) => t.area === filter);
    // 검색어
    const q = query.trim().toLowerCase();
    if (q) {
      out = out.filter(
        (t) =>
          t.jiraKey.toLowerCase().includes(q) ||
          t.title.toLowerCase().includes(q) ||
          (t.assignee || '').toLowerCase().includes(q) ||
          (t.area || '').toLowerCase().includes(q) ||
          t.customers.some((c) => c.toLowerCase().includes(q)) ||
          (t.reporters || []).some((r) => r.toLowerCase().includes(q)),
      );
    }
    return out;
  }, [tickets, filter, customerFilters, reporterFilters, query]);

  const byBucket = useMemo(() => {
    const g: Record<StatusBucket, Ticket[]> = { open: [], inProgress: [], done: [], closed: [], rejected: [] };
    filtered.forEach((t) => g[t.statusBucket]?.push(t));
    return g;
  }, [filtered]);

  const counts = useMemo(() => ({
    all: tickets.length,
    customerRequested: tickets.filter(isCustomerRequested).length,
    internalRequested: tickets.filter(isInternalRequested).length,
    unassigned: tickets.filter(isUnassigned).length,
    stale: tickets.filter(isStale).length,
    highDemand: tickets.filter(isHighDemand).length,
    inProgress: tickets.filter((t) => t.statusBucket === 'inProgress').length,
    done: tickets.filter((t) => t.statusBucket === 'done').length,
    closed: tickets.filter((t) => t.statusBucket === 'closed').length,
    open: tickets.filter((t) => t.statusBucket === 'open').length,
    rejected: tickets.filter((t) => t.statusBucket === 'rejected').length,
    totalRequests: tickets.reduce((s, t) => s + (t.requestCount || 0), 0),
    customers: customers.length,
    reporters: reporters.length,
  }), [tickets, customers.length, reporters.length]);

  if (!data.ok) {
    return (
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-md bg-white border border-rose-200 rounded-xl p-6 text-center shadow-sm">
          <h1 className="text-lg font-bold text-rose-700 mb-2">데이터를 불러오지 못했습니다</h1>
          <p className="text-sm text-slate-600 mb-4">{data.error || 'GAS 응답 오류'}</p>
          <p className="text-xs text-slate-500">
            Vercel 환경변수 <code className="bg-slate-100 px-1 rounded">GAS_WEBAPP_URL</code>이 올바르게 설정됐는지 확인하세요.
          </p>
        </div>
      </main>
    );
  }

  return (
    <>
      <Header
        totalTickets={counts.all}
        open={counts.open}
        inProgress={counts.inProgress}
        done={counts.done}
        closed={counts.closed}
        rejected={counts.rejected}
        totalRequests={counts.totalRequests}
        customerCount={counts.customers}
        reporterCount={counts.reporters}
        query={query}
        onQueryChange={setQuery}
        onRefresh={refresh}
        loading={loading}
        generatedAt={data.generatedAt || ''}
      />
      <FilterBar
        filter={filter}
        onFilterChange={setFilter}
        counts={counts}
        areas={areas}
        customers={customers}
        customerFilters={customerFilters}
        onCustomerFiltersChange={setCustomerFilters}
        customerCounts={customerCounts}
        reporters={reporters}
        reporterFilters={reporterFilters}
        onReporterFiltersChange={setReporterFilters}
        reporterCounts={reporterCounts}
        viewMode={viewMode}
        onViewChange={setViewMode}
      />
      <main className="flex-1 max-w-[1400px] w-full mx-auto p-6 overflow-hidden flex flex-col">
        {data.unknownJiraStatuses && data.unknownJiraStatuses.length > 0 && (
          <div className="mb-4 flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
            <span className="material-symbols-outlined text-amber-600 text-[20px] shrink-0 mt-0.5">warning</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-900">
                매핑되지 않은 Jira 상태가 발견됐어요 — 일단 "접수" 버킷으로 표시됩니다
              </p>
              <p className="text-xs text-amber-800 mt-0.5">
                패턴 매칭에도 걸리지 않은 신규/희귀 상태:
                {data.unknownJiraStatuses.map((s) => (
                  <code key={s} className="ml-1.5 px-1.5 py-0.5 bg-white border border-amber-200 rounded text-amber-900 font-mono">{s}</code>
                ))}
              </p>
              <p className="text-[11px] text-amber-700 mt-1">
                정확한 분류를 원하면 백엔드 <code className="bg-white px-1 rounded">classifyJiraStatus</code> 함수에 추가해 주세요.
              </p>
            </div>
          </div>
        )}
        {(customerFilters.length > 0 || reporterFilters.length > 0) && (
          <div className="mb-4 flex items-start gap-2 flex-wrap px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-xl">
            <span className="text-xs font-semibold text-slate-600 shrink-0 pt-1">필터 적용 중:</span>
            <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
              {customerFilters.map((c) => (
                <span key={`c-${c}`} className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-blue-300 text-blue-700 text-xs font-semibold rounded-md shadow-sm">
                  <span className="material-symbols-outlined text-[14px]">store</span>
                  <span>{c}</span>
                  <button
                    onClick={() => setCustomerFilters((prev) => prev.filter((x) => x !== c))}
                    className="ml-1 w-4 h-4 rounded-full hover:bg-blue-100 flex items-center justify-center"
                    title={`${c} 해제`}
                  >
                    <span className="material-symbols-outlined text-[12px]">close</span>
                  </button>
                </span>
              ))}
              {reporterFilters.map((r) => (
                <span key={`r-${r}`} className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-indigo-300 text-indigo-700 text-xs font-semibold rounded-md shadow-sm">
                  <span className="material-symbols-outlined text-[14px]">person</span>
                  <span>{r}</span>
                  <button
                    onClick={() => setReporterFilters((prev) => prev.filter((x) => x !== r))}
                    className="ml-1 w-4 h-4 rounded-full hover:bg-indigo-100 flex items-center justify-center"
                    title={`${r} 해제`}
                  >
                    <span className="material-symbols-outlined text-[12px]">close</span>
                  </button>
                </span>
              ))}
            </div>
            <span className="text-xs text-slate-500 shrink-0 pt-1">
              <strong className="text-slate-800">{filtered.length}건</strong>
            </span>
            <button
              onClick={() => { setCustomerFilters([]); setReporterFilters([]); }}
              className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors"
            >
              모든 필터 해제
            </button>
          </div>
        )}
        {viewMode === 'customer' ? (
          <CustomerView
            tickets={filtered}
            onDrillDown={(customer) => {
              setCustomerFilters([customer]);
              setReporterFilters([]);
              setViewMode('kanban');
            }}
            onDrillDownReporter={(reporter) => {
              setReporterFilters([reporter]);
              setCustomerFilters([]);
              setViewMode('kanban');
            }}
          />
        ) : viewMode === 'kanban' ? (
          <KanbanBoard columns={COLUMN_META} byBucket={byBucket} />
        ) : (
          <ListView tickets={filtered} />
        )}
      </main>
      <Footer
        generatedAt={data.generatedAt || ''}
        totalTickets={counts.all}
        autoRefreshEnabled={autoRefreshEnabled}
        onToggleAutoRefresh={() => setAutoRefreshEnabled((v) => !v)}
        secondsUntilNext={secondsUntilNext}
        pausedByVisibility={pausedByVisibility}
        lastRefreshedAt={lastRefreshedAt}
        intervalMs={AUTO_REFRESH_MS}
      />
    </>
  );
}
