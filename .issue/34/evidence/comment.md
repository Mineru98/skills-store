## 작업 요약

이슈 본문과 댓글의 이미지 링크를 실제 자산 기준으로 수집·검증하도록 개선했습니다.
Markdown 이미지와 HTML 이미지를 입력으로 읽고, 상대경로·private blob·release asset을 인증 가능한 자산 경로로 처리합니다.
새 리포트는 게시 전에 설명이 있는 Markdown 이미지 문법인지 기계적으로 검사합니다.

## 원인과 변경

- 상대 URL을 버리던 수집기를 출처 URL 기반 파서로 교체했습니다.
- 본문·댓글 위치, 원본 URL, 해석 URL과 실패 이유를 보존합니다.
- GitHub·Jira 신뢰 호스트에만 인증 헤더를 전달합니다.
- private blob은 raw 경로로, release asset은 GitHub API로 다운로드합니다.
- HTTP 상태, Content-Type과 파일 시그니처를 함께 검사합니다.
- HTML, bare 이미지 URL, 일반 이미지 링크, blob 페이지, 빈 alt, private raw/release 출력을 `report-check`로 차단합니다.
- issue-start와 issue-end의 프롬프트를 입력 호환·Markdown 출력 정규화 규칙으로 갱신했습니다.

## 변경 전후 증거

- 변경 전: 대표 인라인 이미지 4건 중 절대 URL 2건만 수집했고 상대 URL 2건을 누락했습니다.
- 변경 전: private blob은 HTML, private release asset은 404 텍스트로 판정됐으며 실패 파일도 남았습니다.
- 변경 후: `flower-rag` 최신 68개 이슈의 인라인 이미지 124건을 식별하고 124건 모두 실제 이미지로 다운로드했습니다.
- 변경 후: 인라인이 아닌 이미지 후보 19건은 다운로드 대상과 분리했습니다.
- 변경 후: Content-Type과 시그니처가 다른 실제 이미지 4건은 시그니처 기준 확장자로 저장하고 경고했습니다.

원본 결과는 `.issue/34/evidence/before/image-links.txt`와 `.issue/34/evidence/after/image-links.txt`에 있습니다.
초기 감사 시점의 인라인 이미지는 114건이었으며, 검증 시점에는 이슈 내용이 추가되어 124건입니다.

## 검증

- `node scripts/test-images.mjs` 통과
- `node scripts/test-common.mjs` 통과
- `node scripts/test-tracker.mjs` 통과
- `node scripts/test-docs.mjs` 통과
- `sh scripts/test-flow.sh` 통과
- `sh scripts/test-issue-create.sh` 통과
- `sh scripts/check-shared.sh` 통과
- 변경된 JavaScript 모듈의 `node --check` 통과
- 실제 private blob, user-attachments, release asset 다운로드 통과

## 증거 형식

이번 변경은 CLI·백엔드 처리와 프롬프트 규칙 변경입니다. 화면 전후 비교가 의미 없어 스크린샷 대신 재현 가능한 텍스트 테스트 결과를 사용했습니다.

## 남은 이슈

- 없음
