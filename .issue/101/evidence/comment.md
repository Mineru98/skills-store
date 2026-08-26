## 작업 요약

이슈 그래프 V2에 Ajv 기반 구조 검증을 추가했습니다.
create/start/end/merge 경계에서 관찰 사실을 검증하고, 실패하면 다음 부작용을 막습니다.
트래커의 CLOSED/MERGED 상태가 오래된 status 라벨보다 우선하도록 고쳤습니다.

## 변경 전후

- 변경 전: `.issue/101/evidence/before/behavior.txt`
  - CLOSED → `open`, MERGED → `plan`으로 파생되던 상태를 기록했습니다.
- 변경 후: `.issue/101/evidence/after/verification.txt`
  - CLOSED/MERGED → `close` 우선 처리와 Ajv·walker 검증 결과를 기록했습니다.
- CLI·JSON Schema·그래프 walker 변경이며 HTTP/UI 화면은 없습니다. 따라서 스크린샷 대신 실행 원본을 남겼습니다.

## 변경 파일

- `tools/issue-ontology/` — Ajv island, graph/action 스키마, fixture, 테스트
- `.claude/skills/issue-onboard/` 및 `.codex/skills/issue-onboard/` — V2 검증과 종료 상태 파생
- `.claude/skills/{issue-create,issue-start,issue-end,issue-merge}/` 및 `.codex/skills/{issue-create,issue-start,issue-end,issue-merge}/` — thin resolver와 경계 guard
- `issue-end` 문서 — PR 생성 전 ontology guard 절차

## 검증

- Node 테스트 15개 통과
- Ajv graph fixture를 Claude/Codex 양쪽 CLI에서 통과
- parent-of 순환 fixture를 walker가 거부
- island가 없을 때 human end guard가 명시적으로 skip
- machine `issue-end.pr`가 실패 envelope을 내고 `phasePr`를 호출하지 않음
- 변경 JavaScript `node --check`, 미러 동일성 검사, `git diff --check` 통과

## 커밋

- 구현: `60dff1f5feef12fe00b86ba54e808f8078bfc9bf`

## 남은 이슈

없음
