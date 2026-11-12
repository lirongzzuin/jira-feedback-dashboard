'use client';
import { useState } from 'react';
import type { Ticket } from '@/lib/types';
import { isStale, isUnassigned, isHighDemand } from './Dashboard';

interface Props {
  ticket: Ticket;
  muted?: boolean;
  compact?: boolean;
}

function initialsFromName(name: string): string {
  if (!name) return '?';
  return name.trim().charAt(0) || '?';
}

function daysSince(iso: string): number | null {
  if (!iso) return null;
  const normalized = iso.includes('T') ? iso : iso.replace(' ', 'T') + '+09:00';
  const d = new Date(normalized);
  if (isNaN(d.getTime())) return null;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24)));
}

export function TicketCard({ ticket, muted = false, compact = false }: Props) {
  const [expanded, setExpanded] = useState(false);
  const unassigned = isUnassigned(ticket);
  const stale = isStale(ticket);
  const highDemand = isHighDemand(ticket);
  // "Needs action" = 어떤 조치가 필요한 티켓. 테두리로 강조.
  const needsAction = unassigned || stale || highDemand;
  const age = daysSince(ticket.firstReported);

  // 종결 상태(done/closed/rejected) 카드도 펼칠 수 있게 함.
  // 기본은 접힘(muted 스타일) — 클릭하면 상세·고객사·Slack 링크 등 확인 가능.
  // 사용자 피드백 반영: "완료/종료/반영불가 카드도 내용을 보고 싶음"
  //
  // compact prop: 하위 호환 유지. true여도 종결 티켓은 펼침 가능하게 동작.
  //   (이전엔 compact=true일 때 한 줄 카드로만 렌더링했음 — 지금은 muted 스타일로 통일)
  void compact;

  return (
    <article
      className={[
        'rounded-lg ticket-card shadow-sm flex flex-col cursor-pointer transition-all',
        muted ? 'p-2.5 gap-1.5 bg-white/80' : 'p-3.5 gap-2.5 bg-white',
        unassigned ? 'border-2 border-rose-300' : stale ? 'border-2 border-amber-300' : muted ? 'border border-slate-200/80' : 'border border-slate-200',
      ].join(' ')}
      onClick={() => setExpanded((v) => !v)}
    >
      <div className="flex items-center justify-between gap-1 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
          <a
            href={ticket.jiraUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className={`text-xs font-mono font-semibold hover:underline shrink-0 ${muted ? 'text-slate-400 line-through' : 'text-blue-600'}`}
          >
            {ticket.jiraKey}
          </a>
          {unassigned && (
            <span
              className="px-1.5 py-0.5 text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 rounded flex items-center gap-0.5"
              title="담당자가 지정되지 않음 — PO 배정 필요"
            >
              <span className="material-symbols-outlined text-[11px]">person_off</span>
              담당 필요
            </span>
          )}
          {stale && (
            <span
              className="px-1.5 py-0.5 text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 rounded flex items-center gap-0.5"
              title={`${age}일 경과 — 진행 상태 확인 필요`}
            >
              <span className="material-symbols-outlined text-[11px]">schedule</span>
              {age}일 방치
            </span>
          )}
          {highDemand && !unassigned && !stale && (
            <span
              className="px-1.5 py-0.5 text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 rounded flex items-center gap-0.5"
              title={`요청 ${ticket.requestCount}건 — 다수 채널 반복 요청`}
            >
              <span className="material-symbols-outlined text-[11px]">trending_up</span>
              요청 {ticket.requestCount}
            </span>
          )}
          {ticket.reviewNeeded && !needsAction && (
            <span
              className="px-1.5 py-0.5 text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200 rounded"
              title={ticket.reviewReason || '검토 필요'}
            >
              검토
            </span>
          )}
        </div>
        <a
          href={ticket.jiraUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-0.5 text-[11px] font-medium text-slate-400 hover:text-blue-600 shrink-0"
          title="Jira에서 원본 티켓 보기"
        >
          <span>Jira</span>
          <span className="material-symbols-outlined text-[13px]">north_east</span>
        </a>
      </div>

      <h3 className={`leading-snug ${muted ? 'text-xs font-medium text-slate-500 line-through' : 'text-sm font-semibold text-slate-900'}`}>
        {ticket.title || '(제목 없음)'}
      </h3>

      {/* 뱃지 라인: 종결 티켓은 접혀있을 때 숨기고, 펼치면 노출 */}
      {(!muted || expanded) && (
        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
          {ticket.jiraStatus && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700">
              {ticket.jiraStatus}
            </span>
          )}
          {ticket.sprint && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
              {ticket.sprint}
            </span>
          )}
          {ticket.area && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-600">
              #{ticket.area}
            </span>
          )}
          {ticket.slackLinks.length > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-purple-50 text-purple-700 border border-purple-100">
              <span className="material-symbols-outlined text-[12px]">chat</span>
              Slack 요청 {ticket.slackLinks.length}건
            </span>
          )}
        </div>
      )}

      {/* 고객사·요청자 뱃지: 종결 티켓은 접혀있을 때 숨기고, 펼치면 노출 */}
      {(!muted || expanded) && ticket.customers.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap -mt-0.5" title={`고객사: ${ticket.customers.join(', ')}`}>
          <span className="material-symbols-outlined text-[13px] text-blue-500">store</span>
          {ticket.customers.slice(0, 3).map((c) => (
            <span key={c} className="px-1.5 py-0.5 text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-100 rounded">
              {c}
            </span>
          ))}
          {ticket.customers.length > 3 && (
            <span className="text-[10px] text-slate-400 font-medium">+{ticket.customers.length - 3}</span>
          )}
        </div>
      )}

      {(!muted || expanded) && ticket.reporters && ticket.reporters.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap" title={`요청자: ${ticket.reporters.join(', ')}`}>
          <span className="material-symbols-outlined text-[13px] text-indigo-500">person</span>
          {ticket.reporters.slice(0, 3).map((r) => (
            <span key={r} className="px-1.5 py-0.5 text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100 rounded">
              {r}
            </span>
          ))}
          {ticket.reporters.length > 3 && (
            <span className="text-[10px] text-slate-400 font-medium">+{ticket.reporters.length - 3}</span>
          )}
        </div>
      )}

      {expanded && (
        <div className="pt-2 border-t border-slate-100 flex flex-col gap-2 text-xs text-slate-600" onClick={(e) => e.stopPropagation()}>
          {ticket.detail && (
            <div>
              <div className="font-semibold text-slate-700 mb-0.5">상세</div>
              <p className="whitespace-pre-wrap text-slate-600 leading-relaxed">
                {ticket.detail.length > 500 ? ticket.detail.slice(0, 500) + '…' : ticket.detail}
              </p>
            </div>
          )}
          {ticket.customers.length > 0 && (
            <div><span className="font-semibold text-slate-700">고객사:</span> {ticket.customers.join(', ')}</div>
          )}
          {ticket.answer && (
            <div><span className="font-semibold text-slate-700">답변:</span> {ticket.answer}</div>
          )}
          {ticket.slackLinks.length > 0 && (
            <div>
              <div className="font-semibold text-slate-700 mb-0.5">관련 Slack ({ticket.slackLinks.length})</div>
              <ul className="list-disc list-inside space-y-0.5">
                {ticket.slackLinks.map((u, i) => (
                  <li key={i}>
                    <a href={u} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-all">
                      스레드 {i + 1}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {ticket.viseIds.length > 0 && (
            <div className="text-[11px] text-slate-400">원장: {ticket.viseIds.join(', ')}</div>
          )}
        </div>
      )}

      {/* 하단 info bar — 종결 티켓은 접혔을 때 Jira 바로가기만 미니멀하게 표시 */}
      {muted && !expanded ? (
        <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-100">
          <div className="flex items-center gap-1.5 min-w-0 text-[11px] text-slate-400">
            {ticket.assignee && (
              <>
                <div className="w-4 h-4 rounded-full bg-slate-200 text-slate-600 font-bold text-[9px] flex items-center justify-center shrink-0">
                  {initialsFromName(ticket.assignee)}
                </div>
                <span className="truncate">{ticket.assignee}</span>
              </>
            )}
          </div>
          <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
            펼치기
            <span className="material-symbols-outlined text-[12px]">expand_more</span>
          </span>
        </div>
      ) : (
      <div className={`flex items-center justify-between pt-2 border-t text-xs ${muted ? 'border-slate-100 text-slate-400' : 'border-slate-100 text-slate-500'}`}>
        <div className="flex items-center gap-1.5 min-w-0">
          {ticket.assignee ? (
            <>
              <div className={`w-5 h-5 rounded-full font-bold text-[10px] flex items-center justify-center shrink-0 ${muted ? 'bg-slate-200 text-slate-600' : 'bg-blue-100 text-blue-700'}`}>
                {initialsFromName(ticket.assignee)}
              </div>
              <span className={`truncate ${muted ? '' : 'text-slate-700 font-medium'}`}>{ticket.assignee}</span>
            </>
          ) : (
            <span className="text-slate-400 text-xs italic">담당 미지정</span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="font-mono text-slate-400 font-medium" title="Slack 스레드 요청 수">Slack 요청 {ticket.requestCount}</span>
          {age !== null && !muted && (
            <span className={`font-mono text-[11px] ${stale ? 'text-amber-600 font-semibold' : 'text-slate-400'}`}>
              {age}일
            </span>
          )}
        </div>
      </div>
      )}
    </article>
  );
}
