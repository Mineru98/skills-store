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
워크트리 + 이슈 추론됨 + 이슈 open       AskUserQuestion: 이 이슈 맞음 / 다른 번호 (한 번만)
워크트리 + 이슈 추론 실패                AskUserQuestion: 이슈 번호 입력 / 이슈 없이 진행
워크트리 아님(메인 체크아웃)             AskUserQuestion: 이대로 진행 / 중단하고 워크트리로 이동
onBaseBranch = true                      AskUserQuestion: 기본 브랜치에 직접 커밋됨을 설명에 명시
이슈는 있으나 현재 브랜치와 무관해 보임   AskUserQuestion: 그 이슈에 붙임 / 다른 번호 / 이슈 없이
openPr 존재                              AskUserQuestion: 기존 PR 에 코멘트 / 본문 갱신 / 그대로 둠
dirty > 0                                AskUserQuestion: 변경 목록을 보여주고 커밋 / 그대로 진행
ghAuth = false                           `gh-setup` 스킬로 설치·로그인을 제안
evidenceComplete = false                 pure-tree 로 before 재캡처 (evidence-recheck.md)
evidence.total = 0                       AskUserQuestion: issue-start 로 복귀 / 여기서 증거 생성
pureTree ≠ null                          이전 실행이 정리하지 못했다. --remove 로 먼저 치운다
```

`AskUserQuestion` 이 적히지 않은 행은 사용자에게 묻는 지점이 아니다. 그대로 수행한다.

## 증거가 아예 없을 때

`evidence.total = 0` 이면 `issue-start` 가 실행되지 않았거나 중간에 끊긴 것이다. 이 스킬은 재확인이 역할이므로 처음부터 만드는 것은 예외 경로다.

```text
질문: issue-end 2단계(증거 완결성 확인)입니다. 증거가 하나도 없습니다. 어떻게 할까요?
- issue-start 로 돌아가기 (권장)   계획·before 캡처부터 제대로 다시
- 여기서 증거 만들기               pure-tree 로 before 를 복원해 진행. 계획 문서 없이 캡처 조건을 직접 정해야 함
- 증거 없이 PR 만 만들기           거부. 이 선택지는 제시하지 않는다
```

세 번째는 선택지로 내놓지 않는다. 증거 없이 PR 을 만들지 않는 것이 hard-rule 이다.

## 질문 규칙

- **사용자가 정해야 할 것은 예외 없이 AskUserQuestion 으로 묻는다.** 평문 질문으로 끝내지 않는다.
- 선택지는 2~4개, 권장안을 첫 번째에 둔다.
- **질문 본문에 현재 단계를 적는다** — `issue-end <n>단계(<이름>)입니다.` SKILL.md 의 `# 현재 단계 밝히기` 를 따른다.
  이 문서의 분기표 질문은 전부 1~2단계에서 나온다.
- 한 번에 하나의 결정만 묻는다. push 와 PR 생성을 묶어서 미리 승인받지 않는다.
- 이미 확정된 것은 다시 묻지 않는다.
- **기본 브랜치 증거 커밋(6단계)과 이슈 코멘트(7단계)는 묻지 않는다.** 필수 단계라 선택지가 없다.
  묻는 것은 그 앞의 `git push` 와 그 뒤의 PR 생성이다.

### 자유 입력이 필요한 지점

값을 직접 받아야 하는 곳도 AskUserQuestion 을 먼저 쓴다. 사용자는 선택지의 **Other** 로 값을 넣는다.
질문을 평문으로 던져 값부터 받지 않는다.

```text
이슈 번호 직접 입력        분기표의 "이슈 추론 실패" / "브랜치와 무관해 보임"
검증 명령 입력             evidence-recheck.md — plan.md 에 검증 방법이 없을 때
```

## 워크트리가 아닐 때 질문 예시

```text
질문: issue-end 1단계(상황 판단)입니다. 지금은 워크트리가 아니라 <branch> 체크아웃 상태입니다. 이대로 마무리할까요?
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
