## 작업 요약

`issue-start`가 증거와 리포트를 게시한 뒤 사람의 검토·승인을 기다리도록 경계를 명확히 했습니다.
`issue-end context`는 로컬 증거와 원격 기본/폴백 브랜치의 blob을 비교해 `evidencePublished`를 반환합니다.
게시본이 같으면 반복 게시하지 않고, 누락되거나 바뀐 경우에만 보강·재게시한 뒤 PR을 만듭니다.

## 변경 전후

- [변경 전 워크플로 증거](https://raw.githubusercontent.com/Mineru98/skills-store/main/.issue/35/evidence/before/workflow.txt)
- [변경 후 워크플로 및 전체 검증 증거](https://raw.githubusercontent.com/Mineru98/skills-store/main/.issue/35/evidence/after/workflow.txt)

문서·자동화 흐름 변경이라 화면 캡처와 바운딩 박스는 적용하지 않았습니다. 대신 같은 검색 조건과 flow 테스트의 텍스트 출력을 전후로 남겼습니다.

## 변경 파일

- `.claude/skills/issue-start/`, `.codex/skills/issue-start/` — 증거 게시 후 검토 승인 경계와 인계 선택지 명시
- `.claude/skills/issue-end/`, `.codex/skills/issue-end/` — 게시 상태 판정과 조건부 보강 책임으로 축소
- `scripts/test-flow.sh` — 게시 직후 일치와 게시 후 로컬 변경 감지 회귀 테스트 추가
- `README.md` — `issue-create → issue-start → 검토·승인 → issue-end → issue-merge` 흐름 문서화

## 검증

- `node scripts/test-common.mjs` 통과
- `node scripts/test-tracker.mjs` 통과
- `node scripts/test-docs.mjs` 통과
- `sh scripts/test-flow.sh` 통과
- `sh scripts/test-issue-create.sh` 통과
- `sh scripts/test-preflight.sh` 통과
- `sh scripts/verify-ignore.sh` 통과
- `sh scripts/check-shared.sh` 통과

## 남은 이슈

- 없음
