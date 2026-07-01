# Skills Store

![Skills Store overview](assets/images/skills-store-overview.png)

Codex와 Claude Code에서 같이 쓰는 스킬, agent, 명령, 프로젝트 룰을 모아 둔 저장소입니다.

자주 쓰는 순서는 `visual-companion`, `kill-process`, `install-skill`, `migrate-skill-agent`, `irasutoya-search`, E2E 계열 스킬, `loop`/`schedule`, 문서/프롬프트/agent 순입니다.

## 빠른 사용 순서

1. 시각적 선택지나 와이어프레임이 필요하면 `visual-companion`을 먼저 씁니다.
2. 로컬 개발 서버 포트가 막히면 `kill-process`로 포트를 비웁니다.
3. 외부 GitHub 스킬을 가져와야 하면 `install-skill`을 씁니다.
4. 이 저장소의 특정 skill이나 agent를 홈 또는 현재 프로젝트로 동기화해야 하면 `migrate-skill-agent`를 씁니다.
5. 발표자료나 문서에 넣을 이라스토야 일러스트가 필요하면 `irasutoya-search`를 씁니다.
6. E2E 계획, 생성, 치유, 하네스 작업은 E2E 그룹에서 고릅니다.
7. 영어 원문 기반 한국어 발표자료를 다듬을 때는 `slide-ko-polish`로 번역체와 줄바꿈을 같이 봅니다.
8. 문서 AI-feel 점검, 프롬프트 설계, agent 호출은 작업 성격에 맞춰 선택합니다.
9. Codex 프롬프트를 정해진 간격으로 반복하려면 `loop`, cron이나 특정 시각에 예약하려면 `schedule`을 씁니다.

## 저장소 구조

```text
.
├── AGENTS.md
├── CLAUDE.md
├── LICENSE
├── README.md
├── assets/
│   └── images/
├── scripts/
├── .claude/
│   ├── agents/
│   ├── commands/
│   ├── rules/
│   └── skills/
└── .codex/
    ├── agents/
    ├── config.toml
    ├── rules/
    └── skills/
```

## 사용법 가이드

<details open>
<summary><strong>1. visual-companion</strong> - 브라우저로 보는 시각 선택 도구</summary>

### Best use case

`visual-companion`은 기획 문서, 요구사항, 인터뷰 중 말로만 설명하기 어려운 선택지를 브라우저 화면으로 보여줄 때 씁니다.

텍스트 질문만으로는 서로 같은 장면을 떠올리고 있는지 확인하기 어렵습니다. 특히 화면 구성, 플로우, 정보 구조, 비교안처럼 시각적 판단이 필요한 주제는 말로만 좁히면 오해가 생기기 쉽습니다.

이 스킬은 그런 순간에 선택지, 와이어프레임, 다이어그램, 비교안을 브라우저에 띄웁니다. 사용자가 고른 값이나 짧은 입력을 다시 세션으로 가져와 다음 인터뷰나 기획 문서에 씁니다.

적합한 작업:

- [ouroboros](https://github.com/Q00/ouroboros) `interview` 중 시각 선택지가 필요한 요구사항 정리
- [oh-my-codex](https://github.com/Yeachan-Heo/oh-my-codex) `deep-interview`에서 텍스트 질문만으로 좁히기 어려운 화면/플로우 선택
- [oh-my-claudecode](https://github.com/Yeachan-Heo/oh-my-claudecode) `deep-interview`에서 사용자가 브라우저로 고른 값을 Claude Code가 이어받는 흐름
- 기획 문서 작성 중 레이아웃, 정보 구조, 사용자 흐름, 다이어그램을 눈으로 보고 골라야 하는 순간

부적합한 작업:

- 단순 텍스트 질문
- API 설계, 데이터 모델링처럼 표나 문장으로 충분한 결정
- 시각 자료 없이 가능한 요구사항 정리

### Hermes Agent 호출 예시

```text
ooo interview "결제 플로우 요구사항이 말로만 정리되어 애매합니다" UI/UX 에 대한 결정을 해야하는 질문에서는 visual-companion 스킬을 사용해서 인터뷰를 이어서 진행하세요.
```

### Codex 호출 예시

```text
$ouroboros interview "결제 플로우 요구사항이 말로만 정리되어 애매합니다" UI/UX 에 대한 결정을 해야하는 질문에서는 $visual-companion 스킬을 사용해서 인터뷰를 이어서 진행하세요.
```

```text
$deep-interview "결제 플로우 요구사항이 말로만 정리되어 애매합니다" UI/UX 에 대한 결정을 해야하는 질문에서는 $visual-companion 스킬을 사용해서 인터뷰를 이어서 진행하세요.
```

### Claude Code 호출 예시

```text
/ouroboros interview "랜딩 페이지 방향을 정해야 해." UI/UX 에 대한 결정을 해야하는 질문에서는 $visual-companion 스킬을 사용해서 인터뷰를 이어서 진행하세요.
```

```text
/deep-interview "랜딩 페이지 방향을 정해야 해." UI/UX 에 대한 결정을 해야하는 질문에서는 $visual-companion 스킬을 사용해서 인터뷰를 이어서 진행하세요.
```

</details>

<details>
<summary><strong>2. kill-process</strong> - 포트 점유 프로세스 종료</summary>

### Best use case

개발 서버를 다시 띄우려는데 `3000`, `5173`, `8080` 같은 포트가 이미 사용 중일 때 씁니다.

### Codex 호출 예시

```text
$kill-process 3000
```

```text
kill-process 스킬로 3000번과 5173번 포트를 비우고, 종료 후 포트가 비었는지 확인해줘.
```

### Claude Code 호출 예시

```text
/kill-process 3000
```

```text
/kill-process 3000 5173
```

### 동작

1. `lsof -ti :<port>`로 PID를 찾습니다.
2. PID가 있으면 프로세스를 종료합니다.
3. 같은 포트를 다시 확인해 비워졌는지 검증합니다.

</details>

<details>
<summary><strong>3. install-skill</strong> - GitHub 스킬 설치</summary>

### Best use case

GitHub 저장소의 특정 스킬 폴더를 현재 프로젝트의 `.codex/skills/` 또는 `.claude/skills/`로 내려받을 때 씁니다.

### Codex 호출 예시

```text
$install-skill https://github.com/Mineru98/skills-store/tree/main/.codex/skills/visual-companion
```

```text
install-skill로 아래 Codex 스킬을 전역 스킬 폴더에 설치해줘.
https://github.com/Mineru98/skills-store/tree/main/.codex/skills/kill-process
```

### Claude Code 호출 예시

```text
install-skill 스킬로 아래 Claude Code 스킬을 설치해줘.
https://github.com/Mineru98/skills-store/tree/main/.claude/skills/visual-companion
```

```text
GitHub의 .claude/skills/premium-korean-aesthetic 폴더를 현재 프로젝트 Claude 스킬로 설치해줘.
https://github.com/Mineru98/skills-store/tree/main/.claude/skills/premium-korean-aesthetic
```

### 포함 파일

```text
.codex/skills/install-skill/script/install-skill.js
.claude/skills/install-skill/script/install-skill.js
```

</details>

<details>
<summary><strong>4. migrate-skill-agent</strong> - skills-store 항목 동기화</summary>

### Best use case

`skills-store`에 있는 특정 skill 또는 agent를 홈 디렉터리나 현재 프로젝트의 `.codex/`와 `.claude/` 자산으로 가져올 때 씁니다.

외부 GitHub URL을 직접 내려받는 `install-skill`과 달리, 이 스킬은 로컬 `skills-store` 저장소를 찾아 `git pull`로 최신화한 뒤 지정한 항목만 복사합니다.

### Codex 호출 예시

```text
$migrate-skill-agent --skill slide-ko-polish --target home
```

```text
$migrate-skill-agent --agent songcopy --target project
```

### Claude Code 호출 예시

```text
migrate-skill-agent 스킬로 slide-ko-polish를 홈 디렉터리에 설치해줘.
```

```text
migrate-skill-agent 스킬로 songcopy agent를 현재 프로젝트에 설치해줘.
```

### 옵션

- `--skill <name>`: skill만 검색해서 설치
- `--agent <name>`: agent만 검색해서 설치
- `--target home`: `~/.codex`와 `~/.claude` 아래에 설치
- `--target project`: 현재 프로젝트의 `.codex`와 `.claude` 아래에 설치

### 포함 파일

```text
.codex/skills/migrate-skill-agent/scripts/migrate-skill-agent.sh
.claude/skills/migrate-skill-agent/scripts/migrate-skill-agent.sh
```

</details>

<details>
<summary><strong>5. irasutoya-search</strong> - 이라스토야 일러스트 검색</summary>

### Best use case

발표자료, 블로그, 문서, 채팅에 넣을 귀여운 무료 일러스트가 필요할 때 씁니다.

사용자의 한국어/영어 설명을 일본어 검색어로 줄여 `irasutoya` CLI를 실행하고, 제목, 페이지 URL, 이미지 URL, 매칭 이유를 보고합니다. 새 이미지를 생성하지 않고 이라스토야 기존 카탈로그만 검색합니다.

### Codex 호출 예시

```text
$irasutoya-search
발표 자료에 쓸 건데, 뭔가 신기한 걸 발견하고 궁금해하는 남자아이 일러스트 하나 찾아줘.
```

```bash
irasutoya search "不思議 男の子"
irasutoya random
```

### Claude Code 호출 예시

```text
irasutoya-search 스킬로 컴퓨터 앞에서 곤란해하는 회사원 이미지를 찾아줘.
```

```bash
irasutoya search "困った 会社員"
```

### 포함 파일

```text
.codex/skills/irasutoya-search/SKILL.md
.codex/skills/irasutoya-search/agents/openai.yaml
.claude/skills/irasutoya-search/SKILL.md
.claude/skills/irasutoya-search/evals/evals.json
```

</details>

<details>
<summary><strong>6. E2E 관련 스킬 그룹</strong></summary>

### 추천 순서

1. `e2e-flow-planner` - Critical User Flow 기반 E2E 계획서 작성
2. `e2e-harness-setup` - E2E 테스트 하네스와 운영 규칙 부트스트랩
3. `e2e-test-generator` - 검토된 계획서를 Playwright 테스트로 구현
4. `e2e-test-hardener` - 생성된 테스트의 독립성, 모킹, 플래키 예방 보강
5. `e2e-test-healer` - 실패한 Playwright 테스트를 trace 기반으로 진단하고 수정
6. `e2e-ci-trace-debug` - GitHub Actions E2E 실패 trace를 내려받아 원인 추적

### Codex 호출 예시

```text
$e2e-flow-planner
결제 플로우의 Critical User Flow를 기준으로 E2E 테스트 계획서를 작성해줘.
```

```text
$e2e-test-healer
실패한 Playwright 테스트 trace를 보고 원인을 찾아 통과하게 수정해줘.
```

### Claude Code 호출 예시

```text
e2e-harness-setup 스킬로 이 프로젝트의 Playwright 테스트 하네스를 온보딩해줘.
```

```text
e2e-ci-trace-debug 스킬로 PR의 실패한 E2E 체크 trace를 받아 원인을 찾아줘.
```

### 스킬별 요약

- `e2e-flow-planner`: 코드베이스와 요구사항을 읽고 E2E 테스트 계획서 작성
- `e2e-harness-setup`: AGENTS.md 안내, E2E 운영 규칙, fixture/helper, MCP 배선 준비
- `e2e-test-generator`: 계획서를 Playwright 코드로 구현하고 실제 브라우저로 확인
- `e2e-test-hardener`: 테스트 독립성, 외부 의존성 모킹, 플래키 예방 원칙 적용
- `e2e-test-healer`: 실패한 Playwright 테스트의 trace를 근거로 자동 치유 루프 수행
- `e2e-ci-trace-debug`: PR 또는 GitHub Actions 실패에서 trace와 로그를 추적해 수정

</details>

<details>
<summary><strong>7. slide-ko-polish</strong> - 한국어 발표자료 번역체와 줄바꿈 점검</summary>

### Best use case

영어 원문을 한국어로 옮긴 HTML/Markdown 발표자료에서 번역체 표현, 무거운 명사문, 한국어 어절 줄바꿈 문제를 같이 점검할 때 씁니다.

검증 스크립트는 regex/HTML 구조 검사와 LLM fresh review를 묶어서 실행합니다. LLM CLI는 `claude`, `codex`, `gemini` 순으로 자동 감지하며, `LLM_CLI` 환경변수로 고정할 수 있습니다.

### Codex 호출 예시

```text
$slide-ko-polish
slides.html의 한국어가 번역체인지 점검하고, 어색한 문장과 줄바꿈을 다듬어줘.
검증은 verify.sh까지 실행해줘.
```

```bash
.codex/skills/slide-ko-polish/verify.sh slides.html
.codex/skills/slide-ko-polish/polish-loop.sh slides.html
```

### Claude Code 호출 예시

```text
/slide-ko-polish slides.html의 한국어 번역체와 CJK 줄바꿈을 다듬어줘.
```

```bash
.claude/skills/slide-ko-polish/verify.sh slides.html
.claude/skills/slide-ko-polish/polish-loop.sh slides.html
```

### Gemini CLI에서 직접 실행

```bash
LLM_CLI=gemini .codex/skills/slide-ko-polish/verify.sh slides.html
LLM_CLI=gemini .codex/skills/slide-ko-polish/polish-loop.sh slides.html
```

### 라이선스 인용

이 스킬은 [hackertaco/skill-forge](https://github.com/hackertaco/skill-forge)의 `slide-ko-polish`를 프로젝트용 Codex/Claude 스킬로 등록한 것입니다.

원본 라이선스는 MIT License이며 저작권 표기는 `Copyright (c) 2026 hackertaco`입니다. 전체 라이선스 전문은 각 플랫폼 스킬 폴더의 `LICENSE`에 포함했습니다.

</details>

<details>
<summary><strong>8. loop / schedule</strong> - Codex 프롬프트 반복·예약 실행</summary>

### Best use case

Codex 프롬프트를 정해진 주기로 반복하거나(`loop`) cron·특정 시각에 예약해서(`schedule`) 비대화식으로 실행할 때 씁니다. 두 스킬은 서로 독립이며 상태·데몬·락을 각자 관리합니다.

- `loop` - 고정 간격 반복. 예: `/loop 10m check CI status`. 상태는 `.codex/loop/`.
- `schedule` - cron 또는 특정 시각 1회. 예: `/schedule --cron "0 9 * * 1" summarize open PRs`, `--at <ISO-8601>`. 상태는 `.codex/schedule/`.

상시 durable 스케줄이 필요하면 Codex 앱 Automations를 먼저 권장하고, 이 스킬은 터미널 로컬 폴백입니다. `daemon`이 떠 있어야만 작업이 발화됩니다.

`schedule`은 기본적으로 `auto` runner를 사용해 due 프롬프트를 다음 순서로 전달합니다.

1. `tmux-send` - `--tmux-target` 또는 `TMUX_PANE`이 실행 중인 Codex pane을 가리키면 그 pane에 붙여넣고 Enter를 입력합니다.
2. `resume-command` - `--resume-command`가 있으면 해당 로컬 hook을 실행하고 프롬프트를 stdin으로 전달합니다.
3. `codex-exec` - 둘 다 없으면 호환성을 위해 새 `codex exec` 실행으로 fallback합니다.

### Codex 호출 예시

```text
$loop 5분마다 CI 상태를 확인해줘.
```

```text
$schedule 매주 월요일 오전 9시에 열린 PR을 요약해줘.
```

```bash
# loop: 간격 작업 등록 후 데몬 실행
node .codex/skills/loop/scripts/loop.mjs add --state-root .codex/loop --interval 10m --prompt "check CI status" --cwd "$PWD"
node .codex/skills/loop/scripts/loop.mjs daemon --state-root .codex/loop

# schedule: cron 작업 등록 후 데몬 실행
node .codex/skills/schedule/scripts/schedule.mjs add --state-root .codex/schedule --cron "0 9 * * 1" --prompt "summarize open PRs" --cwd "$PWD"
node .codex/skills/schedule/scripts/schedule.mjs daemon --state-root .codex/schedule --runner auto --tmux-target "$TMUX_PANE"
```

### 안전 기본값

- `--codex-arg` 통과는 기본 거부 화이트리스트로, 샌드박스·승인·설정 우회 인자를 차단합니다.
- `schedule`은 tmux 입력 주입, 로컬 resume hook, `codex exec` 순서로 선택합니다. 필요하면 `--runner tmux-send`, `--runner resume-command`, `--runner codex-exec`로 특정 모드를 강제할 수 있습니다.
- Codex 승인/샌드박스 기본값을 약화하지 않고 OS cron/launchd도 설치하지 않습니다.
- 실행 증거는 `.codex/{loop,schedule}/runs/`에 남습니다. 상태·락·runs는 로컬 전용이라 커밋하지 않습니다.

### 포함 파일

```text
.codex/skills/loop/scripts/loop.mjs
.codex/skills/loop/references/loop-contract.md
.codex/skills/schedule/scripts/schedule.mjs
.codex/skills/schedule/references/schedule-contract.md
```

</details>

<details>
<summary><strong>9. 문서, 프롬프트, 커밋 스킬</strong></summary>

### Codex 호출 예시

```text
$ai-slop-document-auditor
proposal.pdf의 한국어 카피가 AI-feel인지 점검하고, 근거와 수정 우선순위를 알려줘.
```

```text
$gpt-55-prompt-architect
기존 GPT-4용 시스템 프롬프트를 GPT-5.5용으로 마이그레이션해줘.
목표, 검증 루프, 도구 사용 규칙을 명확히 정리해줘.
```

```text
$commit
현재 변경 파일을 기능별로 묶어 커밋해줘.
```

### Claude Code 호출 예시

```text
ai-slop-document-auditor 스킬로 deck.pptx의 제목, bullet, CTA에서 AI-feel이 나는 부분을 찾아줘.
원본 파일은 수정하지 말고 보고서만 작성해줘.
```

```text
gpt-55-prompt-architect 스킬로 기존 프롬프트를 GPT-5.5용으로 재설계해줘.
```

### 스킬별 요약

- `ai-slop-document-auditor`: PDF, Markdown, TXT, PPT/PPTX, HTML, DOCX 한국어 문서의 AI-feel 점검
- `gpt-55-prompt-architect`: GPT-5.5용 프롬프트 설계, 마이그레이션, 리뷰
- `commit`: 변경 파일을 기능별로 묶어 커밋 작성

</details>

<details>
<summary><strong>10. Claude Code 전용 스킬</strong></summary>

### Codex에는 없는 Claude Code 스킬

- `commands-creator`: Claude Code slash command 작성과 관리 가이드
- `imagine`: Claude Code 이미지 생성/편집
- `mcp-builder`: Python 또는 Node/TypeScript MCP 서버 설계와 구현
- `premium-korean-aesthetic`: 한국어 랜딩의 폰트, 여백, 카드, 모션 기준 적용
- `pyautogui-helper`: PyAutoGUI 기반 로컬 UI 자동화 도우미
- `subagents-creator`: Claude subagent 정의, 위임 패턴, 디버깅

### Claude Code 호출 예시

```text
commands-creator 스킬로 /release-note 명령을 만들어줘.
인자는 버전 번호와 변경 범위를 받게 하고, 출력은 한국어 릴리즈 노트로 해줘.
```

</details>

<details>
<summary><strong>11. Codex agent</strong></summary>

### 사용 가능한 agent

- `ai-slop-detector`: 한국어 PPT 제목, bullet, CTA의 AI-feel pattern tag 판정
- `ai-slop-guardrail`: 짧은 한국어 비즈니스 카피에서 피할 표현과 구조 정리
- `ai-slop-rewriter`: 정보와 구조를 유지한 AI-feel 줄이기
- `songcopy`: 쓸모랩 소속 카피라이터 페르소나의 광고 카피, 슬로건, 헤드라인, 캠페인 메시지 작성

### Codex 호출 예시

```text
ai-slop-detector agent로 아래 CTA 문구의 AI-feel tag만 뽑아줘.
"혁신적인 경험을 통해 비즈니스 성장을 가속화하세요"
```

```text
songcopy agent로 B2B SaaS 랜딩 페이지 헤드라인 5개를 뽑아줘.
톤은 과장 없이 날카롭고, 바로 클라이언트 데크에 붙일 수 있게 해줘.
```

</details>

<details>
<summary><strong>12. Claude Code agent</strong></summary>

### 사용 가능한 agent

- `ai-slop-detector`: 한국어 짧은 비즈니스 카피의 AI-feel tag 판정
- `ai-slop-guardrail`: AI-feel을 막기 위한 금지 표현과 구조 정리
- `ai-slop-rewriter`: 입력 구조와 정보를 유지한 문체 수정
- `songcopy`: 쓸모랩 소속 카피라이터 페르소나의 광고 카피, 슬로건, 헤드라인, 캠페인 메시지 작성

### Claude Code 호출 예시

```text
ai-slop-guardrail subagent로 이 슬라이드 카피를 작성할 때 피해야 할 표현만 정리해줘.
수정문은 만들지 말고 금지 목록만 출력해줘.
```

```text
ai-slop-rewriter subagent로 PPTX의 제목과 bullet만 AI-feel 덜 나게 고쳐줘.
슬라이드 순서와 원래 정보는 유지해줘.
```

```text
songcopy subagent로 B2B SaaS 랜딩 페이지 CTA 문구 5개를 만들어줘.
톤은 과장 없이 실무자가 바로 검토할 수 있게 해줘.
```

</details>

## Codex 자산 목록

<details>
<summary><strong>.codex/skills</strong></summary>

- `ai-slop-document-auditor`
- `commit`
- `design-md-validator`
- `e2e-ci-trace-debug`
- `e2e-flow-planner`
- `e2e-harness-setup`
- `e2e-test-generator`
- `e2e-test-hardener`
- `e2e-test-healer`
- `gpt-55-prompt-architect`
- `install-skill`
- `irasutoya-search`
- `kill-process`
- `loop`
- `migrate-skill-agent`
- `schedule`
- `slide-ko-polish`
- `visual-companion`

</details>

<details>
<summary><strong>.codex/agents</strong></summary>

- `ai-slop-detector`
- `ai-slop-guardrail`
- `ai-slop-rewriter`
- `songcopy`

</details>

<details>
<summary><strong>.codex/rules</strong></summary>

- `frontend/README.md`
- `frontend/project-coding-conventions.md`
- `frontend/project-dev-workflow.rules`
- `frontend/project-safety.rules`

</details>

## Claude Code 자산 목록

<details>
<summary><strong>.claude/skills</strong></summary>

- `ai-slop-document-auditor`
- `commands-creator`
- `e2e-ci-trace-debug`
- `e2e-flow-planner`
- `e2e-harness-setup`
- `e2e-test-generator`
- `e2e-test-hardener`
- `e2e-test-healer`
- `gpt-55-prompt-architect`
- `imagine`
- `install-skill`
- `irasutoya-search`
- `mcp-builder`
- `migrate-skill-agent`
- `premium-korean-aesthetic`
- `pyautogui-helper`
- `subagents-creator`
- `slide-ko-polish`
- `visual-companion`

</details>

<details>
<summary><strong>.claude/commands</strong></summary>

- `commit`
- `kill-process`
- `audit`

</details>

<details>
<summary><strong>.claude/agents</strong></summary>

- `ai-slop-detector`
- `ai-slop-guardrail`
- `ai-slop-rewriter`
- `songcopy`

</details>

<details>
<summary><strong>.claude/rules</strong></summary>

- `frontend/00-index.md`
- `frontend/api-infrastructure.md`
- `frontend/architecture.md`
- `frontend/naming-conventions.md`
- `frontend/react-components.md`
- `frontend/state-management.md`
- `frontend/styling-emotion.md`
- `frontend/testing.md`
- `frontend/typescript.md`
- `frontend/workflow-build.md`

</details>

## 운영 메모

- 프로젝트 안에서 쓰는 스킬은 `.codex/skills/` 또는 `.claude/skills/` 아래에 둡니다.
- Codex 스킬은 `$skill-name` 형태나 자연어 요청으로 호출합니다.
- Claude Code 명령은 `/command` 형태로 호출합니다.
- Claude Code 스킬과 subagent는 자연어 요청의 키워드와 작업 맥락으로 호출합니다.
- 원본 문서 점검, 브라우저 캡처, 디자인 추출처럼 읽기 전용 확인이 가능한 작업은 먼저 결과를 남기고 수정합니다.

## 라이선스

MIT License. 자세한 내용은 [LICENSE](LICENSE)를 참고하세요.
