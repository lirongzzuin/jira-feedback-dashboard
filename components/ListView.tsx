'use client';
import { useMemo, useState } from 'react';
import type { StatusBucket, Ticket } from '@/lib/types';

interface Props {
  tickets: Ticket[];
}

type SortKey = 'requestCount' | 'age' | 'assignee' | 'jiraKey' | 'title';
type SortDir = 'asc' | 'desc';
type Density = 'cozy' | 'compact';

const STATUS_META: { key: StatusBucket; label: string; color: string; defaultOpen: boolean }[] = [
  { key: 'inProgress', label: '작업 중', color: 'bg-blue-500', defaultOpen: true },
  { key: 'open', label: '접수', color: 'bg-slate-400', defaultOpen: true },
  { key: 'done', label: '완료', color: 'bg-emerald-500', defaultOpen: false },
  { key: 'closed', label: '종료', color: 'bg-slate-500', defaultOpen: false },
  { key: 'rejected', label: '반영불가', color: 'bg-rose-400', defaultOpen: false },
];

function daysSince(iso: string): number | null {
  if (!iso) return null;
  // "2026-10-02 09:30:00" 형태의 KST 문자열 또는 ISO 둘 다 지원.
  const normalized = iso.includes('T') ? iso : iso.replace(' ', 'T') + '+09:00';
  const d = new Date(normalized);
  if (isNaN(d.getTime())) return null;
  const diffMs = Date.now() - d.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

function toCsv(tickets: Ticket[]): string {
  const headers = ['Jira', '제목', '상태', '스프린트', '담당', '영역', '요청수', '고객사', 'Slack 링크수', '최초 제보', '최종 갱신'];
  const rows = tickets.map((t) => [
    t.jiraKey, t.title, t.jiraStatus, t.sprint, t.assignee, t.area,
    String(t.requestCount), t.customers.join('; '),
    String(t.slackLinks.length), t.firstReported, t.lastUpdated,
  ]);
  return [headers, ...rows]
    .map((r) => r.map((cell) => {
      const s = String(cell || '');
      // CSV escape: wrap in quotes if contains comma/quote/newline.
      if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
      return s;
    }).join(','))
    .join('\n');
}

function downloadCsv(tickets: Ticket[]) {
  const csv = '﻿' + toCsv(tickets); // BOM for Excel Korean support
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  a.download = `tickets-${stamp}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function initials(name: string): string {
  return name ? name.trim().charAt(0) : '?';
}

export function ListView({ tickets }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('requestCount');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [density, setDensity] = useState<Density>('cozy');
  const [collapsed, setCollapsed] = useState<Record<StatusBucket, boolean>>(() => {
    const init: Record<StatusBucket, boolean> = { open: false, inProgress: false, done: true, closed: true, rejected: true };
    return init;
  });

  const byBucket = useMemo(() => {
    const g: Record<StatusBucket, Ticket[]> = { open: [], inProgress: [], done: [], closed: [], rejected: [] };
    tickets.forEach((t) => g[t.statusBucket]?.push(t));
    return g;
  }, [tickets]);

  const sortTickets = (arr: Ticket[]) => {
    const sorted = [...arr];
    sorted.sort((a, b) => {
      let va: string | number = 0;
      let vb: string | number = 0;
      switch (sortKey) {
        case 'requestCount': va = a.requestCount; vb = b.requestCount; break;
        case 'age': va = daysSince(a.firstReported) ?? -1; vb = daysSince(b.firstReported) ?? -1; break;
        case 'assignee': va = a.assignee || '~'; vb = b.assignee || '~'; break;
        case 'jiraKey': va = a.jiraKey; vb = b.jiraKey; break;
        case 'title': va = a.title; vb = b.title; break;
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir(key === 'jiraKey' || key === 'title' || key === 'assignee' ? 'asc' : 'desc'); }
  };

  const toggleCollapsed = (key: StatusBucket) => {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (tickets.length === 0) {
    return <p className="text-sm text-slate-500 text-center py-12">표시할 티켓이 없습니다.</p>;
  }

  const rowPad = density === 'compact' ? 'py-1.5' : 'py-2.5';
  const textSize = density === 'compact' ? 'text-xs' : 'text-xs';

  return (
    <div className="flex flex-col gap-3">
      {/* Status summary bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 overflow-x-auto">
            {STATUS_META.map((s) => {
              const items = byBucket[s.key];
              const totalReq = items.reduce((sum, t) => sum + (t.requestCount || 0), 0);
              return (
                <button
                  key={s.key}
                  onClick={() => toggleCollapsed(s.key)}
                  className="flex items-center gap-2 shrink-0 hover:bg-slate-50 px-2 py-1 rounded-md transition-colors"
                  title={collapsed[s.key] ? '펼치기' : '접기'}
                >
                  <span className={`w-2 h-2 rounded-full ${s.color}`} />
                  <span className="text-xs font-medium text-slate-700">{s.label}</span>
                  <span className="text-xs font-bold text-slate-900">{items.length}건</span>
                  {totalReq > 0 && <span className="text-[11px] text-slate-500 font-mono">Slack 요청 {totalReq}</span>}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center bg-slate-100 p-0.5 rounded-md border border-slate-200">
              <button
                onClick={() => setDensity('cozy')}
                className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors ${density === 'cozy' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}
                title="편안한 밀도"
              >
                넓게
              </button>
              <button
                onClick={() => setDensity('compact')}
                className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors ${density === 'compact' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}
                title="촘촘한 밀도"
              >
                촘촘히
              </button>
            </div>
            <button
              onClick={() => downloadCsv(tickets)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 transition-colors"
              title="현재 필터된 티켓을 CSV로 저장"
            >
              <span className="material-symbols-outlined text-[14px]">download</span>
              CSV
            </button>
          </div>
        </div>
      </div>

      {/* Per-status groups */}
      {STATUS_META.map((s) => {
        const items = sortTickets(byBucket[s.key] || []);
        if (items.length === 0) return null;
        const isCollapsed = collapsed[s.key];
        return (
          <div key={s.key} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <button
              onClick={() => toggleCollapsed(s.key)}
              className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-50 hover:bg-slate-100 border-b border-slate-200 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-slate-500 text-[18px]">
                  {isCollapsed ? 'chevron_right' : 'expand_more'}
                </span>
                <span className={`w-2.5 h-2.5 rounded-full ${s.color}`} />
                <h3 className="text-sm font-bold text-slate-800">{s.label}</h3>
                <span className="px-2 py-0.5 text-xs font-bold bg-white text-slate-700 rounded-full border border-slate-200">
                  {items.length}
                </span>
              </div>
              <span className="text-[11px] text-slate-500 font-mono">
                Slack 요청 {items.reduce((sum, t) => sum + (t.requestCount || 0), 0)}건
              </span>
            </button>
            {!isCollapsed && (
              <table className={`w-full ${textSize}`}>
                <thead className="bg-white text-slate-500 border-b border-slate-100">
                  <tr>
                    <Th sortKey="jiraKey" active={sortKey} dir={sortDir} onClick={toggleSort}>Jira</Th>
                    <Th sortKey="title" active={sortKey} dir={sortDir} onClick={toggleSort}>제목</Th>
                    <th className="text-left px-3 py-2 font-semibold">상태</th>
                    <th className="text-left px-3 py-2 font-semibold">스프린트</th>
                    <Th sortKey="assignee" active={sortKey} dir={sortDir} onClick={toggleSort}>담당</Th>
                    <th className="text-left px-3 py-2 font-semibold">영역</th>
                    <Th sortKey="requestCount" active={sortKey} dir={sortDir} onClick={toggleSort} className="text-right" title="Slack 스레드 요청 수">Slack 요청</Th>
                    <th className="text-right px-3 py-2 font-semibold" title="연결된 Slack 스레드 수 (요청 수와 동일)">스레드</th>
                    <Th sortKey="age" active={sortKey} dir={sortDir} onClick={toggleSort} className="text-right">경과</Th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((t) => {
                    const age = daysSince(t.firstReported);
                    const isOverdue = age !== null && age >= 14 && (t.statusBucket === 'open' || t.statusBucket === 'inProgress');
                    return (
                      <tr key={t.jiraKey} className="border-t border-slate-100 hover:bg-blue-50/30">
                        <td className={`px-3 ${rowPad} font-mono whitespace-nowrap`}>
                          <a href={t.jiraUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-semibold">
                            {t.jiraKey}
                          </a>
                        </td>
                        <td className={`px-3 ${rowPad} text-slate-800`}>
                          <div className="flex items-center gap-1.5">
                            {!t.assignee && (t.statusBucket === 'open' || t.statusBucket === 'inProgress') && (
                              <span className="shrink-0 px-1 py-0.5 text-[9px] font-bold bg-rose-100 text-rose-700 rounded" title="담당자 지정 필요">담당</span>
                            )}
                            {isOverdue && (
                              <span className="shrink-0 px-1 py-0.5 text-[9px] font-bold bg-amber-100 text-amber-700 rounded" title={`${age}일 경과`}>방치</span>
                            )}
                            {t.requestCount >= 3 && (t.statusBucket === 'open' || t.statusBucket === 'inProgress') && (
                              <span className="shrink-0 px-1 py-0.5 text-[9px] font-bold bg-amber-100 text-amber-700 rounded" title={`요청 ${t.requestCount}건`}>다수</span>
                            )}
                            {t.reviewNeeded && (
                              <span className="shrink-0 px-1 py-0.5 text-[9px] font-semibold bg-slate-100 text-slate-600 rounded">검토</span>
                            )}
                            <span className={density === 'compact' ? 'truncate max-w-md' : ''}>{t.title}</span>
                          </div>
                        </td>
                        <td className={`px-3 ${rowPad} whitespace-nowrap`}>
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px]">{t.jiraStatus || '-'}</span>
                        </td>
                        <td className={`px-3 ${rowPad} text-slate-600 whitespace-nowrap`}>{t.sprint || '-'}</td>
                        <td className={`px-3 ${rowPad} whitespace-nowrap`}>
                          {t.assignee ? (
                            <div className="flex items-center gap-1.5">
                              <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold text-[10px] flex items-center justify-center shrink-0">
                                {initials(t.assignee)}
                              </span>
                              <span className="text-slate-700">{t.assignee}</span>
                            </div>
                          ) : (
                            <em className="text-slate-400 text-[11px]">미지정</em>
                          )}
                        </td>
                        <td className={`px-3 ${rowPad} text-slate-600 whitespace-nowrap`}>{t.area || '-'}</td>
                        <td className={`px-3 ${rowPad} text-right font-mono font-semibold ${t.requestCount >= 3 ? 'text-rose-600' : 'text-slate-700'}`}>
                          {t.requestCount}
                        </td>
                        <td className={`px-3 ${rowPad} text-right text-slate-500 font-mono`}>{t.slackLinks.length}</td>
                        <td className={`px-3 ${rowPad} text-right whitespace-nowrap`}>
                          {age === null ? (
                            <span className="text-slate-400">-</span>
                          ) : isOverdue ? (
                            <span className="text-rose-600 font-semibold">{age}일</span>
                          ) : (
                            <span className="text-slate-500">{age}일</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        );
      })}
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
    <th title={title} className={`text-left px-3 py-2 font-semibold cursor-pointer select-none hover:text-slate-800 ${className}`} onClick={() => onClick(sortKey)}>
      <span className="inline-flex items-center gap-0.5">
        {children}
        {isActive && (
          <span className="material-symbols-outlined text-[14px] text-blue-600">
            {dir === 'asc' ? 'arrow_upward' : 'arrow_downward'}
          </span>
        )}
      </span>
    </th>
  );
}
