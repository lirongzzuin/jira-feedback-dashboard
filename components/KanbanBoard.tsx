'use client';
import type { StatusBucket, Ticket } from '@/lib/types';
import { TicketCard } from './TicketCard';

interface Column {
  key: StatusBucket;
  label: string;
  dotClass: string;
}

interface Props {
  columns: Column[];
  byBucket: Record<StatusBucket, Ticket[]>;
}

// 접수/작업 중/완료/종료는 넓게, 반영불가만 좁게 (lg 이상).
// grid-template-columns: 접수 2 | 작업중 2 | 완료 1.8 | 종료 1.8 | 반영불가 1.3

export function KanbanBoard({ columns, byBucket }: Props) {
  return (
    <div
      className="grid grid-cols-1 md:grid-cols-2 gap-5 h-full items-start lg:[grid-template-columns:2fr_2fr_1.8fr_1.8fr_1.3fr]"
    >
      {columns.map((col) => {
        const items = byBucket[col.key] || [];
        const totalRequests = items.reduce((s, t) => s + (t.requestCount || 0), 0);
        const emphasized = col.key === 'inProgress' || col.key === 'open';
        const muted = col.key === 'done' || col.key === 'closed' || col.key === 'rejected';
        return (
          <div
            key={col.key}
            className={[
              'rounded-xl border flex flex-col max-h-[calc(100vh-220px)] shadow-sm min-w-0',
              col.key === 'inProgress'
                ? 'bg-blue-50/50 border-blue-200/80 ring-1 ring-blue-500/10'
                : muted
                ? 'bg-slate-50/80 border-slate-200/70'
                : 'bg-slate-100/70 border-slate-200/90',
            ].join(' ')}
          >
            <div className={[
              'p-3.5 border-b flex items-center justify-between backdrop-blur rounded-t-xl shrink-0',
              col.key === 'inProgress' ? 'bg-white/80 border-blue-200' : 'bg-white/70 border-slate-200',
            ].join(' ')}>
              <div className="flex items-center gap-2 min-w-0">
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${col.dotClass}`} />
                <h2 className={`text-sm font-bold truncate ${emphasized ? 'text-slate-900' : 'text-slate-700'}`}>{col.label}</h2>
                <span className={[
                  'px-2 py-0.5 text-xs font-bold rounded-full shrink-0',
                  col.key === 'inProgress' ? 'bg-blue-600 text-white'
                    : col.key === 'done' ? 'bg-emerald-100 text-emerald-800'
                    : col.key === 'closed' ? 'bg-slate-200 text-slate-700'
                    : col.key === 'rejected' ? 'bg-rose-100 text-rose-700'
                    : 'bg-slate-200/80 text-slate-700',
                ].join(' ')}>
                  {items.length}
                </span>
              </div>
              {totalRequests > 0 && (
                <span className={`text-[11px] font-mono shrink-0 ${col.key === 'inProgress' ? 'text-blue-700 font-semibold' : 'text-slate-400'}`}>
                  Slack {totalRequests}
                </span>
              )}
            </div>
            <div className="p-3 overflow-y-auto custom-scrollbar flex flex-col gap-3">
              {items.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">해당 항목 없음</p>
              ) : (
                items.map((t) => <TicketCard key={t.jiraKey} ticket={t} muted={muted} />)
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
