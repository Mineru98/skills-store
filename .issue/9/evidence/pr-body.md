관련 이슈: #9 (통합 테스트 뒤 close)

## 변경 내용

`issue-start` / `issue-end` / `issue-merge` 의 사용자 결정 지점에 AskUserQuestion 사용 지시와 확정 선택지 문구를 붙였습니다. 문서 전용 변경이며 `*.mjs` 스크립트는 건드리지 않았습니다.

- 세 `SKILL.md` 의 `<hard-rules>` 에 공통 규칙 추가
  `사용자가 정해야 할 것은 전부 AskUserQuestion 으로 묻는다. 평문 질문으로 끝내지 않는다.`
- `issue-start` — guard 실패 시 커밋 확인 / 코멘트 렌더링 확인 / 인라인 이슈 등록 승인에 선택지 3개씩
- `issue-end` — 분기표 11행에 도구를 행 단위로 표기, 렌더링 확인 · `openPr` 처리 · PR 생성에 선택지 추가, 자유 입력 예외 절 신설
- `issue-merge` — 지시가 하나도 없던 7개 지점 전부 보강. 정리 질문에 인벤토리의 "이슈가 닫힌 워크트리"를 합류시켜 중복 질문 제거

## 유지한 것

- 필수 단계(기본 브랜치 증거 커밋, 이슈 코멘트)는 선택지로 만들지 않음
- 자동 제외 규칙(`ahead=0` 워크트리 등)의 "물어보지 않는다"
- `issue-create` 는 이미 전 지점이 AskUserQuestion 이라 무변경

## 검증

```bash
node .issue/9/evidence/audit.mjs
```

세 스킬의 마크다운에서 사람에게 답을 받아야 끝나는 서술(`묻는다` / `확인받` / `승인받` 등)을 찾아, 같은 문단(±12줄)에 `AskUserQuestion` 지시가 있는지 검사합니다.

```text
                 before   after
결정 지점            25      25
지시 있음             6      25
지시 누락            19       0
```

## 증거

https://github.com/Mineru98/skills-store/issues/9#issuecomment-5081624473
