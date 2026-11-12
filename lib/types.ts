export type StatusBucket = 'open' | 'inProgress' | 'done' | 'closed' | 'rejected';

export interface Ticket {
  jiraKey: string;
  jiraUrl: string;
  title: string;
  detail: string;
  type: string;
  area: string;
  jiraStatus: string;
  statusBucket: StatusBucket;
  sprint: string;
  assignee: string;
  requestCount: number;
  customers: string[];
  /** 백엔드가 다신호(고객사 필드 + 고객 대응 Slack 채널)로 판정한 "고객사에서 요청됨" 플래그 */
  customerSourced?: boolean;
  centers: string[];
  reporters: string[];
  answer: string;
  eta: string;
  slackLinks: string[];
  viseIds: string[];
  firstReported: string;
  lastUpdated: string;
  reviewNeeded: boolean;
  reviewReason: string;
}

export interface GasResponse {
  ok: boolean;
  generatedAt?: string;
  totalTickets?: number;
  tickets?: Ticket[];
  /** 매핑되지 않은 Jira 상태 목록 — 있으면 Dashboard가 경고 배너 노출. */
  unknownJiraStatuses?: string[];
  error?: string;
}
