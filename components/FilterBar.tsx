'use client';
import { useState, useRef, useEffect, useMemo } from 'react';

interface Props {
  filter: string;
  onFilterChange: (v: string) => void;
  counts: { all: number; customerRequested: number; internalRequested: number; unassigned: number; stale: number; highDemand: number };
  areas: string[];
  customers: string[];
  customerFilters: string[];
  onCustomerFiltersChange: (v: string[]) => void;
  customerCounts: Record<string, number>;
  reporters: string[];
  reporterFilters: string[];
  onReporterFiltersChange: (v: string[]) => void;
  reporterCounts: Record<string, number>;
  viewMode: 'customer' | 'kanban' | 'list';
  onViewChange: (v: 'customer' | 'kanban' | 'list') => void;
}

export function FilterBar({
  filter, onFilterChange, counts, areas,
  customers, customerFilters, onCustomerFiltersChange, customerCounts,
  reporters, reporterFilters, onReporterFiltersChange, reporterCounts,
  viewMode, onViewChange,
}: Props) {
  const baseChip = 'px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 transition-colors shrink-0 border';
  const chip = (active: boolean, tone: 'default' | 'warn' | 'danger' = 'default') => {
    if (active) {
      if (tone === 'danger') return `${baseChip} bg-rose-50 text-rose-700 border-rose-300`;
      if (tone === 'warn') return `${baseChip} bg-amber-50 text-amber-700 border-amber-300`;
      return `${baseChip} bg-blue-50 text-blue-700 border-blue-200`;
    }
    if (tone === 'danger') return `${baseChip} bg-white text-rose-700 border-rose-200 hover:bg-rose-50`;
    if (tone === 'warn') return `${baseChip} bg-white text-amber-700 border-amber-200 hover:bg-amber-50`;
    return `${baseChip} bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900`;
  };
  // 활성 칩을 다시 누르면 'all'로 복귀 (토글). 이미 'all' 상태에서 '전체 티켓' 눌러도 'all' 유지.
  const toggleFilter = (key: string) => onFilterChange(filter === key ? 'all' : key);

  return (
    <nav className="bg-white border-b border-slate-200 px-6 py-2.5 shrink-0 relative">
      <div className="max-w-[1400px] mx-auto flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 flex-wrap py-0.5 flex-1 min-w-0">
          <span className="text-xs font-semibold text-slate-400 mr-1 shrink-0">필터:</span>

          <MultiSelectDropdown
            label="고객사"
            icon="store"
            items={customers}
            counts={customerCounts}
            selected={customerFilters}
            onChange={onCustomerFiltersChange}
            accent="blue"
            emptyLabel="모든 고객사"
            title="고객사별로 티켓 좁혀 보기 (요청자와 동시 적용 시 교집합)"
          />

          <MultiSelectDropdown
            label="요청자"
            icon="person"
            items={reporters}
            counts={reporterCounts}
            selected={reporterFilters}
            onChange={onReporterFiltersChange}
            accent="indigo"
            emptyLabel="모든 요청자"
            title="Slack에서 Jira 티켓을 요청·전달한 사람 — 고객사 필터와 동시 적용 가능"
          />

          <span className="w-px h-5 bg-slate-200 mx-1 shrink-0" />

          <button onClick={() => onFilterChange('all')} className={chip(filter === 'all')}>
            <span>전체 티켓</span>
            <span className={filter === 'all' ? 'bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold' : 'text-slate-400 text-[11px]'}>
              {counts.all}
            </span>
          </button>

          <button
            onClick={() => toggleFilter('customerRequested')}
            className={chip(filter === 'customerRequested')}
            title="customers 필드에 값이 있는 티켓 — 고객사에서 요청으로 생성된 건만 모아 보기 (다시 누르면 해제)"
          >
            <span className="material-symbols-outlined text-[13px]">store</span>
            <span>고객사 요청</span>
            <span className={filter === 'customerRequested' ? 'bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold' : 'text-slate-400 text-[11px] font-bold'}>
              {counts.customerRequested}
            </span>
          </button>

          <button
            onClick={() => toggleFilter('internalRequested')}
            className={chip(filter === 'internalRequested')}
            title="customers 필드가 비어있는 티켓 — 내부에서 발의된 건만 모아 보기 (다시 누르면 해제)"
          >
            <span className="material-symbols-outlined text-[13px]">groups</span>
            <span>내부 발의</span>
            <span className={filter === 'internalRequested' ? 'bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold' : 'text-slate-400 text-[11px] font-bold'}>
              {counts.internalRequested}
            </span>
          </button>

          <span className="w-px h-5 bg-slate-200 mx-1 shrink-0" />

          <button
            onClick={() => toggleFilter('unassigned')}
            className={chip(filter === 'unassigned', 'danger')}
            title="활성 티켓 중 담당자가 지정되지 않은 것 — PO가 배정 필요 (다시 누르면 해제)"
          >
            <span className="material-symbols-outlined text-[13px]">person_off</span>
            <span>담당 필요</span>
            <span className="font-bold text-[11px]">{counts.unassigned}</span>
          </button>

          <button
            onClick={() => toggleFilter('stale')}
            className={chip(filter === 'stale', 'warn')}
            title="접수 또는 작업 중 상태로 14일 이상 경과 — 진행 상태 확인 필요 (다시 누르면 해제)"
          >
            <span className="material-symbols-outlined text-[13px]">schedule</span>
            <span>장기 방치</span>
            <span className="font-bold text-[11px]">{counts.stale}</span>
          </button>

          <button
            onClick={() => toggleFilter('highDemand')}
            className={chip(filter === 'highDemand', 'warn')}
            title="활성 티켓 중 Slack 요청 수 3건 이상 — 다수 고객·채널에서 반복 요청 (다시 누르면 해제)"
          >
            <span className="material-symbols-outlined text-[13px]">trending_up</span>
            <span>다수 요청</span>
            <span className="font-bold text-[11px]">{counts.highDemand}</span>
          </button>

          {areas.length > 0 && <span className="w-px h-5 bg-slate-200 mx-1 shrink-0" />}

          {areas.map((a) => (
            <button
              key={a}
              onClick={() => toggleFilter(a)}
              className={chip(filter === a)}
              title={`영역: ${a} (다시 누르면 해제)`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
              <span>{a}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 shrink-0">
          <button
            onClick={() => onViewChange('customer')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all ${viewMode === 'customer' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            <span className={`material-symbols-outlined text-[16px] ${viewMode === 'customer' ? 'text-blue-600' : ''}`}>store</span>
            <span>고객사별</span>
          </button>
          <button
            onClick={() => onViewChange('kanban')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all ${viewMode === 'kanban' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            <span className={`material-symbols-outlined text-[16px] ${viewMode === 'kanban' ? 'text-blue-600' : ''}`}>view_kanban</span>
            <span>칸반</span>
          </button>
          <button
            onClick={() => onViewChange('list')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all ${viewMode === 'list' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            <span className={`material-symbols-outlined text-[16px] ${viewMode === 'list' ? 'text-blue-600' : ''}`}>list</span>
            <span>리스트</span>
          </button>
        </div>
      </div>
    </nav>
  );
}

/* ─── 다중 선택 체크박스 드롭다운 ─── */

interface MultiSelectProps {
  label: string;        // 접두 라벨 (툴팁용)
  icon: string;         // material symbol icon
  items: string[];      // 전체 선택지
  counts: Record<string, number>;  // 각 항목당 티켓 수
  selected: string[];   // 선택된 항목
  onChange: (next: string[]) => void;
  accent: 'blue' | 'indigo';
  emptyLabel: string;   // "모든 고객사" 등
  title?: string;
}

function MultiSelectDropdown({ label, icon, items, counts, selected, onChange, accent, emptyLabel, title }: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [alignRight, setAlignRight] = useState(false);

  // 바깥 클릭 시 닫기 + ESC 키로 닫기
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('mousedown', onClick);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onClick);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  // 드롭다운이 뷰포트 오른쪽 밖으로 나가면 오른쪽 정렬로 전환
  useEffect(() => {
    if (!open) return;
    const check = () => {
      const btn = boxRef.current;
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      const panelWidth = 288; // w-72
      setAlignRight(rect.left + panelWidth > window.innerWidth - 16);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [open]);

  const buttonLabel = useMemo(() => {
    if (selected.length === 0) return emptyLabel;
    if (selected.length === 1) return selected[0];
    return `${selected.length}개 선택`;
  }, [selected, emptyLabel]);

  // 데이터가 바뀌면 여기에 들어오는 items도 바뀌므로 자동 반영.
  // 선택된 항목 우선 상단, 나머지는 티켓 수 내림차순으로 정렬.
  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      const aSel = selected.includes(a);
      const bSel = selected.includes(b);
      if (aSel !== bSel) return aSel ? -1 : 1;
      const ac = counts[a] || 0;
      const bc = counts[b] || 0;
      if (ac !== bc) return bc - ac;
      return a.localeCompare(b, 'ko');
    });
  }, [items, selected, counts]);

  const toggle = (name: string) => {
    if (selected.includes(name)) {
      onChange(selected.filter((x) => x !== name));
    } else {
      onChange([...selected, name]);
    }
  };

  const chipActive = selected.length > 0;
  const chipCls = chipActive
    ? (accent === 'blue'
        ? 'bg-blue-50 text-blue-700 border-blue-200'
        : 'bg-indigo-50 text-indigo-700 border-indigo-200')
    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900';
  const rowAccent = accent === 'blue' ? 'hover:bg-blue-50' : 'hover:bg-indigo-50';
  const checkedAccent = accent === 'blue' ? 'text-blue-600 focus:ring-blue-500' : 'text-indigo-600 focus:ring-indigo-500';
  const badgeAccent = accent === 'blue' ? 'bg-blue-600 text-white' : 'bg-indigo-600 text-white';

  return (
    <div className="relative shrink-0" ref={boxRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 transition-colors shrink-0 border ${chipCls}`}
        title={title}
      >
        <span className="material-symbols-outlined text-[13px]">{icon}</span>
        <span>{buttonLabel}</span>
        {selected.length > 0 && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${badgeAccent}`}>
            {selected.length}
          </span>
        )}
        <span className="material-symbols-outlined text-[14px]">{open ? 'arrow_drop_up' : 'arrow_drop_down'}</span>
      </button>
      {open && (
        <div
          ref={panelRef}
          className={`absolute top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 w-72 max-h-96 overflow-hidden flex flex-col ${alignRight ? 'right-0' : 'left-0'}`}
        >
          {/* 상단 액션 바 */}
          <div className="px-3 py-2 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <span className="text-[11px] text-slate-600">
              <strong className="text-slate-900">{selected.length}</strong>
              <span className="text-slate-400"> / {items.length} 선택</span>
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => onChange([])}
                disabled={selected.length === 0}
                className="text-[11px] px-2 py-0.5 rounded text-slate-600 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                모두 해제
              </button>
              <button
                onClick={() => onChange([...items])}
                disabled={selected.length === items.length}
                className={`text-[11px] px-2 py-0.5 rounded font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${accent === 'blue' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}
              >
                모두 선택
              </button>
            </div>
          </div>

          {/* 체크박스 리스트 */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {items.length === 0 ? (
              <p className="text-center text-slate-400 py-6 text-xs">표시할 {label}이(가) 없습니다</p>
            ) : (
              sortedItems.map((name) => {
                const isChecked = selected.includes(name);
                return (
                  <div
                    key={name}
                    role="button"
                    tabIndex={0}
                    onClick={(e) => { e.stopPropagation(); toggle(name); }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(name); }
                    }}
                    className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer select-none ${rowAccent} ${isChecked ? 'bg-slate-50/60' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {}}
                      onClick={(e) => e.stopPropagation()}
                      tabIndex={-1}
                      className={`rounded border-slate-300 ${checkedAccent} shrink-0 pointer-events-none`}
                    />
                    <span className={`flex-1 text-xs truncate ${isChecked ? 'font-semibold text-slate-900' : 'text-slate-700'}`} title={name}>
                      {name}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono shrink-0" title="관련 티켓 수">
                      {counts[name] || 0}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
