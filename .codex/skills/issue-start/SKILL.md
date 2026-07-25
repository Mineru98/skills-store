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
    <item>`gh auth status` 통과 — 실패하면 `gh-setup` 스킬로 설치·로그인을 먼저 끝낸다</item>
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
  </routing>

  <subagents>
    <agent name="issue-verifier" claude-model="haiku" codex-model="gpt-5.6-luna">
      전제 확인 · 작업 성격 판정 · 증거 완결성 점검
    </agent>
  </subagents>

  <hard-rules>
    <rule>before 캡처는 워크트리를 만든 직후, 어떤 파일도 수정하기 전에 찍는다. 순서를 바꾸지 않는다.</rule>
    <rule>커밋은 `guard` 가 통과할 때만 사용자 확인 없이 한다. 실패하면 커밋하지 않고 확인을 받는다.</rule>
    <rule>기본 브랜치에서는 절대 구현하지 않는다. 현재 워크트리에서 브랜치를 갈아타지도 않는다.</rule>
    <rule>증거는 기본 브랜치에 먼저 커밋·푸시한 뒤 이슈에 코멘트한다. 순서를 뒤집으면 이미지가 렌더링되지 않는다.</rule>
    <rule>증거 이미지는 webp 로만 만들고, after 에는 변경 구간을 가리키는 바운딩 박스를 넣는다.</rule>
    <rule>첨부 이미지는 요약만 믿지 않고 Read 로 직접 열어본다.</rule>
    <rule>이슈 상태 변경, PR 생성, merge 를 하지 않는다. 각각 issue-end 와 issue-merge 의 몫이다.</rule>
  </hard-rules>

  <handoff>
    구현·증거·코멘트가 끝나면 같은 워크트리에서 `issue-end` 를 실행한다.
    `issue-end` 는 증거를 재확인하고 기본 브랜치 커밋과 이슈 코멘트를 보강한 뒤 PR 을 만든다.
  </handoff>
</skill>

# 전체 흐름

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
    J -- 아니오 --> J1[AskUserQuestion: sibling / nested] --> J2[settings.json 에 고정] --> K
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
    S --> T[보고 + issue-end 안내]
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
gh auth status
```

`gh` 쪽이 실패하면 **`gh-setup` 스킬을 실행해** 설치·로그인을 끝낸 뒤 이어서 진행한다.

## 1단계 — 체크리스트 생성

TodoWrite 로 아래 11개를 만든다. **단계가 끝날 때마다 즉시 완료로 갱신한다.**

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
```

## 2단계 — 이슈 수집

```bash
node <skill>/scripts/issue-start.mjs fetch {issue_number}
```

세부는 `references/issue-collection.md`.

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

## 6단계 — before 캡처

**워크트리를 만든 직후, 파일을 하나도 고치기 전에** 찍는다. 이 순간의 워크트리는 정의상 pure 하다.
세부는 `references/evidence-capture.md`.

## 7단계 — 구현

`plan.md` 의 작업 계획을 순서대로 수행하고 검증 명령을 돌린다. 세부는 `references/implementation.md`.

## 8단계 — 작업 트리 커밋

```bash
node <skill>/scripts/issue-start.mjs guard
```

통과하면 **사용자에게 묻지 않고** 커밋한다. 실패하면(exit 3) 이유를 보고하고 확인을 받는다.

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

## 마무리 보고

```text
이슈      #{issue_number} <제목>
핵심 발견  <3줄 이내>
계획      .issue/{issue_number}/plan.md
워크트리   <경로> (<layout>)
브랜치    <이름>
커밋      <구현 커밋> + <증거 커밋>
증거      before <n>장 / after <n>장 (박스 <n>개)
코멘트    <이슈 코멘트 URL>
다음      issue-end 실행 — 증거 재확인 후 PR
```
