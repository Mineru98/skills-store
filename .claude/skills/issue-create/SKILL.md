---
name: issue-create
description: 이미 굴러가는 저장소에서 코드를 바꾸는 요청이면 크기와 무관하게, 파일을 건드리기 전에 이 스킬로 GitHub 이슈부터 등록합니다. 반대로 빈 폴더나 방금 git init 한 프로젝트에 package.json·tsconfig·lint 설정·기본 레이아웃 같은 초기 뼈대를 세우는 일은 여기 해당하지 않으니 그냥 만들어 주세요. 기능 추가, 버그 수정, 화면이 깨지거나 안 보이거나 잘리거나 새로고침하면 초기화되는 문제, 중복 호출·느린 응답 같은 동작 개선, 안 쓰는 코드·플래그·스크립트 삭제가 전부 해당합니다. 증상만 적어 보낸 버그 리포트, "이거 지워도 될까?" 처럼 물음표로 끝나는 정리 요청, 특정 파일·컴포넌트를 콕 집어 고쳐 달라는 요청도 똑같이 해당합니다. 사용자가 고칠 파일 경로와 구현 방법까지 지정해 줬더라도 바로 편집에 들어가지 않고 이슈부터 만듭니다. 사용자가 "이슈" 를 한 마디도 꺼내지 않아도, 요청이 한 줄짜리로 보여도, 이슈 번호가 함께 오지 않았다면 코드를 읽기 전에 먼저 이 스킬을 탑니다. 한 요청에 독립 작업이 여러 개 섞여 있으면 그만큼 이슈를 나눠 만듭니다. 저장소가 이슈를 만들 단계인지 판정하고, 항목마다 유사 이슈를 검색하고, issue-start 가 그대로 이어받을 형식으로 초안을 만들어 승인받고 라벨과 함께 등록합니다. 등록을 마친 뒤에는 라벨이 빠진 기존 이슈까지 이어서 점검해 보정합니다. `~/.issue/settings.json`의 `issue.createMode`가 `direct`면 암묵적으로 발동한 뒤 조용히 빠져 원래 변경 요청을 계속하지만, `$issue-create`, `/issue-create`, "이슈 만들어줘", "이슈부터 등록" 같은 명시 요청에는 설정과 관계없이 씁니다. 이미 이슈 번호를 받은 착수 요청은 issue-start, 구현이 끝나 증거·PR 차례면 issue-end, 워크트리 통합은 issue-merge 를 쓰고, 코드는 그대로 둔 채 이슈 목록 조회나 라벨 정리만 원하거나 커밋이 거의 없는 새 스캐폴딩 프로젝트라면 쓰지 않습니다.
---

<skill>
  <purpose>
    사용자의 변경 요청이 기본 브랜치에서 바로 시작되지 않게 막고, 먼저 이슈로 등록한다.
    등록할 만한 프로젝트인지 판정하고, 요청 안에 독립 작업이 여러 개면 그만큼 나누고,
    항목마다 중복을 확인한 뒤 착수 분석에 바로 쓸 수 있는 이슈를 만들어 번호를 넘긴다.
    이슈 하나 = 워크트리 하나 = PR 하나가 뒤 단계의 전제라, 뭉친 이슈는 뒤에서 전부 엉킨다.
    이슈 등록이 유일한 목표다. 계획·구현·증거는 전부 `issue-start` 의 몫이다.
  </purpose>

  <inputs>
    <arg name="$ARGUMENTS" required="false">만들 이슈의 내용. 생략하면 직전 대화의 변경 요청을 그대로 쓴다</arg>
  </inputs>

  <preconditions>
    <item>아래 전제는 명시 호출이거나 `issue.createMode=issue-first` 일 때만 확인한다</item>
    <item>현재 디렉터리가 git 저장소</item>
    <item>트래커 인증 통과 — `~/.issue/settings.json` 의 `provider.type` 이 github 면 `gh auth status`, jira 면 baseUrl·projectKey·토큰. github 인증 실패는 `gh-setup` 스킬로 먼저 끝낸다</item>
    <item>git, Node 18+</item>
  </preconditions>

  <routing>
    <always>references/provider-settings.md — 이슈 백엔드(github / jira) 설정</always>
    <always>references/maturity-gate.md — 이슈를 만들 단계인지 판정</always>
    <always>references/split-requests.md — 요청을 이슈 몇 개로 나눌지 판정</always>
    <always>references/issue-draft.md — 초안 작성과 라벨 선택</always>
    <always>references/label-audit.md — 라벨 부착과 기존 이슈 라벨 점검</always>
    <always>references/create-and-handoff.md — 등록과 issue-start 인계</always>
  </routing>

  <subagents>
    <agent name="issue-verifier" claude-model="haiku" codex-model="gpt-5.6-luna">
      전제 확인 · 유사 이슈 중복 검사 · 작업 성격 판정.
      분해된 항목이 여러 개면 항목마다 하나씩 병렬로 띄운다.
    </agent>
  </subagents>

  <hard-rules>
    <rule>코드를 수정하지 않는다. 이슈 생성까지만 한다.</rule>
    <rule>복합 요청은 원자 후보를 먼저 모두 추출하고, 강결합된 후보만 묶은 뒤 독립 그룹만 쪼갠다. 라벨 차이는 분할 필수 조건이 아니다.</rule>
    <rule>분할안을 승인받기 전에는 초안을 쓰지 않는다. 승인은 분할안 · 초안 두 번 받는다.</rule>
    <rule>등록은 항목마다 `create` 를 따로 호출한다. 한 번의 호출로 여러 이슈를 만들 수 없다.</rule>
    <rule>초안을 보여주고 승인받기 전에는 이슈를 등록하지 않는다.</rule>
    <rule>암묵 호출이면 다른 전제보다 먼저 `issue.createMode` 를 확인한다. `direct` 면 조용히 빠지고 원래 요청을 계속한다.</rule>
    <rule>명시적인 `$issue-create`, `/issue-create`, 이슈 등록 요청은 `direct` 여도 기존 흐름을 실행한다.</rule>
    <rule>성숙도 게이트가 SKIP 이면 조용히 빠지고 원래 요청을 방해하지 않는다.</rule>
    <rule>사용자가 `/issue-create` 를 직접 호출하면 게이트를 건너뛴다.</rule>
    <rule>유사한 열린 이슈가 있으면 새로 만들지 않고 그 번호를 제시한다.
      항목이 여러 개면 중복인 항목만 빼고 나머지는 그대로 진행한다.</rule>
    <rule>만든 이슈에는 성격 라벨을 반드시 하나 이상 붙인다. 스크립트가 성격 라벨 없는 `create` 를 exit 2 로 막는다.</rule>
    <rule>진행 상태 라벨(`status:*`)은 상호배타다. 바꿀 때는 `status` 명령으로 교체하고, 직접 add/remove 를 조합하지 않는다.</rule>
    <rule>상태 전환 실패는 흐름을 막지 않는다. 경고만 남기고 진행한 뒤 마무리 보고에 적는다.</rule>
    <rule>라벨을 새로 만들거나 기존 이슈의 라벨을 바꾸는 것은 사용자 승인 후에만 한다. `status:open` 자동 부착은 예외다.</rule>
    <rule>이슈 상태 변경, 코멘트 작성, PR 생성을 하지 않는다.</rule>
  </hard-rules>

  <handoff>
    이슈를 만든 뒤 착수 여부를 묻고, 예면 같은 번호로 `issue-start` 를 이어서 실행한다.
    여러 건이면 첫 번호로만 이어가고 나머지 번호는 안내만 한다. 동시에 착수하지 않는다.
    `.issue/<번호>/request.md` 에 원본 요청을 남겨 `issue-start` 의 대조 분석이 재사용한다.
    `.gitignore` 의 `.issue` 블록은 등록 시 자동으로 들어간다.
    흐름은 `issue-create` → `issue-start` → `issue-end` → `issue-merge`.
  </handoff>

  <reporting>
    이슈·PR·코멘트는 `[설명](링크)` 로 쓴다. `링크와 경로 쓰는 법` 참고.
    문제가 생기면 상황 → 문제 → 멀쩡한 것 → 원인 → 선택 순서로 쉬운 말로 보고하고, 마지막은 AskUserQuestion 으로 닫는다.
  </reporting>

  <next>
    끝날 때는 항상 다음에 무엇을 할지 골라 준다. references/next-actions.md 의 4지선다를 그대로 쓴다.
  </next>
</skill>

# 전체 흐름

```mermaid
flowchart TD
    A[/"변경 요청 감지 또는 명시 호출"/] --> A1{명시 호출?}
    A1 -- 예 --> B
    A1 -- 아니오 --> A2[mode: issue.createMode 확인]
    A2 -->|direct| Z1[조용히 종료 · 원래 요청 계속]
    A2 -->|issue-first| B{git repo + gh auth}
    B -- 실패 --> B1[초안만 남기고 중단] --> Z0[종료]
    B -- 통과 --> C[gate: 성숙도 신호 판정]

    C -->|SKIP| Z1[조용히 종료 · 원래 요청 계속]
    C -->|ASK| C1[AskUserQuestion: 이슈 등록할지 확인]
    C1 -- 아니오 --> Z1
    C1 -- 예 --> S
    C -->|READY| S[요청 분해: 원자 후보 추출·강결합 그룹화]

    S --> S1{분할안 승인?}
    S1 -- 병합·분리 --> S
    S1 -- 취소 --> Z0
    S1 -- 승인 --> D

    subgraph PER["항목마다 반복 (1~5건)"]
      D[search: 유사 열린 이슈 검색] -- 유사 이슈 있음 --> D1[이 항목만 건너뜀]
      D -- 없음 --> E{작업 성격 판정}
      E -->|UI 변경| F1[frontend 항목 채우기]
      E -->|서버 변경| F2[backend 항목 채우기]
      E -->|둘 다| F3[양쪽 모두]
      F1 --> G[labels 확인 후 초안 작성]
      F2 --> G
      F3 --> G
    end

    D1 --> H
    G --> H{초안 N건 일괄 승인?}
    H -- 일부 수정 --> G
    H -- 취소 --> Z0
    H -- 승인 --> I[create × N: 성격 라벨 + status:open · 실패는 건너뛰고 계속]

    I --> M[unlabeled: 성격·상태 라벨 점검]
    M -- 없음 --> J
    M -- 있음 --> M1[제목·본문으로 라벨 제안]
    M1 --> M2{일괄 적용 승인?}
    M2 -- 아니오 --> J
    M2 -- 예 --> M3[label: 이슈별 라벨 부착] --> J

    J[다음 행동 4지선다]
    J -->|착수| K[첫 번호로 issue-start 실행 · 나머지는 안내]
    J -->|이슈 더 등록| A
    J -->|라벨 정리| M1
    J -->|종료| L[이슈 번호와 명령만 안내]
```

# 스크립트 경로

아래 중 **존재하는 첫 번째 경로**를 `<skill>` 로 쓴다. 하나도 없으면 각 레퍼런스의 인라인 절차를 그대로 수행한다.

```text
.claude/skills/issue-create      # 현재 프로젝트 (Claude Code)
.codex/skills/issue-create       # 현재 프로젝트 (Codex)
~/.claude/skills/issue-create    # 홈 설치
~/.codex/skills/issue-create     # 홈 설치
```

`<skill>` 이 `.claude/` 밑이면 실행 계열은 **claude**, `.codex/` 밑이면 **codex** 다. 이 판별로 서브에이전트 모델을 고른다.

# 서브에이전트

전제 확인 · 중복 검사 · 성격 판정은 판정성 작업이라 값싼 모델에 맡긴다.

```text
claude  .claude/agents/issue-verifier.md   (model: haiku)
codex   .codex/agents/issue-verifier.toml  (model = "gpt-5.6-luna")
```

없으면 `migrate-skill-agent.sh --agent issue-verifier --target home --link --clone` 으로 설치한다.
실패하면 기본 서브에이전트로 진행하고 "모델 고정 실패"를 한 줄 보고한다.

# 실행 순서

## 사전 단계 — 동작 모드 확인

암묵적으로 발동했을 때만 다른 전제보다 먼저 실행한다.

```bash
node <skill>/scripts/issue-create.mjs mode
```

```text
MODE=issue-first   기존 흐름을 계속한다. 설정이 없을 때의 기본값이다.
MODE=direct        조용히 종료하고 원래 변경 요청을 그대로 수행한다.
INVALID_MODE=1     잘못된 값이다. 경고를 남기고 안전하게 issue-first 로 진행한다.
```

`$issue-create`, `/issue-create`, "이슈 만들어줘", "이슈부터 등록"처럼 사용자가 이슈 등록을
명시했으면 이 단계를 건너뛰고 기존 흐름을 실행한다.

## 0단계 — 전제 확인

```bash
git rev-parse --show-toplevel
```

트래커 인증은 스크립트가 알아서 확인한다. `create` 를 뺀 모든 모드는 인증이 안 되어 있으면
**exit 4** 로 빠지면서 무엇을 채워야 하는지 알려 준다.

```text
provider.type = github   gh 인증. 실패하면 `gh-setup` 스킬로 설치·로그인을 끝낸 뒤 이어서 진행
provider.type = jira     ~/.issue/settings.json 의 provider.jira (baseUrl·projectKey·email)
                         + tokenEnv 가 가리키는 환경변수
```

`gh-setup` 이 없는 환경이면 그 사실을 알리고, 이슈 본문 초안만 마크다운으로 남긴 뒤 중단한다.
git 저장소가 아니면 그대로 중단한다.

## 1단계 — 성숙도 게이트

```bash
node <skill>/scripts/issue-create.mjs gate
```

`VERDICT` 에 따라 갈린다.

```text
READY   바로 2단계로 진행
ASK     AskUserQuestion 으로 한 번 확인. 아니면 종료
SKIP    아무 말 없이 종료하고 원래 요청을 그대로 수행
```

판정 기준은 `references/maturity-gate.md`. 사용자가 `/issue-create` 를 직접 호출했으면 이 단계를 건너뛴다.

## 2단계 — 요청 분해와 분할안 승인

`references/split-requests.md` 를 따른다. 문장 수가 아니라 독립적으로 구현·검증·되돌릴 수 있는 작업 경계를 찾는다.

```text
원자 추출       대상 + 변화/증상 + 완료 신호 단위로 후보를 모두 펼친다
강결합 그룹화   API/UI 계약, 공통 완료 기준·근본 원인, 배포·마이그레이션·사용자 흐름 결합을 묶는다
독립성 확인     그룹별 별도 배포 / 검증 / 취소 / 되돌리기가 모두 가능할 때만 쪼갠다
라벨            차이는 보조 신호다. 같은 라벨도 독립적이면 쪼갠다
부분 결합       연결된 후보만 묶고 나머지는 별도 이슈로 둔다
상한            최대 5개. 6개 이상이면 범위를 3~5개로 조정하거나 급한 5개를 고르게 한다
```

작업이 하나뿐이면 이 단계를 건너뛰고 3단계로 간다.
여러 개면 **제목 + 한 줄 요약 + 예상 라벨** 목록만 보여주고 AskUserQuestion 으로 승인 / 병합 / 분리 / 취소를 받는다.
본문은 아직 쓰지 않는다.

## 3단계 — 항목별 중복 검사

확정된 항목마다 따로 돈다.

```bash
node <skill>/scripts/issue-create.mjs search "<항목 키워드>"
```

`MATCHES` 가 0 이 아니고 내용이 겹치면 그 번호와 제목을 보여주고, **그 항목만 빼고** 나머지를 진행한다.
빠진 항목은 마무리 보고의 `건너뜀` 줄에 남긴다. 항목이 하나뿐이었다면 `/issue-start #N` 을 제안하고 종료한다.
겹치는지 애매하면 AskUserQuestion 으로 "기존 이슈에 붙일지 / 새로 만들지" 를 묻는다.
후보마다 `subject`, `outcome`, `scope`, `acceptance`를 채운 `candidate/targets` JSON을 만들고 `create`
호출에 `--duplicate-review-file`로 넘긴다. 네 조건이 모두 일치한 열린 후보는 자동 차단하지 않지만,
사람이 GitHub에 남긴 구조화 `duplicate-of` 결정 id 없이는 새 이슈를 만들지 않는다. 판단 불가 또는
불일치이면 `review-or-create`로 진행한다. 검토 자체가 불가능한 예외만 `--skip-duplicate-review`로 기록한다.

## 4단계 — 항목별 작업 성격 판정

`issue-start` 3단계와 같은 신호를 쓴다. 판정 결과가 본문 항목과 라벨을 결정한다.

```text
frontend 신호   화면·버튼·레이아웃·반응형·깨짐, 스크린샷이 있는 요청
backend 신호    API·쿼리·성능·타임아웃·정합성·배치
both            사용자 플로우 전체를 다루거나 API 계약 변경이 화면에 영향
```

항목마다 성격이 다를 수 있다. 요청 전체로 뭉뚱그려 판정하지 않는다.

## 5단계 — 초안 작성과 일괄 승인

`references/issue-draft.md` 를 따른다. 저장소에 이슈 템플릿이 있으면 그것을 우선한다.
항목마다 초안을 채우고 **전문을 한 번에** 보여준 뒤, AskUserQuestion 으로 일괄 승인 / 일부 수정 / 취소를 받는다.

## 6단계 — 등록

`references/create-and-handoff.md` 를 따른다. **성격 라벨 없이 등록하지 않는다.**
쓸 라벨이 저장소에 하나도 없으면 `references/label-audit.md` 의 라벨 생성 절차를 먼저 밟는다.

항목마다 `create` 를 따로 호출한다. 실패한 항목은 **건너뛰고 계속** 하고, 성공·실패를 모아 마지막에 한 번 보고한다.
`status:open` 은 등록 성공 직후 스크립트가 자동으로 붙인다. `--label` 로 직접 넘기지 않는다.

## 7단계 — 기존 이슈 라벨 점검

```bash
node <skill>/scripts/issue-create.mjs unlabeled --state open
```

출력은 두 축으로 나뉜다. `UNLABELED_NUMBERS`는 성격 라벨이 없는 이슈이고, `NO_STATUS_NUMBERS`는 진행 상태 라벨이 없는 이슈다. 둘 다 0 이면 그대로 넘어간다. 아니면 제목·본문과 PR·브랜치 상태를 읽어 제안 목록을 만들고 AskUserQuestion으로 한 번에 승인받아 붙인다. 세부는 `references/label-audit.md`.

## 8단계 — 다음 행동

`references/next-actions.md` 의 4지선다를 그대로 제시한다. "바로 착수" 를 고르면 첫 번호로 `issue-start` 를 이어서 실행하고 나머지 번호는 안내만 한다. 워크트리가 충돌하므로 여러 이슈를 동시에 착수하지 않는다.

## 마무리 보고

한 건일 때.

```text
이슈      [#{issue_number} <제목>](<이슈 URL>)
라벨      <붙인 성격 라벨> + status:open
라벨 점검  성격 <n>건 확인 / <m>건 보정, 상태 <p>건 확인 / <q>건 보정
기본 브랜치 <base> (<판별 출처>)
요청 기록  .issue/{issue_number}/request.md
다음      <사용자가 고른 행동>
```

여러 건일 때.

```text
이슈      #61 대시보드 기간 필터 추가        (enhancement)
          #62 주문 목록 빈 렌더링 수정        (bug)
          #63 레거시 export 스크립트 제거      (chore)
건너뜀    "알림 배지" — #48 과 중복
실패      없음
라벨 점검  성격 12건 확인 / 3건 보정, 상태 <p>건 확인 / <q>건 보정
요청 기록  .issue/{61,62,63}/request.md
다음      <사용자가 고른 행동> — /issue-start #61 (이후 #62, #63)
```

`건너뜀` 과 `실패` 는 해당 항목이 없으면 줄 자체를 뺀다.
