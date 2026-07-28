## 작업 요약

공개 저장소용 raw 이미지 링크와 비공개 저장소용 `user-attachments` 링크를 프롬프트에서 명확히 분기했습니다.
`issue-create` 인계부터 `issue-start`의 증거 게시·검증 단계까지 같은 규칙을 사용합니다.

## 변경 근거

문서·프롬프트 변경이라 UI 캡처와 바운딩 박스는 생략했습니다. 대신 수정 전후 문구와 검증 결과를 텍스트 증거로 남겼습니다.

- 변경 전: `.issue/47/evidence/before/prompt-check.txt`
- 변경 후: `.issue/47/evidence/after/prompt-check.txt`

## 변경 파일

- `.claude/skills/issue-create/references/create-and-handoff.md` — 인계 시 공개/비공개 이미지 URL 규칙 명시
- `.claude/skills/issue-start/SKILL.md` — 핵심 흐름과 단계에 공개 범위 분기 추가
- `.claude/skills/issue-start/references/evidence-capture.md` — URL 선택·게시·렌더링 확인 절차 정리
- `.codex/skills/...` — Claude 지침과 같은 내용으로 동기화
- `scripts/test-flow.sh` — 프롬프트 회귀 검사 추가

## 검증

- `sh scripts/test-flow.sh` 통과
- `node scripts/test-images.mjs` 통과
- `sh scripts/check-shared.sh` 통과
- `git diff --check` 통과

## 남은 이슈

없음
