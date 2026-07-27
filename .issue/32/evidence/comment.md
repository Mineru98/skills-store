## 작업 요약

GitHub 저장소의 fork 여부와 기여 관례를 읽기 전용으로 스캔하는 `convention` 스킬을 Claude와 Codex 양쪽에 추가했습니다.
재스캔은 로컬 지침 파일의 전용 블록만 교체하며, 대상 파일을 `.gitignore`에 중복 없이 등록합니다.
fake `gh`로 fork/clone, 문서·템플릿·이력 분석, 무변경 보장을 회귀 테스트했습니다.

## 변경 전후 증거

- [변경 전 — 스킬과 회귀 테스트 부재](https://raw.githubusercontent.com/Mineru98/skills-store/main/.issue/32/evidence/before/test-convention.txt)
- [변경 후 — 전체 검증 통과](https://raw.githubusercontent.com/Mineru98/skills-store/main/.issue/32/evidence/after/test-convention.txt)

이 작업은 CLI 스킬·로컬 Markdown 지침·회귀 테스트만 바꾸므로 브라우저 화면과 바운딩 박스는 의미가 없어 생략했습니다. 대신 실행 가능한 테스트 원문을 증거로 남겼습니다.

## 변경 파일

- `.claude/skills/convention/` — Claude용 스킬과 스캐너
- `.codex/skills/convention/` — Codex용 스킬, 스캐너, UI 메타데이터
- `scripts/test-convention.mjs` — fake `gh` 기반 회귀 테스트
- `scripts/check-shared.sh` — 두 런타임 미러 검사 대상 추가

## 검증

- `node scripts/test-convention.mjs` 통과
- `diff -r -x agents .claude/skills/convention .codex/skills/convention` 통과
- `sh scripts/check-shared.sh` 통과
- `git diff --check HEAD^ HEAD` 통과

## 남은 이슈

- 없음
