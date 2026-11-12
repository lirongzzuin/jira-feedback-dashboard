# Jira Feedback Dashboard

Slack으로 들어온 고객사 요청이 Jira 티켓으로 어떻게 처리되고 있는지 한 화면에서 보는 운영용 대시보드입니다.
요청이 여러 채널·담당자에게 흩어져 있어 "어느 고객사의 어떤 요청이 방치되고 있는지"를 파악하기 어려웠던 문제를 해결하려고 만들었습니다.

> 실제 사내 데이터를 다루기 때문에 운영 배포는 접근이 제한되어 있고, 스크린샷은 첨부하지 않았습니다.

## 주요 기능

- **3가지 뷰**
  - **칸반**: 접수 / 작업 중 / 완료 / 종료 / 반영불가 5단계. 진행 중인 컬럼일수록 넓게 배치
  - **고객사별**: 고객사마다 활성·상태별 건수, 미배정, 최장 경과일, Slack 요청 수, 주 요청자를 정렬 가능한 표로 보여주고, 영역 × 고객사 매트릭스로 쏠림을 확인. "티켓 열기"를 누르면 해당 고객사로 필터된 칸반으로 이동
  - **리스트**: 상태별 그룹 + 열 정렬 + CSV 내보내기
- **운영 신호 자동 표시**: 담당자 미지정, 14일 이상 방치, Slack 요청 3건 이상(다수 요청) 티켓을 배지와 테두리로 강조
- **필터**: 고객사·요청자 다중 선택(필터 간 AND, 항목 간 OR), 고객사 요청 / 내부 발의 구분, 영역별 칩. 적용 중인 필터는 상단 바에서 개별 해제
- **실시간성**: 2분 주기 자동 갱신(탭이 숨겨지면 일시정지, 돌아오면 즉시 갱신), 남은 시간 카운트다운, 수동 새로고침(`r`), 검색(`/`)
- **데이터 품질 경고**: 백엔드가 분류하지 못한 Jira 상태가 생기면 배너로 알림

## 아키텍처

```
Slack 스레드 ──┐
               ├─▶ Google Apps Script (수집·집계, Google Sheet 원장)
Jira 티켓 ─────┘            │  doGet() → JSON
                            ▼
                Next.js on Vercel
                ├─ 서버: GAS 호출 (URL·토큰은 서버 환경변수에만 존재)
                └─ 클라이언트: 필터·정렬·집계를 메모리에서 처리
```

- 브라우저는 GAS를 직접 호출하지 않습니다. 서버 컴포넌트와 `/api/tickets`가 대신 호출하므로 백엔드 URL과 토큰이 클라이언트 번들에 노출되지 않고 CORS 문제도 없습니다.
- 데이터는 수백 건 규모라 한 번에 받아 클라이언트에서 `useMemo`로 파생 지표(버킷별 집계, 고객사 요약, 필터 결과)를 계산합니다.
- 캐시는 쓰지 않습니다(`force-dynamic`, `no-store`). 보는 사람이 적고 데이터 신선도가 더 중요하기 때문입니다.

## 구현하며 다룬 문제

- **하이드레이션 불일치**: `Intl.DateTimeFormat`이 서버(Node)와 브라우저에서 `AM`/`오전`으로 다르게 출력되어 React 하이드레이션 에러가 났습니다. 타임존 오프셋을 직접 계산하는 포맷터로 바꿔 서버·클라이언트 출력을 일치시켰습니다.
- **같은 티켓의 중복 집계**: 하나의 티켓이 여러 고객사에 걸리면 고객사별 합계가 실제 티켓 수보다 커집니다. 요약은 고유 티켓 기준으로, 표는 고객사 기준으로 집계하고 차이를 화면에 명시했습니다.
- **요청자 정의**: Slack에서 담당자 본인이 티켓을 전달한 경우까지 "요청자"로 잡히는 문제를 막기 위해, 이름 뒤 채널 접미사를 떼고 담당자 목록과 비교해 제외합니다.
- **민감정보 분리**: 사내 링크·제품명·백엔드 URL을 모두 환경변수로 옮겨 코드에는 회사 고유 정보가 남지 않도록 했습니다.

## 기술 스택

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind CSS · Vercel · Google Apps Script

## 로컬 실행

```bash
npm install
cp .env.example .env.local   # 값 채우기
npm run dev                  # http://localhost:3000
```

| 환경변수 | 필수 | 설명 |
|---|---|---|
| `GAS_WEBAPP_URL` | ✅ | GAS 웹 앱 `/exec` URL |
| `GAS_SHARED_TOKEN` | | GAS 호출 시 `?token=`으로 붙는 공유 비밀값 |
| `NEXT_PUBLIC_PRODUCT_NAME` | | 화면 제목과 Jira 태그 안내에 쓰는 제품명 |
| `NEXT_PUBLIC_JIRA_BACKLOG_URL` | | 헤더·푸터의 Jira 백로그 링크 (비우면 숨김) |
| `NEXT_PUBLIC_CONFLUENCE_URL` | | 푸터의 문서 링크 (비우면 숨김) |

## 백엔드 응답 형식

`GAS_WEBAPP_URL`은 아래 형태의 JSON을 반환해야 합니다. 전체 타입은 [`lib/types.ts`](lib/types.ts)에 있습니다.

```jsonc
{
  "ok": true,
  "generatedAt": "2026-01-01T09:00:00+09:00",
  "tickets": [
    {
      "jiraKey": "PROJ-123",
      "title": "…",
      "statusBucket": "open",          // open | inProgress | done | closed | rejected
      "assignee": "…",
      "customers": ["…"],
      "reporters": ["…"],
      "requestCount": 2,
      "slackLinks": ["…"],
      "firstReported": "2026-01-01 09:00:00"
      // …
    }
  ],
  "unknownJiraStatuses": []
}
```
