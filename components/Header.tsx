'use client';
import { useState, useRef, useEffect } from 'react';
import { APP_TITLE, JIRA_BACKLOG_URL, PRODUCT_NAME } from '@/lib/site';

interface Props {
  totalTickets: number;
  open: number;
  inProgress: number;
  done: number;
  closed: number;
  rejected: number;
  totalRequests: number;
  customerCount: number;
  reporterCount: number;
  query: string;
  onQueryChange: (v: string) => void;
  onRefresh: () => void;
  loading: boolean;
  generatedAt: string;
}

function formatKst(iso: string): string {
  if (!iso) return '-';
  // Intl은 서버(Node)와 브라우저의 로케일 데이터가 달라 "AM"/"오전"이 갈려
  // 하이드레이션 에러가 난다 — KST 24시간 형식으로 직접 포맷.
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const k = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(k.getUTCMonth() + 1)}. ${p(k.getUTCDate())}. ${p(k.getUTCHours())}:${p(k.getUTCMinutes())}`;
}

export function Header({
  totalTickets, open, inProgress, done, closed, rejected, totalRequests, customerCount, reporterCount,
  query, onQueryChange, onRefresh, loading, generatedAt,
}: Props) {
  const [infoOpen, setInfoOpen] = useState(false);
  const infoRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (infoRef.current && !infoRef.current.contains(e.target as Node)) setInfoOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setInfoOpen(false); };
    window.addEventListener('mousedown', onClick);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onClick);
      window.removeEventListener('keydown', onKey);
    };
  }, []);
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 px-6 py-3 shrink-0 shadow-[0_1px_3px_0_rgba(0,0,0,0.02)]">
      <div className="max-w-[1400px] mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-sm shadow-blue-500/20 shrink-0">
            <span className="material-symbols-outlined text-[22px]">corporate_fare</span>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">{APP_TITLE}</h1>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                Jira 기준
              </span>
              {/* 수집 기준 안내 — 질문 반복 방지 (고객사 요청 아닌 티켓도 포함되는 이유 설명) */}
              <div className="relative" ref={infoRef}>
                <button
                  onClick={() => setInfoOpen((v) => !v)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition-colors"
                  title="어떤 티켓이 수집되고, 고객사 요청 vs 내부 발의를 어떻게 구분하는지 안내"
                >
                  <span className="material-symbols-outlined text-[13px]">help</span>
                  수집 기준
                </button>
                {infoOpen && (
                  <div className="absolute top-full left-0 mt-2 w-[380px] bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
                    <div className="px-4 py-3 bg-gradient-to-br from-amber-50 to-white border-b border-amber-100">
                      <h3 className="text-sm font-bold text-slate-900">이 현황판에 들어오는 티켓 기준</h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">아래 3가지 조건을 모두 만족하면 자동 수집됩니다</p>
                    </div>
                    <ol className="px-4 py-3 space-y-2 text-xs text-slate-700">
                      <li className="flex items-start gap-2">
                        <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
                        <span><strong>타입</strong>: 기능 요청 · 기능 개선 · 버그만 (문의/작업/하위작업 제외)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
                        <span><strong>{PRODUCT_NAME || '제품'} 태그</strong>: Jira 컴포넌트가 {PRODUCT_NAME || '대상 제품'}이거나 제목이 <code className="bg-slate-100 px-1 rounded text-[10px]">[{PRODUCT_NAME || '제품명'}]</code>로 시작</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
                        <span><strong>Slack 참조</strong>: Jira 설명(description)에 Slack 링크 1개 이상 포함</span>
                      </li>
                    </ol>
                    <div className="px-4 py-3 bg-slate-50 border-t border-slate-100">
                      <p className="text-[11px] font-semibold text-slate-700 mb-1.5">💡 고객사 요청만 모아 보고 싶다면</p>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        아래 필터바의 <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-white border border-blue-200 text-blue-700 font-semibold">🏪 고객사 요청</span> 칩을 누르면 외부 거래처가 명시된 티켓만 걸러집니다.
                      </p>
                      <p className="text-[11px] text-slate-600 leading-relaxed mt-1.5">
                        반대로 <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-700 font-semibold">👥 내부 발의</span>를 누르면 내부에서 발의된 티켓만 볼 수 있어요.
                      </p>
                    </div>
                    <div className="px-4 py-3 bg-amber-50/60 border-t border-amber-100">
                      <p className="text-[11px] font-semibold text-slate-700 mb-1">🏷️ Jira 라벨로 수동 보정</p>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        자동 분류가 틀렸을 때 Jira 티켓에 <code className="bg-white px-1 rounded border border-amber-200 text-amber-900">고객사-요청</code> 또는 <code className="bg-white px-1 rounded border border-amber-200 text-amber-900">내부-발의</code> 라벨을 붙이면 분류가 강제로 바뀝니다.
                      </p>
                    </div>
                    <div className="px-4 py-2 bg-white border-t border-slate-100 text-[10px] text-slate-400">
                      ESC 또는 바깥 클릭으로 닫기
                    </div>
                  </div>
                )}
              </div>
              <span className="inline-flex items-center gap-1 text-xs text-slate-500" title={generatedAt}>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                마지막 동기화 {formatKst(generatedAt)}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5 flex-wrap">
              <span
                className="inline-flex items-center gap-1 cursor-help"
                title="고유 Jira 티켓 개수"
              >
                <span className="font-medium text-slate-700">티켓</span>
                <strong className="text-slate-900 font-semibold">{totalTickets}건</strong>
              </span>
              <span className="text-slate-300">|</span>
              <span className="text-slate-600" title="To Do / Open / 해야 할 일">
                접수 <strong>{open}</strong>
              </span>
              <span className="text-slate-300">·</span>
              <span className="text-blue-600" title="In Progress / In Review / 진행 중">
                작업 중 <strong>{inProgress}</strong>
              </span>
              <span className="text-slate-300">·</span>
              <span className="text-emerald-600" title="Done / Resolved / 완료 — 작업 완료 (아직 종결 전)">
                완료 <strong>{done}</strong>
              </span>
              <span className="text-slate-300">·</span>
              <span className="text-slate-600" title="Closed / 종료 — 완전 종결">
                종료 <strong>{closed}</strong>
              </span>
              <span className="text-slate-300">·</span>
              <span className="text-rose-600" title="Won't Do / Cancelled / 반영불가">
                반영불가 <strong>{rejected}</strong>
              </span>
              <span className="text-slate-300">|</span>
              <span
                className="inline-flex items-center gap-1 cursor-help"
                title="같은 Jira 티켓이 여러 Slack 스레드에서 반복 요청된 횟수의 합. 티켓 수와는 다름 (여러 요청이 한 티켓으로 합쳐짐)."
              >
                <span className="material-symbols-outlined text-[13px] text-slate-400">chat</span>
                Slack 요청 <strong className="text-slate-700">{totalRequests}</strong>
              </span>
              <span className="text-slate-300">·</span>
              <span className="inline-flex items-center gap-1" title="고유 고객사 수">
                <span className="material-symbols-outlined text-[13px] text-slate-400">store</span>
                고객사 <strong className="text-slate-700">{customerCount}</strong>
              </span>
              <span className="text-slate-300">·</span>
              <span className="inline-flex items-center gap-1" title="Slack에서 Jira 티켓을 요청·전달한 사람 수">
                <span className="material-symbols-outlined text-[13px] text-slate-400">person</span>
                요청자 <strong className="text-slate-700">{reporterCount}</strong>
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-64 md:w-72 hidden sm:block">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-[18px]">search</span>
            <input
              id="ticket-search"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              className="w-full h-9 pl-9 pr-4 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              placeholder="Jira · 제목 · 담당 · 고객사 · 요청자 · 영역 (/)"
              type="text"
            />
          </div>
          {JIRA_BACKLOG_URL && (
            <a
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm shadow-blue-600/10 transition-colors"
              href={JIRA_BACKLOG_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span>Jira 백로그</span>
              <span className="material-symbols-outlined text-[15px]">open_in_new</span>
            </a>
          )}
          <button
            onClick={onRefresh}
            disabled={loading}
            className="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors disabled:opacity-50"
            title="새로고침 (r)"
          >
            <span className={`material-symbols-outlined text-[18px] ${loading ? 'animate-spin' : ''}`}>refresh</span>
          </button>
        </div>
      </div>
    </header>
  );
}
