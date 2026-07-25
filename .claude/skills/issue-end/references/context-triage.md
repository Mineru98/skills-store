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
evidence          before/after 개수, comment.md 유무, 파일 목록
evidenceComplete  before 와 after 가 모두 존재하는지
pureTree          이전 실행이 남긴 pure-tree 경로 (있으면 정리 대상)
worktrees         저장소의 모든 워크트리 — 10단계 선택지에 쓴다
```

## 분기표

```text
케이스                                   행동
--------------------------------------  ------------------------------------------------
워크트리 + 이슈 추론됨 + 이슈 open       이슈 제목을 보여주고 "이 이슈 맞습니까?" 한 번만 확인
워크트리 + 이슈 추론 실패                AskUserQuestion: 이슈 번호 입력 / 이슈 없이 진행
워크트리 아님(메인 체크아웃)             AskUserQuestion: 이대로 진행 / 중단하고 워크트리로 이동
onBaseBranch = true                      경고 후 확인. 기본 브랜치에 직접 커밋될 수 있음을 명시
이슈는 있으나 현재 브랜치와 무관해 보임   AskUserQuestion: 그 이슈에 붙임 / 다른 번호 / 이슈 없이
openPr 존재                              기존 PR 번호를 알리고 새 PR 대신 코멘트만 추가할지 확인
dirty > 0                                커밋되지 않은 변경 목록을 먼저 보여주고 어떻게 할지 확인
ghAuth = false                           `gh-setup` 스킬로 설치·로그인을 제안
evidenceComplete = false                 pure-tree 로 before 재캡처 (evidence-recheck.md)
evidence.total = 0                       issue-start 를 건너뛴 상태. 증거를 처음부터 만들지, 
                                         issue-start 로 돌아갈지 확인
pureTree ≠ null                          이전 실행이 정리하지 못했다. --remove 로 먼저 치운다
```

## 증거가 아예 없을 때

`evidence.total = 0` 이면 `issue-start` 가 실행되지 않았거나 중간에 끊긴 것이다. 이 스킬은 재확인이 역할이므로 처음부터 만드는 것은 예외 경로다.

```text
질문: 증거가 하나도 없습니다. 어떻게 할까요?
- issue-start 로 돌아가기 (권장)   계획·before 캡처부터 제대로 다시
- 여기서 증거 만들기               pure-tree 로 before 를 복원해 진행. 계획 문서 없이 캡처 조건을 직접 정해야 함
- 증거 없이 PR 만 만들기           거부. 이 선택지는 제시하지 않는다
```

세 번째는 선택지로 내놓지 않는다. 증거 없이 PR 을 만들지 않는 것이 hard-rule 이다.

## 질문 규칙

- AskUserQuestion 으로 묻고, 선택지는 2~4개, 권장안을 첫 번째에 둔다.
- 한 번에 하나의 결정만 묻는다. push 와 PR 생성을 묶어서 미리 승인받지 않는다.
- 이미 확정된 것은 다시 묻지 않는다.
- **기본 브랜치 증거 커밋(6단계)과 이슈 코멘트(7단계)는 묻지 않는다.** 필수 단계라 선택지가 없다.
  묻는 것은 그 앞의 `git push` 와 그 뒤의 PR 생성이다.

## 워크트리가 아닐 때 질문 예시

```text
질문: 지금은 워크트리가 아니라 <branch> 체크아웃 상태입니다. 이대로 마무리할까요?
- 이대로 진행 (권장 아님 표기)  → 현재 브랜치에 증거 커밋
- 중단                          → 워크트리로 이동 후 다시 실행
```

`onBaseBranch = true` 인 경우에는 "기본 브랜치에 직접 커밋됩니다" 를 질문 설명에 반드시 넣는다.

## 이슈가 없는 경우

이슈 없이 진행해도 된다. 이때는

- 증거 디렉터리 키가 `no-issue-<branch-slug>` 가 된다. `.issue/no-issue-<slug>/evidence/` 도 같은 규칙으로 커밋된다.
- 이슈 코멘트(7단계)와 PR 의 이슈 참조 줄을 건너뛴다. 붙일 이슈가 없으므로 필수 규칙의 예외다.
- 기본 브랜치 증거 커밋(6단계)은 그대로 한다. PR 본문에서 이미지를 참조하려면 여전히 필요하다.
- 증거 요약을 PR 본문에 넣는다.
