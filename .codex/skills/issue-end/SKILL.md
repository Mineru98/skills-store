---
name: issue-end
description: issue-start 로 구현·커밋까지 끝낸 작업을 마무리합니다. 증거가 충분한지 재확인하고 부족하면 변경 직전 상태의 워크트리를 만들어 다시 캡처한 뒤, 증거와 리포트를 기본 브랜치에 반드시 커밋하고 이슈에 반드시 코멘트를 남긴 다음 PR 을 만듭니다. merge 는 하지 않고 issue-merge 로 넘깁니다. `/issue-end`, "이슈 마무리", "작업 종료", "증거 확인하고 PR" 요청에 사용합니다.
---

<skill>
  <purpose>
    구현이 끝난 작업을 남들이 검증할 수 있는 상태로 만든다.
    증거를 재확인하고, 기본 브랜치에 증거와 리포트를 남기고, 이슈에 코멘트하고, PR 을 만든다.
    merge 는 하지 않는다. 여러 워크트리를 동시에 굴리는 것이 이 스킬군의 전제이기 때문이다.
  </purpose>

  <inputs>
    <arg name="$ARGUMENTS" optional="true">이슈 번호(`#59`, `59`, URL). 생략하면 브랜치 이름에서 추론</arg>
    <detected>워크트리 여부, 브랜치, 이슈 번호, 기존 PR, 증거 완결성</detected>
  </inputs>

  <preconditions>
    <item>현재 디렉터리가 git 저장소</item>
    <item>`gh auth status` 통과 — 실패하면 `gh-setup` 스킬로 먼저 해결</item>
    <item>Node 18+. 재캡처가 필요하면 Playwright 와 sharp/cwebp/ffmpeg 중 하나</item>
  </preconditions>

  <routing>
    <always>references/context-triage.md — 상황 판단과 확인 질문</always>
    <always>references/evidence-recheck.md — 증거 완결성 검사와 pure-tree 재캡처</always>
    <always>references/report-and-pr.md — 기본 브랜치 증거 커밋 · 이슈 코멘트 · PR</always>
    <always>references/next-actions.md — 다음 행동 4지선다와 issue-merge 위임</always>
  </routing>

  <subagents>
    <agent name="issue-verifier" claude-model="haiku" codex-model="gpt-5.6-luna">
      증거 완결성 점검 · 작업 성격 재판정
    </agent>
  </subagents>

  <hard-rules>
    <rule>증거와 리포트를 기본 브랜치에 커밋·푸시하는 6단계와 이슈에 코멘트하는 7단계는 필수다. 건너뛰지 않는다.</rule>
    <rule>증거가 없으면 PR 을 만들지 않는다. 왜 만들 수 없는지 보고하고 멈춘다.</rule>
    <rule>merge 를 실행하지 않는다. 요청받으면 `issue-merge` 로 위임한다.</rule>
    <rule>워크트리를 삭제하지 않는다. 정리는 `issue-merge` 가 통합 후에 한다.</rule>
    <rule>push 와 PR 생성은 각각 따로 확인받는다. 묶어서 승인받지 않는다.</rule>
    <rule>현재 워크트리에서 브랜치를 갈아타지 않는다. 기본 브랜치 작업은 임시 워크트리에서 한다.</rule>
    <rule>이슈 번호를 확정하지 못한 상태에서 임의의 이슈에 코멘트하지 않는다.</rule>
    <rule>측정값과 캡처를 지어내지 않는다. 악화된 지표도 그대로 적는다.</rule>
  </hard-rules>

  <non-goals>
    <item>기능 구현 — `issue-start` 의 몫</item>
    <item>merge 와 워크트리 정리 — `issue-merge` 의 몫</item>
    <item>이슈 본문 수정 — 코멘트만 단다</item>
  </non-goals>

  <reporting>
    문제가 생기면 아래 순서를 그대로 지켜 보고한다. 세 스킬(issue-start / issue-end / issue-merge)이 같은 형식을 쓴다.

    1. 쉬운 말로 쓴다. 전문 용어를 쓸 거면 바로 옆에 풀어 준다.
    2. 지금 무슨 상황인지부터 말한다.
    3. 무엇이 잘못됐는지 말한다.
    4. 잘못되지 않은 것도 말한다 — 무엇은 멀쩡한지 짚어 준다.
    5. 사용자가 정해야 할 것을 고를 수 있게 물어본다. AskUserQuestion 을 쓴다.
  </reporting>
</skill>

# 전체 흐름

```mermaid
flowchart TD
    A[/"/issue-end"/] --> B[context: 워크트리·브랜치·이슈·PR·증거 상태]
    B --> C{상황 확인}
    C -- 워크트리 아님 / 이슈 불명확 --> C1[AskUserQuestion] --> D
    C -- 정상 --> D{evidenceComplete?}

    D -- 아니오 --> E1[pure-tree: 변경 직전 워크트리]
    E1 --> E2[before 재캡처] --> E3[pure-tree --remove] --> F
    D -- 예 --> F[현재 커밋 상태로 after 재캡처·보강]

    F --> G[comment.md 작성·보강]
    G --> H[증거 커밋 + 브랜치 push]
    H --> I["evidence mirror --push  ← 필수"]
    I --> J["gh issue comment  ← 필수"]
    J --> K{코멘트 이미지 렌더링 확인}
    K -- 깨짐 --> K1[mirrorRef·private 여부 점검] --> I
    K -- 정상 --> L{PR 만들까?}
    L -- 예 --> M["gh pr create · 관련 이슈 #N (Closes 금지)"]
    L -- 아니오 --> N
    M --> N[다음 행동 4지선다]
    N -->|merge| O[/issue-merge 위임/]
    N -->|다른 이슈| P[/issue-start 위임/]
    N -->|새 이슈| Q[/issue-create 위임/]
    N -->|종료| R[보고]
```

# 스크립트 경로

아래 중 **존재하는 첫 번째 경로**를 `<skill>` 로 쓴다. 하나도 없으면 각 레퍼런스의 인라인 절차를 쓴다.

```text
.claude/skills/issue-end      # 현재 프로젝트 (Claude Code)
.codex/skills/issue-end       # 현재 프로젝트 (Codex)
~/.claude/skills/issue-end    # 홈 설치
~/.codex/skills/issue-end     # 홈 설치
```

`<skill>` 이 `.claude/` 밑이면 실행 계열은 **claude**, `.codex/` 밑이면 **codex** 다.

# 서브에이전트

```text
claude  .claude/agents/issue-verifier.md   (model: haiku)
codex   .codex/agents/issue-verifier.toml  (model = "gpt-5.6-luna")
```

없으면 `migrate-skill-agent.sh --agent issue-verifier --target home --link --clone` 으로 설치한다.
실패하면 기본 서브에이전트로 진행하고 "모델 고정 실패"를 한 줄 보고한다.

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

질문: 증거를 어디에 올릴까요?
- 별도 브랜치에 올리기 (권장)   evidence/issue-59 브랜치를 만들어 올립니다. 이슈의 이미지는 정상 표시됩니다.
- 이미지를 직접 첨부           이슈 웹 페이지에 이미지를 끌어다 놓습니다. 손이 한 번 더 갑니다.
- 증거 없이 진행               이미지 없이 글로만 남깁니다. 나중에 확인이 어려워집니다.
```

# 실행 순서

## 0단계 — 상황 판단

```bash
node <skill>/scripts/issue-end.mjs context
```

출력의 `isLinkedWorktree` / `issue` / `evidenceComplete` / `onBaseBranch` / `openPr` 를 읽고 분기한다.
세부는 `references/context-triage.md`.

## 1단계 — 체크리스트 생성

TodoWrite 로 아래 10개를 만든다. **단계가 끝날 때마다 즉시 완료로 갱신한다.**

```text
1.  상황 판단 (context)
2.  증거 존재·완결성 확인
3.  누락 시 pure-tree 로 before 재캡처
4.  현재 커밋 상태로 after 재캡처·보강
5.  리포트 작성·보강 (comment.md)
6.  증거·리포트를 기본 브랜치에 커밋·푸시   [필수]
7.  이슈에 증거 기반 코멘트                [필수]
8.  코멘트 렌더링 확인
9.  PR 생성
10. 다음 행동 선택
```

6번과 7번의 `[필수]` 표시를 그대로 남긴다. 사용자가 진행 상황을 볼 때 이 둘이 선택이 아님이 드러나야 한다.

## 2~4단계 — 증거 재확인

`issue-start` 가 이미 증거를 만들어 뒀다면 여기서는 **재확인과 보강**만 한다.
`evidenceComplete: false` 면 `pure-tree` 로 변경 직전 상태를 만들어 before 를 다시 찍는다.
세부는 `references/evidence-recheck.md`.

## 5~9단계 — 리포트·미러 커밋·코멘트·PR

`references/report-and-pr.md` 를 따른다. 6·7단계는 조건부가 아니다.

9단계에서 PR 을 만든 직후 진행 상태를 `status:review` 로 옮긴다. 다른 전환과 달리 이건 자동이 아니다.

```bash
node <skill>/scripts/issue-end.mjs status {issue_number} review
```

## 10단계 — 다음 행동

`references/next-actions.md` 의 4지선다를 그대로 제시한다.

## 마무리 보고

```text
이슈      #{issue_number} <제목>
브랜치    <이름>
증거      before <n>장 / after <n>장 (박스 <n>개)
미러      <mirrorRef> (fallback 이면 그 사실 명시)
코멘트    <이슈 코멘트 URL> (신규 / 기존 갱신)
PR        <PR URL 또는 "만들지 않음 — 사유">
상태      status:review (실패했으면 그 사실)
동기화    기본 브랜치 체크아웃에서 `git pull --rebase origin <base>` 필요
다음      <사용자가 고른 행동>
```
