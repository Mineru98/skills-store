# 상황 판단과 사용자 의도 확인

`node scripts/issue-end.mjs context` 출력만 근거로 판단한다. 브랜치 이름 느낌으로 넘겨짚지 않는다.

## 읽어야 할 필드

```text
isLinkedWorktree  링크된 워크트리인지 (false = 메인 체크아웃)
branch            현재 브랜치
baseBranch        origin/HEAD 로 판별한 기본 브랜치
onBaseBranch      지금 main/master 위에 있는지
issue             브랜치명에서 추론한 이슈 번호
issueState/Title  gh 로 확인한 실제 이슈
openPr            이 브랜치로 이미 열린 PR
isPrivate         private 저장소면 raw URL 렌더링 불가
dirty             커밋되지 않은 변경 개수
upstream/ahead    push 필요 여부
```

## 분기표

```text
케이스                                   행동
--------------------------------------  ------------------------------------------------
워크트리 + 이슈 추론됨 + 이슈 open       이슈 제목을 보여주고 "이 이슈 맞습니까?" 한 번만 확인
워크트리 + 이슈 추론 실패                AskUserQuestion: 이슈 번호 입력 / 이슈 없이 진행
워크트리 아님(메인 체크아웃)             AskUserQuestion: 이대로 진행 / 중단하고 워크트리로 이동
onBaseBranch = true                      경고 후 확인. main 에 직접 커밋될 수 있음을 명시
이슈는 있으나 현재 브랜치와 무관해 보임   AskUserQuestion: 그 이슈에 붙임 / 다른 번호 / 이슈 없이
openPr 존재                              기존 PR 번호를 알리고 새 PR 대신 코멘트만 추가할지 확인
dirty > 0                                커밋되지 않은 변경 목록을 먼저 보여주고 어떻게 할지 확인
ghAuth = false                           `gh-setup` 스킬로 설치·로그인을 제안. 거절하면 로컬 증거 생성만 진행
```

## 질문 규칙

- AskUserQuestion 으로 묻고, 선택지는 2~4개, 권장안을 첫 번째에 둔다.
- 한 번에 하나의 결정만 묻는다. push/PR/merge를 묶어서 미리 승인받지 않는다.
- 이미 확정된 것은 다시 묻지 않는다.

## 워크트리가 아닐 때 질문 예시

```text
질문: 지금은 워크트리가 아니라 <branch> 체크아웃 상태입니다. 이대로 마무리할까요?
- 이대로 진행 (권장 아님 표기)  → 현재 브랜치에 증거 커밋
- 중단                          → 워크트리로 이동 후 다시 실행
```

`onBaseBranch = true` 인 경우에는 "기본 브랜치에 직접 커밋됩니다" 를 질문 설명에 반드시 넣는다.

## 이슈가 없는 경우

이슈 없이 진행해도 된다. 이때는

- 증거 디렉터리 키가 `no-issue-<branch-slug>` 가 된다.
- 이슈 코멘트 단계와 PR 연결 문구를 건너뛴다.
- 대신 증거 요약을 커밋 메시지 본문과 PR 본문에 넣는다.
