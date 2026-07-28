## 작업 요약

`~/.issue/settings.json`의 `issue.createMode`로 암묵적인 `issue-create` 개입을 선택할 수 있게 했습니다.
기본값은 기존 동작인 `issue-first`이며, `direct`는 암묵 호출만 건너뜁니다.
명시적인 `$issue-create`·`/issue-create`·이슈 등록 요청은 설정과 관계없이 유지됩니다.

## 변경 전후

- 변경 전: `mode` 명령이 없어 exit 1로 실패했습니다.
- 변경 후 기본값: `MODE=issue-first`, `MODE_SOURCE=default`.
- 변경 후 직접 수행: `MODE=direct`, `MODE_SOURCE=settings`.
- 잘못된 값: 경고와 `INVALID_MODE=1`을 출력하고 `issue-first`로 안전하게 복귀합니다.

UI 변경이 아닌 설정·스킬 라우팅·문서 변경이므로 이미지와 바운딩 박스는 생략했습니다.
전후 명령 출력과 전체 테스트 원본은 `.issue/44/evidence/`에 저장했습니다.

## 변경 파일

- `.claude/skills/issue-create`, `.codex/skills/issue-create` — 모드 조회 CLI와 암묵/명시 호출 규칙 추가
- `scripts/test-issue-create.sh` — 기본·direct·invalid 및 Claude/Codex 동등성 회귀 테스트
- `README.md`, `references/provider-settings.md` — 설정 계약과 사용 예시 문서화

## 검증

- `sh scripts/test-issue-create.sh` 통과
- `sh scripts/test-flow.sh` 통과
- `node scripts/test-common.mjs` 통과
- `sh scripts/sync-shared.sh --check` 통과
- Claude/Codex 대응 파일 `cmp` 통과
- trigger tuning: recall 1.000 / specificity 1.000 / accuracy 1.000
- trigger holdout: recall 1.000 / specificity 1.000 / accuracy 1.000
- `git diff --check` 통과

## 남은 이슈

- 없음
