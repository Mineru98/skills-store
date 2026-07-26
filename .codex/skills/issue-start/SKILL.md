---
name: issue-start
description: GitHub 이슈 번호를 받아 본문·코멘트·첨부 이미지를 gh로 수집해 실제로 읽고, 프론트엔드/백엔드 성격에 맞춰 코드베이스와 대조 분석해 계획을 세운 뒤, 워크트리를 만들어 구현하고 커밋하고, 전후 증거를 webp 로 캡처해 기본 브랜치에 먼저 커밋한 다음 이슈에 렌더링되는 리포트를 남깁니다. 이슈 번호 대신 작업 설명을 주면 issue-create 로 이슈부터 등록합니다. `/issue-start`, "이슈 착수", "이슈 분석하고 작업해줘" 요청에 사용합니다.
---

<skill>
  <purpose>
    이슈 하나를 받아 계획 → 워크트리 → 구현 → 커밋 → 증거 → 이슈 리포트까지 끝낸다.
    스크린샷을 실제로 열어보고, 코드와 대조해 원인 가설을 세우고, 변경 전후를 증거로 남긴다.
    PR 생성과 최종 확인은 `issue-end` 가, 여러 워크트리 통합은 `issue-merge` 가 맡는다.
  </purpose>

  <inputs>
    <arg name="$ARGUMENTS" required="true">
      이슈 번호(`#{issue_number}`, `{issue_number}`, 이슈 URL) 또는 이슈로 만들 작업 설명
    </arg>
  </inputs>

  <preconditions>
    <item>현재 디렉터리가 git 저장소</item>
    <item>트래커 인증 통과 — `~/.issue/settings.json` 의 `provider.type` 이 github 면 `gh auth status`, jira 면 baseUrl·projectKey·토큰. github 인증 실패는 `gh-setup` 스킬로 먼저 끝낸다</item>
    <item>git, curl, Node 18+</item>
  </preconditions>

  <routing>
    <branch name="이슈 번호 아님" when="$ARGUMENTS 가 작업 설명">references/intake.md — issue-create 위임과 자동 설치</branch>
    <always>references/issue-collection.md — 이슈·코멘트·이미지 수집과 열람</always>
    <branch name="frontend" when="라벨/본문/스크린샷이 화면 동작을 가리키거나 UI 계층 변경이 예상됨">
      references/frontend-analysis.md
    </branch>
    <branch name="backend" when="API·쿼리·성능·데이터 정합성·배치를 다룸">
      references/backend-analysis.md
    </branch>
    <branch name="both" when="풀스택 이슈">두 레퍼런스를 모두 읽고 계획을 계층별로 나눈다</branch>
    <always>references/worktree.md — 배치 결정, 브랜치 이름 규칙, 워크트리 생성</always>
    <always>references/implementation.md — 구현과 무확인 커밋 규칙</always>
    <always>references/evidence-capture.md — 전후 캡처·바운딩 박스·미러 커밋·이슈 코멘트</always>
    <always>references/next-actions.md — 마무리 뒤 다음 행동 4지선다</always>
  </routing>

  <subagents>
    <agent name="issue-verifier" claude-model="haiku" codex-model="gpt-5.6-luna">
      전제 확인 · 작업 성격 판정 · 증거 완결성 점검
    </agent>
  </subagents>

  <hard-rules>
    <rule>before 캡처는 워크트리를 만든 직후, 어떤 파일도 수정하기 전에 찍는다. 순서를 바꾸지 않는다.</rule>
    <rule>사용자가 정해야 할 것은 전부 AskUserQuestion 으로 묻는다. 평문 질문으로 끝내지 않는다.</rule>
    <rule>커밋은 `guard` 가 통과할 때만 사용자 확인 없이 한다. 실패하면 커밋하지 않고 AskUserQuestion 으로 확인을 받는다.</rule>
    <rule>기본 브랜치에서는 절대 구현하지 않는다. 현재 워크트리에서 브랜치를 갈아타지도 않는다.</rule>
    <rule>증거는 기본 브랜치에 먼저 커밋·푸시한 뒤 이슈에 코멘트한다. 순서를 뒤집으면 이미지가 렌더링되지 않는다.</rule>
    <rule>증거 이미지는 webp 로만 만들고, after 에는 변경 구간을 가리키는 바운딩 박스를 넣는다.</rule>
    <rule>첨부 이미지는 요약만 믿지 않고 Read 로 직접 열어본다.</rule>
    <rule>이슈 상태 변경, PR 생성, merge 를 하지 않는다. 각각 issue-end 와 issue-merge 의 몫이다.</rule>
    <rule>사용자에게 말을 걸 때는 — 전이 보고든 질문이든 — 현재 단계를 반드시 함께 밝힌다.
      본문이 5줄 미만이면 앞에, 5줄 이상이면 마지막 줄에 둔다. 형식은 `# 현재 단계 밝히기` 를 따른다.</rule>
  </hard-rules>

  <handoff>
    구현·증거·코멘트가 끝나면 같은 워크트리에서 `issue-end` 를 실행한다.
    `issue-end` 는 증거를 재확인하고 기본 브랜치 커밋과 이슈 코멘트를 보강한 뒤 PR 을 만든다.
  </handoff>

  <reporting>
    문제가 생기면 아래 순서를 그대로 지켜 보고한다. 세 스킬(issue-start / issue-end / issue-merge)이 같은 형식을 쓴다.

    1. 쉬운 말로 쓴다. 전문 용어를 쓸 거면 바로 옆에 풀어 준다.
    2. 지금 무슨 상황인지부터 말한다.
    3. 무엇이 잘못됐는지 말한다.
    4. 잘못되지 않은 것도 말한다 — 무엇은 멀쩡한지 짚어 준다.
    5. 사용자가 정해야 할 것을 고를 수 있게 물어본다. AskUserQuestion 을 쓴다.
    6. 이슈·PR·코멘트는 `[설명](링크)` 로, 워크트리 경로는 배치에 맞는 형태로 쓴다. `링크와 경로 쓰는 법` 참고.

    문제 상황이 아니어도 사용자에게 말을 걸 때는 현재 단계를 함께 밝힌다.
    다음 단계로 넘어가기 직전의 전이 보고와 승인·확인 질문이 모두 대상이다. `# 현재 단계 밝히기` 를 따른다.
  </reporting>

  <next>
    끝날 때는 항상 다음에 무엇을 할지 골라 준다. references/next-actions.md 의 4지선다를 그대로 쓴다.
  </next>
</skill>

# 전체 흐름

# 현재 단계 밝히기

사용자에게 말을 걸 때는 **지금 어느 스킬의 몇 단계인지** 반드시 함께 적는다. 전이 보고와 AskUserQuestion 질문 본문이 대상이며, 선택지 라벨에는 단계 표기를 넣지 않는다.

## 표기 형식

```text
<스킬 이름> <n>단계(<단계 이름>)

예) issue-start 5단계(워크트리 생성)
```

## 단계 이름 정본

```text
 1  인자 분기 및 전제 확인
 2  이슈 수집
 3  작업 성격 판정
 4  코드베이스 대조 분석
 5  워크트리 생성
 6  before 증거 캡처
 7  구현
 8  작업 트리 커밋
 9  after 증거 캡처
10  증거 미러 커밋·푸시
11  이슈 리포트 코멘트
12  메인 체크아웃 최신화
13  다음 행동 선택
```

## 위치는 분량으로 정한다

```text
5줄 미만   단계를 먼저 말하고, 이어서 할 말을 한다
5줄 이상   할 말을 먼저 하고, 마지막에 `현재 단계 — <표기>` 를 한 줄로 남긴다
```

줄 수는 사용자에게 보이는 본문 기준이며 AskUserQuestion 선택지는 세지 않는다.

### 5줄 미만 — 앞에 붙인다

```text
issue-start 5단계(워크트리 생성)입니다. 워크트리를 어디에 만들지 한 번만 정하겠습니다.
```

### 5줄 이상 — 뒤에 붙인다

```text
계획을 `.issue/11/plan.md` 에 저장했습니다.

원인 가설과 검증 방법을 정리했습니다.
증거 캡처 조건도 함께 확인했습니다.
다음에는 워크트리를 만들겠습니다.

현재 단계 — issue-start 4단계(코드베이스 대조 분석)
```

## 질문일 때

질문 본문에 단계 표기를 넣고, 선택지에는 반복하지 않는다.

```mermaid
flowchart TD
    A[/"/issue-start {인자}"/] --> B{인자가 이슈 번호?}
    B -- 아니오 --> B1[plan 모드 전환]
    B1 --> B2[AskUserQuestion: 이슈로 등록할까요?]
    B2 -- 등록 --> B3[issue-create 설치 확인·자동 설치] --> B4[/issue-create 위임] --> C
    B2 -- 취소 --> Z0[중단]
    B -- 예 --> C{git repo + gh auth}
    C -- 실패 --> Z0
    C -- 통과 --> D[fetch: 본문·코멘트·라벨·이미지 수집]

    D --> E[issue.md 정독 + 이미지 Read 로 열람]
    E --> F{작업 성격 판정}
    F -->|UI| G1[frontend-analysis.md]
    F -->|서버| G2[backend-analysis.md]
    F -->|둘 다| G3[두 레퍼런스 모두]

    G1 --> H[코드베이스 대조 분석]
    G2 --> H
    G3 --> H
    H --> I[plan.md 저장]

    I --> J{worktree.layout 설정됨?}
    J -- 아니오 --> J1[AskUserQuestion: sibling / children] --> J2[settings.json 에 고정] --> K
    J -- 예 --> K[워크트리 생성]

    K --> L[before 캡처 · 파일 수정 전]
    L --> M[구현]
    M --> N{guard 통과?}
    N -- 아니오 --> N1[사용자 확인 후 커밋]
    N -- 예 --> N2[묻지 않고 커밋]
    N1 --> O
    N2 --> O[after 캡처 · 바운딩 박스 포함]

    O --> P[증거 커밋 + 브랜치 push]
    P --> Q[evidence-mirror --push: 기본 브랜치에 증거 커밋]
    Q --> R[evidence-urls: 미러 기준 raw URL]
    R --> S[gh issue comment: 전후 리포트]
    S --> S1[sync-base: 메인 체크아웃 최신화]
    S1 -- 막힘 --> S2[AskUserQuestion: 어떻게 받아올지] --> T
    S1 -- 성공 --> T[보고 + 다음 행동 4지선다]
```

# 스크립트 경로

아래 중 **존재하는 첫 번째 경로**를 `<skill>` 로 쓴다. 하나도 없으면 각 레퍼런스의 인라인 절차를 그대로 수행한다.

```text
.claude/skills/issue-start      # 현재 프로젝트 (Claude Code)
.codex/skills/issue-start       # 현재 프로젝트 (Codex)
~/.claude/skills/issue-start    # 홈 설치
~/.codex/skills/issue-start     # 홈 설치
```

`<skill>` 이 `.claude/` 밑이면 실행 계열은 **claude**, `.codex/` 밑이면 **codex** 다. 이 판별을 서브에이전트 모델 선택과 자동 설치에 쓴다.

# 서브에이전트

판정성 작업은 값싼 모델에 맡긴다. 계열별 모델은 에이전트 정의 파일이 소유한다.

```text
claude  .claude/agents/issue-verifier.md   (model: haiku)
codex   .codex/agents/issue-verifier.toml  (model = "gpt-5.6-luna")
```

정의가 없으면 아래로 설치한다.

```bash
sh <migrate-skill-agent>/scripts/migrate-skill-agent.sh --agent issue-verifier --target home --link --clone
```

설치를 거부하거나 실패하면 기본 서브에이전트로 진행하되 **"모델 고정 실패 — 판정 비용이 높다"** 를 한 줄 보고한다. 모델명을 Task 인자로 넘기려 시도하지 않는다. 양쪽 런타임 모두 지원하지 않는다.

# 문제 보고 형식

무언가 막히거나 어긋났을 때는 아래 다섯 줄 순서를 그대로 지킨다. 순서를 바꾸거나 건너뛰지 않는다.

```text
1. 상황      지금 어디까지 왔고 무엇을 하려던 중인지
2. 문제      무엇이 잘못됐는지
3. 멀쩡한 것  무엇은 문제가 없는지 (사용자가 피해 범위를 알아야 한다)
4. 원인      왜 그렇게 됐는지 (아는 만큼만. 모르면 모른다고 쓴다)
5. 선택      사용자가 정해야 할 것 — AskUserQuestion 으로 고를 수 있게
```

**쉬운 말로 쓴다.** 전문 용어는 꼭 필요할 때만 쓰고, 쓸 때는 바로 옆에 풀어 준다.

```text
나쁜 예   detached HEAD 상태에서 rebase 충돌로 인해 워크트리가 dirty 합니다.
좋은 예   지금 워크트리(이슈 하나를 위해 따로 만든 작업 폴더)에 저장 안 된 변경이 남아 있습니다.
```

**"문제 없는 것"을 반드시 적는다.** 사용자는 어디까지 망가졌는지를 가장 먼저 알고 싶어 한다.

```text
문제      증거 이미지를 기본 브랜치에 올리지 못했습니다.
멀쩡한 것  코드 변경과 커밋은 그대로 남아 있습니다. 이슈도 그대로입니다.
```

**마지막은 항상 질문이다.** 사용자가 무엇을 정해야 하는지 모른 채 끝내지 않는다.
선택지는 2~4개, 권장안을 첫 번째에 두고 각 선택의 결과를 한 줄로 적는다.

### 예시

```text
상황      이슈 #59 의 코드 변경과 커밋까지 끝냈고, 증거를 기본 브랜치에 올리는 중이었습니다.
문제      기본 브랜치가 보호되어 있어 올리지 못했습니다.
멀쩡한 것  코드 변경, 커밋, 작업 브랜치 push 는 모두 끝났습니다. 잃은 것은 없습니다.
원인      저장소 설정에서 main 브랜치에 직접 push 를 막아 둔 것으로 보입니다.

질문: issue-start <n>단계(<단계 이름>)입니다. 증거를 어디에 올릴까요?
- 별도 브랜치에 올리기 (권장)   evidence/issue-59 브랜치를 만들어 올립니다. 이슈의 이미지는 정상 표시됩니다.
- 이미지를 직접 첨부           이슈 웹 페이지에 이미지를 끌어다 놓습니다. 손이 한 번 더 갑니다.
- 증거 없이 진행               이미지 없이 글로만 남깁니다. 나중에 확인이 어려워집니다.
```

# 링크와 경로 쓰는 법

보고·질문·마무리 요약에서 이슈·PR·워크트리를 가리킬 때 아래를 지킨다. 네 스킬(issue-create / issue-start / issue-end / issue-merge)이 같은 규칙을 쓴다.

## 이슈 · PR · 코멘트는 항상 클릭되게

맨 URL 을 그대로 붙이거나 번호만 적지 않는다. `[설명](링크)` 형식으로 쓴다.

```text
나쁜 예   이슈    #59 탭 활성 상태 초기화
          코멘트  https://github.com/owner/repo/issues/59#issuecomment-123

좋은 예   이슈    [#59 탭 활성 상태 초기화](https://github.com/owner/repo/issues/59)
          PR      [#103 fix(tab): 활성 상태 유지](https://github.com/owner/repo/pull/103)
          코멘트  [리포트 보기](https://github.com/owner/repo/issues/59#issuecomment-123)
```

주소는 이미 손에 들어온다. 직접 조립하지 않는다.

```text
gh issue view <n> --json url          이슈 주소
gh pr view <n> --json url             PR 주소
gh issue comment ... 의 출력           방금 단 코멘트 주소
issue-end   context   출력의 issueUrl / openPr.url
issue-merge inventory 출력의 issueUrl / pr.url
```

저장소를 식별하지 못해 주소를 만들 수 없으면 **번호만 적고** 그 사실을 한 줄 남긴다. 없는 링크를 지어내지 않는다.

## 워크트리 경로는 배치에 맞는 형태로

`ctrl+클릭` 으로 열리려면 형태가 배치와 맞아야 한다.

```text
children   저장소 안  → 상대 경로   .issue/worktrees/59-tab-active-state
sibling    저장소 밖  → 절대 경로   /Users/me/work/repo-issue-59
```

sibling 을 상대 경로로 적으면 `../repo-issue-59` 가 되어 **없는 경로로 열린다.** 반대로 children 을 절대 경로로 적으면 쓸데없이 길다.

스크립트가 계산해 둔 값을 그대로 쓴다.

```text
issue-start.mjs worktree   출력의 WORKTREE_DISPLAY=
issue-end.mjs   context    출력의 worktrees[].display
issue-merge.mjs inventory  출력의 worktrees[].display / excluded[].display
```

직접 판단해야 하면 설정이 아니라 **실제 경로**를 본다. `git worktree list` 로 경로를 얻어 저장소 루트 아래면 children, 아니면 sibling 이다. 설정값은 새로 만들 때만 쓰이므로, 이미 있는 워크트리는 예전 설정으로 만들어졌을 수 있다.

# 실행 순서

## 0단계 — 인자 분기와 전제 확인

`$ARGUMENTS` 를 먼저 분류한다.

```text
/(^|\D)(\d{1,6})\s*$/ 또는 /issues\/(\d+)/ 매치  →  이슈 번호 경로 (아래 1단계로)
매치 실패 + 비어있지 않은 텍스트                  →  작업 설명 (references/intake.md)
```

작업 설명이면 **plan 모드로 전환한 뒤** AskUserQuestion 으로 묻는다. 세부는 `references/intake.md`.

이슈 번호 경로면 전제를 확인한다.

```bash
git rev-parse --show-toplevel
```

트래커 인증은 `fetch` 가 알아서 확인한다. 실패하면 **exit 4** 로 빠지면서 무엇이 비었는지 알려 준다.

```text
provider.type = github   gh 인증. 실패하면 `gh-setup` 스킬로 설치·로그인을 끝낸 뒤 이어서 진행
provider.type = jira     ~/.issue/settings.json 의 provider.jira + tokenEnv 환경변수
```

PR 은 트래커와 무관하게 GitHub 에 올라간다. Jira 를 쓰더라도 `gh` 로그인은 여전히 필요하다.

## 1단계 — 체크리스트 생성

TodoWrite 로 아래 13개를 만든다. **단계가 끝날 때마다 즉시 완료로 갱신한다.**

```text
1.  인자 분기 및 전제 확인
2.  이슈 수집 (본문·코멘트·이미지)
3.  작업 성격 판정
4.  코드베이스 대조 분석 + plan.md
5.  워크트리 생성
6.  before 증거 캡처 (pure 상태)
7.  구현
8.  작업 트리 커밋
9.  after 증거 캡처 (바운딩 박스 포함)
10. 증거를 기본 브랜치에 미러 커밋·푸시
11. 이슈에 전후 리포트 코멘트
12. 메인 체크아웃의 기본 브랜치 최신화
13. 다음 행동 선택
```

## 2단계 — 이슈 수집

```bash
node <skill>/scripts/issue-start.mjs fetch {issue_number}
```

세부는 `references/issue-collection.md`.

수집에 성공하면 스크립트가 진행 상태 라벨을 `status:plan` 으로 옮긴다(출력의 `STATUS=`).
이슈를 잡았다는 신호이므로 별도 호출이 필요 없다. 막으려면 `--no-status`.

## 3단계 — 작업 성격 판정

`issue-verifier` 에 위임한다. 라벨, 본문 키워드, 첨부 스크린샷 유무를 근거로 삼는다.

```text
frontend 신호   스크린샷 첨부, "화면/버튼/레이아웃/깨짐/반응형", 라벨 ui·design·frontend
backend 신호    "느림/타임아웃/500/중복/정합성/쿼리", 라벨 api·performance·backend·db
both            사용자 플로우 전체를 다루거나 API 계약 변경이 화면에 영향
neither         문서·설정만 바뀜 — 캡처 대신 변경 근거를 글로 남긴다
```

판정 결과와 근거를 한 줄로 보고한 뒤 해당 레퍼런스를 읽는다.

## 4단계 — 대조 분석과 계획

레퍼런스의 조사 항목을 채운다. 탐색 범위가 넓으면 Explore 에이전트에 위임한다.
계획은 `.issue/{issue_number}/plan.md` 로 저장한다.

계획 문서 구성:

1. **이슈 요약** — 문제 / 요구사항 / 완료 기준 (이미지에서 읽어낸 내용 포함)
2. **원인 가설** — 근거가 되는 `path:line`
3. **작업 계획** — 순서 있는 변경 목록, 파일 단위
4. **검증 방법** — 저장소의 실제 스크립트를 확인해 명령을 특정
5. **증거 계획** — 캡처할 URL·상태·뷰포트, 박스를 그릴 셀렉터, 백엔드면 측정 지표와 명령
6. **미해결 질문** — 제품 결정이 필요하면 AskUserQuestion

**5번 증거 계획은 반드시 채운다.** 6단계에서 곧바로 쓰이고, `issue-end` 가 재확인할 때 기준이 된다.

## 5단계 — 워크트리 생성

`references/worktree.md` 를 따른다. 배치 방식이 정해지지 않았으면 여기서 딱 한 번 묻고 고정한다.

워크트리가 서면 스크립트가 진행 상태를 `status:in-process` 로 옮긴다. 코드가 돌아가기 시작했다는 뜻이다.

## 6단계 — before 캡처

**워크트리를 만든 직후, 파일을 하나도 고치기 전에** 찍는다. 이 순간의 워크트리는 정의상 pure 하다.
세부는 `references/evidence-capture.md`.

## 7단계 — 구현

`plan.md` 의 작업 계획을 순서대로 수행하고 검증 명령을 돌린다. 세부는 `references/implementation.md`.

## 8단계 — 작업 트리 커밋

```bash
node <skill>/scripts/issue-start.mjs guard
git add -A -- ':!.issue'          # 증거는 이 커밋에 넣지 않는다
git commit -m "<type>(<scope>): <요약>"
```

통과하면 **사용자에게 묻지 않고** 커밋한다. 실패하면(exit 3) 이유를 보고하고 AskUserQuestion 으로 확인을 받는다.

`':!.issue'` 를 빼면 6단계에서 만든 before 증거가 구현 커밋에 섞여 리뷰에서 diff 가 읽히지 않는다. 증거는 10단계에서 따로 커밋한다.

## 9단계 — after 캡처

before 와 같은 URL·상태·뷰포트로 찍고, 변경 구간에 `--box` 를 넣는다. before 에도 같은 셀렉터로 박스를 그려 같은 눈높이에서 비교되게 한다.

## 10~11단계 — 미러 커밋과 이슈 코멘트

순서를 지킨다. 이미지 URL 이 기본 브랜치를 가리켜야 이슈에서 바로 렌더링된다.

```bash
node <skill>/scripts/issue-start.mjs evidence-commit {issue_number}
git push -u origin "$(git branch --show-current)"
node <skill>/scripts/issue-start.mjs evidence-mirror {issue_number} --push
node <skill>/scripts/issue-start.mjs evidence-urls {issue_number} --mirrorRef <mirror 출력의 mirrorRef>
gh issue comment {issue_number} --body-file .issue/{issue_number}/evidence/comment.md
```

세부와 코멘트 형식은 `references/evidence-capture.md`.

## 12단계 — 메인 체크아웃 최신화

증거는 임시 워크트리에서 기본 브랜치로 곧장 올라갔다. 사용자의 메인 폴더는 그 커밋을 아직 모른다.

```bash
node <skill>/scripts/issue-start.mjs sync-base
```

안전할 때만 받아온다. 막히면 아무것도 하지 않고 사유만 돌려주므로, 그때는 AskUserQuestion 으로 함께 정한다. 세부는 `references/evidence-capture.md` 의 `9. 메인 체크아웃 최신화`.

## 13단계 — 다음 행동

`references/next-actions.md` 의 4지선다를 그대로 제시한다.

## 마무리 보고

```text
이슈      [#{issue_number} <제목>](<이슈 URL>)
핵심 발견  <3줄 이내>
계획      .issue/{issue_number}/plan.md
워크트리   <WORKTREE_DISPLAY 값> (<layout>)
상태      status:in-process
브랜치    <이름>
기본 브랜치 <base> (<판별 출처>)
커밋      <구현 커밋> + <증거 커밋>
증거      before <n>장 / after <n>장 (박스 <n>개)
코멘트    [리포트 보기](<이슈 코멘트 URL>)
동기화    <메인 최신화 결과 또는 건너뛴 사유>
다음      <사용자가 고른 행동>

현재 단계 — issue-start 13단계(다음 행동 선택) 완료
```
