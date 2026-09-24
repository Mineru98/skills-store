---
description: 요청한 범위(경로·주제)의 변경만 목적별로 그룹화하여 커밋 생성. 범위를 지정하지 않으면 전체 변경 대상
allowed-tools: Bash(git add:*), Bash(git status:*), Bash(git commit:*), Bash(git diff:*), Bash(git log:*)
model: haiku
argument-hint: [커밋할 경로·주제 또는 메시지 힌트 (선택)]
---

지금 즉시 아래 워크플로우를 실행하라. 질문하지 말고 바로 실행하라.

## 현재 상태 수집

```bash
!git status --short
!git diff --stat
!git diff --cached --stat
!git log --oneline -3
```

## 실행 지시

### 1. 커밋 범위 결정

사용자 요청과 힌트에서 커밋 범위를 먼저 정한다. **범위 결정 전에는 아무것도 stage 하지 않는다.**

- 경로·디렉터리·glob·파일명이 있으면: 그 경로에 걸리는 변경 파일만 대상이다.
- 주제만 있으면 (예: "로그인 관련만", "문서만"): 변경 파일 전체의 diff 를 먼저 훑고, 요청과 관련된 파일만 대상으로 고른다.
- 범위 언급이 없으면: 모든 변경 파일이 대상이다.
- 범위를 지정했는데 걸리는 파일이 없으면: 커밋하지 않고 멈춘 뒤 그 사실을 보고한다. 전체 커밋으로 대체하지 않는다.

범위 밖 파일은 stage·커밋·수정하지 않는다. 이미 stage 되어 있던 범위 밖 파일도 그대로 둔다.

### 2. 대상 파일 분석

대상 파일만 내용을 확인한다.

```bash
git diff -- <대상 파일들>
git diff --cached -- <대상 파일들>
git diff --no-index -- /dev/null <새 파일>   # untracked 파일 내용 확인
```

### 3. 목적별 그룹화

파일 위치나 확장자가 아니라 **변경 의도**로 묶는다.

- 하나의 기능·버그·주제를 이루는 변경은 한 그룹이다. 구현과 그 테스트·문서가 같은 목적이면 함께 묶는다.
- 서로 무관한 목적은 다른 그룹으로 나눈다.
- 한 파일은 한 그룹에만 넣는다. 한 파일에 여러 목적이 섞였으면 주된 목적 그룹에 넣고 body 에 부가 변경을 적는다.
- 전체가 한 목적이면 커밋 하나로 끝낸다. 억지로 쪼개지 않는다.
- 그룹마다 타입을 하나 붙인다:
  - `feat` - 새로운 기능 추가
  - `fix` - 버그 수정
  - `docs` - 문서 업데이트
  - `style` - 코드 스타일 수정 (동작 변경 없음)
  - `refactor` - 코드 리팩토링
  - `test` - 테스트 추가/수정
  - `chore` - 유지보수 작업

### 4. 그룹별 커밋

그룹마다 그 그룹 파일만 stage 하고, 커밋에도 같은 경로를 pathspec 으로 넘긴다. pathspec 커밋은 index 에 다른 파일이 stage 되어 있어도 지정한 경로만 커밋한다.

```bash
git add -- <아직 stage 안 된 그룹 파일들>
git commit -m "$(cat <<'EOF'
<type>(<scope>): <subject>
EOF
)" -- <그룹 파일 전체>
```

- `git add` 에는 `git status --short` 에서 `??` 이거나 두 번째 칸이 비어 있지 않은 경로만 넘긴다. `git rm` 으로 이미 stage 된 삭제 경로(`D `)를 넘기면 add 전체가 실패한다.
- 그룹 파일이 전부 이미 stage 되어 있으면 `git add` 를 건너뛰고 바로 커밋한다.
- `git add .`, `git add -A`, `git commit -a` 처럼 경로 없이 전체를 잡는 명령은 쓰지 않는다. git 힌트가 권해도 따르지 않는다.
- `git commit` pathspec 에는 그룹의 모든 경로를 넘긴다. 삭제 파일과 rename 의 이전·새 경로도 포함한다.

### 5. 결과 검증

```bash
git log --oneline -<커밋 수>
git status --short
```

범위 밖 변경이 그대로 남아 있는지 확인한다. 만든 커밋 목록과, 커밋하지 않고 남긴 파일 목록을 함께 보고한다.

## 커밋 메시지 규칙

- 형식: `<type>(<scope>): <subject>`
- **커밋 메시지는 반드시 한글로 작성**
- 명령형 현재 시제 사용: "추가", "수정", "삭제"
- subject는 50자 이내, 끝에 마침표 없음
- 필요시 body에 상세 설명 추가
- **`Co-Authored-By:` 트레일러는 어떤 경우에도 커밋 메시지에 포함하지 않는다** (`Co-Authored-By: Claude`, `Co-Authored-By: Codex` 등 모두 금지)
- 생성 도구를 표시하는 다른 서명 문구(`Generated with ...` 등)도 커밋 메시지에 넣지 않는다

## 한글 커밋 메시지 깨짐 방지

`git commit -m "한글"` 사용 시 터미널 환경에 따라 한글이 깨질 수 있다. **반드시 HEREDOC 또는 임시 파일 방식을 사용하라.**

### macOS/Linux (HEREDOC 방식 - 권장)
```bash
git commit -m "$(cat <<'EOF'
feat(auth): JWT 로그인 및 미들웨어 추가

- JWT 토큰 생성 구현
- 보호된 라우트용 인증 미들웨어 추가
EOF
)" -- src/auth/
```

### Windows PowerShell (임시 파일 방식)
PowerShell에서는 `-m` 옵션으로 한글 전달 시 인코딩 문제가 발생한다. UTF-8 임시 파일을 사용하라:
```powershell
chcp 65001
# commit_msg.txt에 UTF-8로 메시지 작성 후:
git commit -F commit_msg.txt -- <그룹 파일들>
Remove-Item commit_msg.txt
```

사용자 힌트(커밋 범위 포함 가능): $ARGUMENTS
