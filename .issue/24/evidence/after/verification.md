# 변경 후 검증

- `sh scripts/test-preflight.sh` 통과
  - 같은 파일을 다르게 바꾼 두 브랜치의 누적 preflight가 merge 전에 `app.txt`와 `yarn.lock` 충돌을 보고했다.
  - 원래 base와 작업 워크트리는 수정되지 않았고, generated lockfile과 일반 소스 파일을 구분했다.
  - resolver는 충돌 헌크를 보고하고, marker가 남으면 commit을 막으며, push는 명시 옵션이 있을 때만 수행했다.
  - merge 실패 원인은 conflict / checks / approval / state / unknown으로 분류됐다.
- `sh scripts/test-flow.sh` 통과
- `node scripts/test-common.mjs` 통과
- `node scripts/test-tracker.mjs` 통과
- `sh scripts/check-shared.sh` 통과
- 전체 실행 결과 원문은 `test-output.txt`에 기록했다.

화면 변경이 없는 CLI·문서 작업이므로 이미지 캡처는 적용하지 않았다.
