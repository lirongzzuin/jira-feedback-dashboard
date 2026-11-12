'use client';
import { useMemo, useState } from 'react';
import type { StatusBucket, Ticket } from '@/lib/types';

interface Props {
  tickets: Ticket[];
  onDrillDown: (customer: string) => void;
  onDrillDownReporter?: (reporter: string) => void;
}

interface CustomerSummary {
  name: string;
  tickets: Ticket[];
  totalCount: number;
  activeCount: number;
  closedCount: number;
  statusCounts: Record<StatusBucket, number>;
  unassignedCount: number;
  totalRequests: number;    // Slack 요청 합
  oldestOpenDays: number;   // 활성 티켓 중 가장 오래된 경과일
  lastActivityDays: number | null;
  areas: { name: string; count: number }[];
  reporters: { name: string; count: number }[];  // 그 고객사 티켓을 요청한 사람 목록 + 횟수
}

type SortKey = 'name' | 'total' | 'active' | 'open' | 'inProgress' | 'done' | 'closed' | 'rejected' | 'unassigned' | 'oldest' | 'requests' | 'lastActivity';
type SortDir = 'asc' | 'desc';

function daysSince(iso: string): number | null {
  if (!iso) return null;
  const normalized = iso.includes('T') ? iso : iso.replace(' ', 'T') + '+09:00';
  const d = new Date(normalized);
  if (isNaN(d.getTime())) return null;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24)));
}

function initials(name: string): string {
  return name ? name.trim().charAt(0) : '?';
}

export function CustomerView({ tickets, onDrillDown, onDrillDownReporter }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('active');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // 고객사 요청 티켓만 대상 — customers 비어있는 티켓(내부 발의)은 제외.
  // 필터바 "고객사 요청 N건" 과 완전 일치를 위해.
  const customerRequestedTickets = useMemo(
    () => tickets.filter((t) => Array.isArray(t.customers) && t.customers.length > 0),
    [tickets],
  );

  const summaries = useMemo<CustomerSummary[]>(() => {
    const byCustomer: Record<string, Ticket[]> = {};
    for (const t of customerRequestedTickets) {
      for (const c of t.customers) {
        if (!byCustomer[c]) byCustomer[c] = [];
        byCustomer[c].push(t);
      }
    }

    return Object.entries(byCustomer).map(([name, items]) => {
      const statusCounts: Record<StatusBucket, number> = { open: 0, inProgress: 0, done: 0, closed: 0, rejected: 0 };
      let unassigned = 0, totalReq = 0, oldestOpen = 0, lastActivity: number | null = null;
      const areaCounts: Record<string, number> = {};
      const reporterCounts: Record<string, number> = {};
      for (const t of items) {
        statusCounts[t.statusBucket]++;
        if (!t.assignee && (t.statusBucket === 'open' || t.statusBucket === 'inProgress')) unassigned++;
        totalReq += t.requestCount || 0;
        if (t.area) areaCounts[t.area] = (areaCounts[t.area] || 0) + 1;
        (t.reporters || []).forEach((r) => { if (r) reporterCounts[r] = (reporterCounts[r] || 0) + 1; });
        if (t.statusBucket === 'open' || t.statusBucket === 'inProgress') {
          const age = daysSince(t.firstReported);
          if (age !== null && age > oldestOpen) oldestOpen = age;
        }
        const last = daysSince(t.lastUpdated || t.firstReported);
        if (last !== null && (lastActivity === null || last < lastActivity)) lastActivity = last;
      }
      const activeCount = statusCounts.open + statusCounts.inProgress;
      const closedCount = statusCounts.done + statusCounts.closed + statusCounts.rejected;
      const areas = Object.entries(areaCounts).map(([k, v]) => ({ name: k, count: v })).sort((a, b) => b.count - a.count);
      const reporters = Object.entries(reporterCounts).map(([k, v]) => ({ name: k, count: v })).sort((a, b) => b.count - a.count);
      return {
        name, tickets: items,
        totalCount: items.length, activeCount, closedCount, statusCounts,
        unassignedCount: unassigned, totalRequests: totalReq,
        oldestOpenDays: oldestOpen, lastActivityDays: lastActivity, areas, reporters,
      };
    });
  }, [customerRequestedTickets]);

  const sorted = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    const arr = [...summaries];
    arr.sort((a, b) => {
      switch (sortKey) {
        case 'name': return a.name.localeCompare(b.name, 'ko') * dir;
        case 'total': return (a.totalCount - b.totalCount) * dir;
        case 'active': return (a.activeCount - b.activeCount) * dir;
        case 'open': return (a.statusCounts.open - b.statusCounts.open) * dir;
        case 'inProgress': return (a.statusCounts.inProgress - b.statusCounts.inProgress) * dir;
        case 'done': return (a.statusCounts.done - b.statusCounts.done) * dir;
        case 'closed': return (a.statusCounts.closed - b.statusCounts.closed) * dir;
        case 'rejected': return (a.statusCounts.rejected - b.statusCounts.rejected) * dir;
        case 'unassigned': return (a.unassignedCount - b.unassignedCount) * dir;
        case 'oldest': return (a.oldestOpenDays - b.oldestOpenDays) * dir;
        case 'requests': return (a.totalRequests - b.totalRequests) * dir;
        case 'lastActivity': {
          const av = a.lastActivityDays ?? Number.MAX_SAFE_INTEGER;
          const bv = b.lastActivityDays ?? Number.MAX_SAFE_INTEGER;
          return (av - bv) * dir;
        }
      }
    });
    return arr;
  }, [summaries, sortKey, sortDir]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(k); setSortDir(k === 'name' ? 'asc' : 'desc'); }
  };

  // 유일(distinct) 티켓 기준 집계 — 필터바 '고객사 요청 N' 과 완전 일치해야 함.
  // 테이블 '총' 열은 고객사-티켓 짝 단위라 중복될 수 있으므로 별도로 계산.
  const distinctCustomerTickets = customerRequestedTickets.length;
  const distinctActive = customerRequestedTickets.filter(
    (t) => t.statusBucket === 'open' || t.statusBucket === 'inProgress',
  ).length;
  const distinctClosed = customerRequestedTickets.filter(
    (t) => t.statusBucket === 'done' || t.statusBucket === 'closed' || t.statusBucket === 'rejected',
  ).length;
  const totalRequests = customerRequestedTickets.reduce((s, t) => s + (t.requestCount || 0), 0);
  // 표시용: 테이블 '총' 열의 합 — distinctCustomerTickets 와 차이 = 복수-고객사 중복 횟수.
  const sumOfPerCustomerTotals = summaries.reduce((s, c) => s + c.totalCount, 0);
  const multiCustomerOverlap = sumOfPerCustomerTotals - distinctCustomerTickets;

  if (summaries.length === 0) {
    return (
      <p className="text-sm text-slate-500 text-center py-12">
        표시할 고객사 요청 티켓이 없습니다.
      </p>
    );
  }

  // 영역 매트릭스: 활성 티켓 있는 고객사만, 상위 8개 영역.
  const customersForMatrix = summaries.filter((c) => c.activeCount > 0).sort((a, b) => b.activeCount - a.activeCount);
  const areaCountTotals: Record<string, number> = {};
  customersForMatrix.forEach((c) => c.areas.forEach((a) => { areaCountTotals[a.name] = (areaCountTotals[a.name] || 0) + a.count; }));
  const topAreas = Object.entries(areaCountTotals).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([n]) => n);

  return (
    <div className="flex flex-col gap-4">
      {/* 요약 — 유일 티켓 기준 (필터바와 정합) */}
      <section className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">고객사별 티켓 현황</h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              customers 필드에 값이 있는 티켓만 집계 — 상단 필터바의 "고객사 요청"과 동일한 모집단
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-600 flex-wrap">
            <span title="고객사 요청 티켓이 분포된 고객사 수">
              고객사 <strong className="text-slate-900">{summaries.length}</strong>
            </span>
            <span className="text-slate-300">·</span>
            <span title="customers 값이 있는 Jira 티켓의 고유 개수 (중복 제거)">
              고객사 요청 티켓 <strong className="text-slate-900">{distinctCustomerTickets}</strong>
            </span>
            <span className="text-slate-300">·</span>
            <span title="그 중 접수 또는 작업 중 상태">
              활성 <strong className="text-slate-900">{distinctActive}</strong>
            </span>
            <span className="text-slate-300">·</span>
            <span title="그 중 완료 · 종료 · 반영불가 상태">
              종결 <strong className="text-slate-900">{distinctClosed}</strong>
            </span>
            <span className="text-slate-300">·</span>
            <span title="해당 티켓들의 Slack 스레드 요청 수 합">
              Slack 요청 <strong className="text-slate-900">{totalRequests}</strong>
            </span>
          </div>
        </div>
        {multiCustomerOverlap > 0 && (
          <div className="mt-2.5 flex items-start gap-2 px-3 py-2 bg-amber-50/70 border border-amber-200 rounded-md">
            <span className="material-symbols-outlined text-amber-600 text-[16px] shrink-0 mt-0.5">info</span>
            <p className="text-[11px] text-slate-700 leading-relaxed">
              <strong>참고:</strong> {multiCustomerOverlap}건의 티켓이 2개 이상의 고객사에 요청되어 아래 테이블의 <strong>"총" 열에서는 각 고객사 행에 각각 집계</strong>됩니다
              (복수 고객사 집계). 그래서 "총" 열의 합계({sumOfPerCustomerTotals})는 고유 티켓 수({distinctCustomerTickets})보다 큽니다. 영역 매트릭스도 동일합니다.
            </p>
          </div>
        )}
      </section>

      {/* 메인 테이블 — 사실만 */}
      <section className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 sticky top-0">
              <tr>
                <Th sortKey="name" active={sortKey} dir={sortDir} onClick={toggleSort} className="text-left">고객사</Th>
                <Th sortKey="total" active={sortKey} dir={sortDir} onClick={toggleSort} className="text-right" title="이 고객사에 요청된 티켓 수. 같은 티켓이 여러 고객사에 요청되면 각 행에 각각 집계됩니다.">총</Th>
                <Th sortKey="active" active={sortKey} dir={sortDir} onClick={toggleSort} className="text-right">활성</Th>
                <Th sortKey="open" active={sortKey} dir={sortDir} onClick={toggleSort} className="text-right">접수</Th>
                <Th sortKey="inProgress" active={sortKey} dir={sortDir} onClick={toggleSort} className="text-right">작업 중</Th>
                <Th sortKey="done" active={sortKey} dir={sortDir} onClick={toggleSort} className="text-right">완료</Th>
                <Th sortKey="closed" active={sortKey} dir={sortDir} onClick={toggleSort} className="text-right">종료</Th>
                <Th sortKey="rejected" active={sortKey} dir={sortDir} onClick={toggleSort} className="text-right">반영불가</Th>
                <Th sortKey="unassigned" active={sortKey} dir={sortDir} onClick={toggleSort} className="text-right">담당 미지정</Th>
                <Th sortKey="oldest" active={sortKey} dir={sortDir} onClick={toggleSort} className="text-right">최장 경과일</Th>
                <Th sortKey="requests" active={sortKey} dir={sortDir} onClick={toggleSort} className="text-right">Slack 요청</Th>
                <Th sortKey="lastActivity" active={sortKey} dir={sortDir} onClick={toggleSort} className="text-right">최근 활동</Th>
                <th className="text-right px-3 py-2 font-semibold">주 영역</th>
                <th className="text-right px-3 py-2 font-semibold">주 요청자</th>
                <th className="text-right px-3 py-2 font-semibold w-24"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sorted.map((c) => (
                <tr key={c.name} className="hover:bg-slate-50/60">
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded bg-blue-100 text-blue-700 font-bold text-[11px] flex items-center justify-center shrink-0">
                        {initials(c.name)}
                      </span>
                      <span className="font-medium text-slate-800">{c.name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-slate-700">{c.totalCount}</td>
                  <td className="px-3 py-2 text-right font-mono font-semibold text-slate-900">{c.activeCount}</td>
                  <td className="px-3 py-2 text-right font-mono text-slate-700">{c.statusCounts.open || '·'}</td>
                  <td className="px-3 py-2 text-right font-mono text-slate-700">{c.statusCounts.inProgress || '·'}</td>
                  <td className="px-3 py-2 text-right font-mono text-slate-500">{c.statusCounts.done || '·'}</td>
                  <td className="px-3 py-2 text-right font-mono text-slate-500">{c.statusCounts.closed || '·'}</td>
                  <td className="px-3 py-2 text-right font-mono text-slate-500">{c.statusCounts.rejected || '·'}</td>
                  <td className="px-3 py-2 text-right font-mono text-slate-700">{c.unassignedCount || '·'}</td>
                  <td className="px-3 py-2 text-right font-mono text-slate-700">{c.oldestOpenDays > 0 ? `${c.oldestOpenDays}일` : '·'}</td>
                  <td className="px-3 py-2 text-right font-mono text-slate-700">{c.totalRequests || '·'}</td>
                  <td className="px-3 py-2 text-right font-mono text-slate-500">
                    {c.lastActivityDays === null ? '·' : c.lastActivityDays === 0 ? '오늘' : `${c.lastActivityDays}일 전`}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center gap-1 justify-end flex-wrap">
                      {c.areas.slice(0, 2).map((a) => (
                        <span key={a.name} className="px-1.5 py-0.5 text-[10px] bg-slate-100 text-slate-600 rounded font-medium">
                          {a.name} {a.count}
                        </span>
                      ))}
                      {c.areas.length > 2 && <span className="text-[10px] text-slate-400">+{c.areas.length - 2}</span>}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center gap-1 justify-end flex-wrap">
                      {c.reporters.slice(0, 2).map((r) => (
                        <button
                          key={r.name}
                          onClick={() => onDrillDownReporter?.(r.name)}
                          className="px-1.5 py-0.5 text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-100 rounded font-medium hover:bg-indigo-100"
                          title={`${r.name} — ${r.count}건 요청. 클릭하면 이 요청자의 티켓만 보기`}
                        >
                          {r.name} {r.count}
                        </button>
                      ))}
                      {c.reporters.length > 2 && <span className="text-[10px] text-slate-400">+{c.reporters.length - 2}</span>}
                      {c.reporters.length === 0 && <span className="text-[10px] text-slate-300">·</span>}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => onDrillDown(c.name)}
                      className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 transition-colors"
                    >
                      티켓 열기
                      <span className="material-symbols-outlined text-[13px]">arrow_forward</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 영역 × 고객사 매트릭스 — 활성 티켓 기준, 숫자만 */}
      {customersForMatrix.length > 0 && topAreas.length > 0 && (
        <section className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <header className="px-4 py-3 border-b border-slate-200 bg-slate-50">
            <h2 className="text-sm font-bold text-slate-900">영역 × 고객사 활성 티켓 수</h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              가로축은 영역(상위 8), 세로축은 고객사(활성 티켓 있는 전체). 숫자는 해당 영역의 활성 티켓 개수
            </p>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-white border-b border-slate-200">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold text-slate-600 sticky left-0 bg-white">고객사</th>
                  {topAreas.map((a) => (
                    <th key={a} className="text-center px-3 py-2 font-semibold text-slate-600 whitespace-nowrap min-w-[70px]">
                      {a}
                    </th>
                  ))}
                  <th className="text-center px-3 py-2 font-semibold text-slate-600 border-l border-slate-200">합계</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customersForMatrix.map((c) => {
                  const matrixTotal = c.areas.filter((a) => topAreas.includes(a.name)).reduce((s, a) => s + a.count, 0);
                  return (
                    <tr key={c.name} className="hover:bg-slate-50/60">
                      <td className="px-3 py-2 font-medium text-slate-800 sticky left-0 bg-white whitespace-nowrap">
                        <button onClick={() => onDrillDown(c.name)} className="hover:text-blue-700 hover:underline text-left">
                          {c.name}
                        </button>
                      </td>
                      {topAreas.map((a) => {
                        const found = c.areas.find((x) => x.name === a);
                        const count = found?.count || 0;
                        return (
                          <td
                            key={a}
                            className={`text-center px-3 py-2 font-mono ${count === 0 ? 'text-slate-300' : 'text-slate-800 font-semibold'}`}
                          >
                            {count || '·'}
                          </td>
                        );
                      })}
                      <td className="text-center px-3 py-2 font-mono font-bold text-slate-900 border-l border-slate-200 bg-slate-50/50">
                        {matrixTotal || '·'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function Th({ children, sortKey, active, dir, onClick, className = '', title }: {
  children: React.ReactNode;
  sortKey: SortKey;
  active: SortKey;
  dir: SortDir;
  onClick: (k: SortKey) => void;
  className?: string;
  title?: string;
}) {
  const isActive = active === sortKey;
  return (
    <th
      title={title}
      className={`px-3 py-2 font-semibold cursor-pointer select-none hover:text-slate-900 whitespace-nowrap ${className}`}
      onClick={() => onClick(sortKey)}
    >
      <span className="inline-flex items-center gap-0.5">
        {children}
        {isActive && (
          <span className="material-symbols-outlined text-[14px]">
            {dir === 'asc' ? 'arrow_upward' : 'arrow_downward'}
          </span>
        )}
      </span>
    </th>
  );
}
