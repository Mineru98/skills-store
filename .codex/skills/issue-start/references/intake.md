# 인자가 이슈 번호가 아닐 때

`$issue-start` 에 이슈 번호 대신 작업 설명이 들어오는 경우를 다룬다.
`issue-create` 단계에서 걸러지는 것이 이상적이지만 실제로는 자주 건너뛰므로, 여기서 다시 잡는다.

## 판별

```text
/(^|\D)(\d{1,6})\s*$/  또는  /issues\/(\d+)/  매치  →  이슈 번호
그 외 비어있지 않은 텍스트                          →  작업 설명
```

숫자로 끝나더라도 문장이면 이슈 번호가 아니다. `"버튼을 3개로 늘려줘"` 는 이슈 3번이 아니다.
스크립트의 `parseIssueNumber` 가 같은 규칙으로 판정하므로, 애매하면 아래로 확인한다.

```bash
node -e "import('<skill>/scripts/issue-common.mjs').then(m=>console.log(m.parseIssueNumber(process.argv[1])))" "$ARGUMENTS"
```

## 1. plan 모드로 전환

작업 설명으로 판별되면 **곧바로 구현에 들어가지 않는다.** plan 모드로 전환한 뒤 묻는다.

이유: 사용자는 이슈 번호를 줬다고 생각하고 있을 수 있고, 이슈 없이 기본 브랜치에서 작업이 시작되는 것이 이 스킬군이 막으려는 상황 그 자체다.

## 2. AskUserQuestion

선택지는 4개로 고정한다. 질문 본문에 현재 단계를 함께 적는다(SKILL.md 의 `# 현재 단계 밝히기`).

```text
질문   issue-start 1단계(인자 분기)입니다. 이 요청을 GitHub 이슈로 먼저 등록할까요?

1. 등록하고 착수 (권장)  issue-create 로 이슈를 만든 뒤 그 번호로 이 스킬을 이어서 진행
2. 등록만               이슈만 만들고 착수는 나중에
3. 이슈 없이 진행        이슈 없이 바로 작업. 증거는 no-issue-<브랜치> 키로 로컬에만 남는다
4. 취소                 아무것도 하지 않음
```

3번을 고르면 이슈 코멘트 단계(10~11)는 건너뛴다. 그 사실을 미리 알린다.

## 3. issue-create 설치 확인

1번이나 2번을 골랐으면 `issue-create` 가 있는지 본다. 아래 중 존재하는 첫 경로를 쓴다.

```text
.claude/skills/issue-create      # 현재 프로젝트 (Claude Code)
.codex/skills/issue-create       # 현재 프로젝트 (Codex)
~/.claude/skills/issue-create    # 홈 설치
~/.codex/skills/issue-create     # 홈 설치
```

있으면 그대로 위임한다. 없으면 아래 순서로 설치한다.

## 4. 자동 설치 (폴백 체인)

### 4-1. migrate-skill-agent (권장)

임시 폴더를 쓰지 않고 사용자가 평소 소스를 두는 위치에 clone 한 뒤 심볼릭 링크로 설치한다.
저장소에서 `git pull` 하면 설치본이 함께 갱신된다.

```bash
sh <migrate-skill-agent>/scripts/migrate-skill-agent.sh \
  --skill issue-create --target home --link --clone --flavor <claude|codex>
```

- `--clone` 은 `$HOME/SourceCode/skills-store` → `$HOME/skills-store` 순으로, **부모 디렉터리가 이미 있는 첫 위치**에 clone 한다.
- `--flavor` 는 현재 `<skill>` 이 `.claude/` 밑인지 `.codex/` 밑인지로 정한다.
- 이미 로컬에 skills-store 체크아웃이 있으면 clone 하지 않고 그것을 쓴다.

### 4-2. install-skill (오프라인 clone 실패 시)

GitHub Contents API 로 폴더를 재귀 다운로드한다. `scripts/`·`references/` 가 함께 딸려온다.

```bash
node <install-skill>/script/install-skill.js \
  https://github.com/Mineru98/skills-store/tree/main/.claude/skills/issue-create --global
```

Codex 계열이면 경로의 `.claude` 를 `.codex` 로 바꾼다.

### 4-3. 원문 직접 참조 (둘 다 실패)

네트워크는 되는데 설치가 안 되면 SKILL.md 만 읽어 절차를 그대로 수행한다.

```text
claude  https://raw.githubusercontent.com/Mineru98/skills-store/refs/heads/main/.claude/skills/issue-create/SKILL.md
codex   https://raw.githubusercontent.com/Mineru98/skills-store/refs/heads/main/.codex/skills/issue-create/SKILL.md
```

### 4-4. 인라인 최소 절차 (전부 실패)

설치도 조회도 안 되면 아래만 수행하고 넘어간다.

```bash
gh issue create --title "<한 줄 제목>" --body-file <초안 파일>
```

초안에는 배경 / 요구사항 / 현재와 기대 / 완료 기준 / 영향 범위를 담는다. 등록 전에 AskUserQuestion 으로 승인을 받는다.

```text
질문: issue-start 1단계(인자 분기)입니다. 이 초안으로 이슈를 등록할까요?
- 승인 (권장)   이대로 등록하고 이슈 번호를 받습니다
- 수정          고칠 항목을 받아 초안을 다시 제시합니다
- 취소          등록하지 않고 종료합니다
```

## 5. 복귀

`issue-create` 가 출력한 `ISSUE_NUMBER=` 를 받아 이슈 번호 경로로 재진입한다.
1번을 골랐으면 그대로 2단계(이슈 수집)로 이어가고, 2번이면 번호와 URL 만 보고하고 끝낸다.

설치 경로를 새로 만들었으면 마무리 보고에 어디에 clone·링크했는지 한 줄로 남긴다.
