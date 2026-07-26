## 작업 리포트 — #9

세 스킬(`issue-start` / `issue-end` / `issue-merge`)의 사용자 결정 지점을 전수로 찾아 AskUserQuestion 사용 지시와 확정 선택지 문구를 붙였습니다. 문서 전용 변경이라 스크립트 동작은 그대로입니다.

### 감사 결과 (before → after)

```text
                 before   after
결정 지점            25      25
AskUserQuestion 지시  6      25
지시 누락            19       0
```

감사 스크립트: `.issue/9/evidence/audit.mjs`
세 스킬의 마크다운에서 "사람에게 답을 받아야 끝나는 서술"(`묻는다` / `확인받` / `승인받` 등)을 찾아, 같은 문단(±12줄) 안에 `AskUserQuestion` 지시가 있는지 검사합니다. `묻지 않는다` 같은 부정형과 보고 형식 보일러플레이트는 대상에서 뺍니다.

### 누락이 가장 심했던 곳

`issue-merge` 는 사용자 결정 지점 7곳 전부에 지시가 없었습니다. 선택지 문구는 이미 코드블록으로 적혀 있었는데 **어떤 도구로 물어야 하는지가 빠져 있어** 그대로 평문으로 출력되던 상태였습니다.

```text
inventory.md         이슈 불명 워크트리 / 후보 확정 승인
merge-plan.md        merge 계획 승인
verify-and-close.md  merge 실패 후 계속 여부 / 통합 테스트 실패 처리 / 워크트리 정리 / 원격 브랜치 삭제
```

### 변경 내용

- 세 `SKILL.md` 의 `<hard-rules>` 에 공통 규칙 추가
  `사용자가 정해야 할 것은 전부 AskUserQuestion 으로 묻는다. 평문 질문으로 끝내지 않는다.`
- `issue-start` — guard 실패 시 커밋 확인, 코멘트 렌더링 확인, 인라인 이슈 등록 승인에 선택지 3개씩 명시
- `issue-end` — 분기표 11행에 도구를 행 단위로 표기, 렌더링 확인 / `openPr` 처리 / PR 생성에 선택지 추가
- `issue-merge` — 7개 지점 전부 보강, 정리 질문에 인벤토리의 "이슈가 닫힌 워크트리"를 합류시켜 중복 질문 제거
- 값 입력이 필요한 지점(이슈 번호, 검증 명령, 제외 대상)은 **AskUserQuestion 의 Other 로 받는다**고 예외 명시

### 유지한 것

- 필수 단계(기본 브랜치 증거 커밋, 이슈 코멘트)는 선택지로 만들지 않음
- 자동 제외 규칙(`ahead=0` 워크트리 등)의 "물어보지 않는다"
- `issue-create` 는 이미 전 지점이 AskUserQuestion 이라 변경 없음

### 검증

```text
node .issue/9/evidence/audit.mjs   →  MISSING=0 (exit 0)
변경 파일 11개 / +109 -29 / 스크립트 변경 없음
```

증거: `.issue/9/evidence/before/askuserquestion-audit.txt`, `.issue/9/evidence/after/askuserquestion-audit.txt`
