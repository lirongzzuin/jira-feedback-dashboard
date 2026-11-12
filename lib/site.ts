// 사내 고유 정보(제품명·링크)는 저장소에 남기지 않고 환경변수로 주입한다 (.env.local / Vercel env).
// NEXT_PUBLIC_ 접두사라 빌드 시점에 번들에 인라인된다.

/** 대상 제품/프로젝트 이름. Jira 컴포넌트·제목 태그와 같은 값. 비어 있으면 일반 명칭으로 표시. */
export const PRODUCT_NAME = process.env.NEXT_PUBLIC_PRODUCT_NAME || '';
export const APP_TITLE = `${PRODUCT_NAME ? `${PRODUCT_NAME} ` : ''}고객사 피드백 현황판`;

/** 비어 있으면 해당 링크를 숨긴다. */
export const JIRA_BACKLOG_URL = process.env.NEXT_PUBLIC_JIRA_BACKLOG_URL || '';
export const CONFLUENCE_URL = process.env.NEXT_PUBLIC_CONFLUENCE_URL || '';
