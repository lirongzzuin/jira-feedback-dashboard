'use client';
import { useEffect, useState } from 'react';
import { CONFLUENCE_URL, JIRA_BACKLOG_URL } from '@/lib/site';

interface Props {
  generatedAt: string;
  totalTickets: number;
  autoRefreshEnabled: boolean;
  onToggleAutoRefresh: () => void;
  secondsUntilNext: number;
  pausedByVisibility: boolean;
  lastRefreshedAt: number;
  intervalMs: number;
}

function formatMMSS(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function relativeTime(epochMs: number, now: number): string {
  const diff = Math.floor((now - epochMs) / 1000);
  if (diff < 5) return '방금';
  if (diff < 60) return `${diff}초 전`;
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  return `${Math.floor(diff / 3600)}시간 전`;
}

export function Footer({
  generatedAt, totalTickets, autoRefreshEnabled, onToggleAutoRefresh,
  secondsUntilNext, pausedByVisibility, lastRefreshedAt, intervalMs,
}: Props) {
  // 1 Hz tick so "방금 → 10초 전 → 1분 전" updates live.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const intervalMin = Math.round(intervalMs / 60000);

  return (
    <footer className="bg-white border-t border-slate-200 px-6 py-2.5 shrink-0 text-xs text-slate-500">
      <div className="max-w-[1400px] mx-auto flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          {/* 자동 갱신 토글 */}
          <button
            onClick={onToggleAutoRefresh}
            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border transition-colors ${
              autoRefreshEnabled
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
            }`}
            title={autoRefreshEnabled ? '자동 갱신 끄기' : '자동 갱신 켜기'}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${autoRefreshEnabled ? (pausedByVisibility ? 'bg-amber-500' : 'bg-emerald-500 animate-pulse') : 'bg-slate-400'}`} />
            <span className="font-medium">
              {autoRefreshEnabled
                ? pausedByVisibility
                  ? '자동 갱신 일시정지 (탭 비활성)'
                  : `자동 갱신 중 · 다음 ${formatMMSS(secondsUntilNext)} 후`
                : '자동 갱신 꺼짐'}
            </span>
          </button>

          <span className="text-slate-300">|</span>
          <span>마지막 갱신: <strong className="text-slate-700">{relativeTime(lastRefreshedAt, now)}</strong></span>

          {generatedAt && (
            <>
              <span className="text-slate-300">|</span>
              <span className="text-slate-400">서버 데이터: {relativeTime(new Date(generatedAt).getTime(), now)}</span>
            </>
          )}

          <span className="text-slate-300">|</span>
          <span>총 <strong className="text-slate-700">{totalTickets}개</strong> 티켓</span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-slate-400 text-[11px]">⌨ <kbd className="px-1 py-0.5 bg-slate-100 rounded border border-slate-200 text-[10px]">/</kbd> 검색 · <kbd className="px-1 py-0.5 bg-slate-100 rounded border border-slate-200 text-[10px]">r</kbd> 새로고침</span>
          {CONFLUENCE_URL && (
            <>
              <span className="text-slate-300">|</span>
              <a
                className="hover:text-blue-600 hover:underline"
                href={CONFLUENCE_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                Confluence
              </a>
            </>
          )}
          {JIRA_BACKLOG_URL && (
            <>
              <span className="text-slate-300">·</span>
              <a
                className="hover:text-blue-600 hover:underline"
                href={JIRA_BACKLOG_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                Jira
              </a>
            </>
          )}
          <span className="text-slate-400 text-[10px]">· {intervalMin}분 주기</span>
        </div>
      </div>
    </footer>
  );
}
