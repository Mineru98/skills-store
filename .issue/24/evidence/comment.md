## 작업 요약

`issue-merge`가 실제 merge 전에 계획 순서대로 누적 충돌을 확정하도록 만들었습니다.
충돌 해소는 작업 브랜치에서만 준비하며, resolver의 수정 뒤 critic 검토와 사용자 승인 전에는 push하지 않도록 흐름을 명시했습니다.
merge 실패도 충돌·CI·승인 부족·상태로 나눠 반환합니다.

## 변경 근거

화면 변경이 없는 CLI·문서 작업이라 이미지 캡처는 생략했습니다.
대신 전후 동작과 검증 결과를 텍스트로 남겼습니다.

- 전: `preflight`/`resolve` 부재, 파일 겹침만 표시, merge 실패 원인 단일 hint
- 후: 누적 preflight, 충돌 파일·종류 보고, 작업 브랜치 해소 준비, push 전 critic·사용자 승인 흐름

## 변경 파일

- `issue-merge/scripts/issue-merge.mjs` — preflight·resolve·실패 원인 분류
- `issue-merge/references/*.md`와 `SKILL.md` — 충돌 확정·해소·재시도 절차
- `agents/issue-merge-resolver.*` — 양쪽 의도를 보존하는 해소 전담 에이전트
- `scripts/test-preflight.sh` — 두 브랜치 충돌과 안전성 단위 확인

## 검증

- `sh scripts/test-preflight.sh` 통과
- `sh scripts/test-flow.sh` 통과
- `node scripts/test-common.mjs` 통과
- `node scripts/test-tracker.mjs` 통과
- `sh scripts/check-shared.sh` 통과

## 남은 이슈

- 없음
