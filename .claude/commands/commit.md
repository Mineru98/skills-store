---
allowed-tools: Bash(git add:*), Bash(git status:*), Bash(git commit:*)
model: claude-haiku-4-5-20251001
---
# Commit Workflow - Group Related Changes

## Description
기능별로 변경된 파일을 그룹화하여 구조화된 커밋을 생성합니다. Conventional Commits 형식을 따르며, 모든 커밋 메시지는 한글로 작성해야 합니다.

이 워크플로우는 `/Coding Conventions` 스킬의 `references/git-commit-conventions.md`를 참고합니다.

## Workflow

### 1. Analyze Changes
```bash
# Get overview of all changes
git status
git diff --stat
```

### 2. Group Files by Functionality
변경된 파일을 검토하여 기능적 그룹 식별:
- **기능 변경**: 새로운 기능, 기능 추가
- **버그 수정**: 오류 수정, 이슈 해결
- **리팩토링**: 동작 변경 없는 코드 재구조화
- **문서화**: README, 문서, 인라인 주석
- **테스트**: 테스트 파일, 테스트 업데이트
- **설정**: 설정 파일, 의존성

### 3. Create Commits Per Functional Group
For each identified group:

```bash
# Stage only files for this specific feature/change
git add <file1> <file2> <file3>

# Verify staged files
git status

# Create commit with Conventional Commits format
git commit -m "<type>(<scope>): <subject>"
```

**Conventional Commits Format:**
```
<type>(<scope>): <subject>

<body> (optional)

<footer> (optional)
```

**Common Types:**
- `feat` - 새로운 기능 추가
- `fix` - 버그 수정
- `docs` - 문서 업데이트
- `style` - 코드 스타일 수정 (동작 변경 없음)
- `refactor` - 코드 리팩토링
- `test` - 테스트 추가/수정
- `chore` - 유지보수 작업

**Rules:**
- **Commit messages MUST be written in Korean**
- Use imperative present tense: "추가", "수정", "삭제"
- Lowercase subject, no period at end
- Keep subject under 50 characters

### 4. Example: Multiple Commits for Mixed Changes

If you changed:
- `auth/login.ts`, `auth/middleware.ts` (authentication feature)
- `utils/date.ts` (bug fix)
- `README.md` (documentation)

Create separate commits:

```bash
# Commit 1: Authentication feature
git add auth/login.ts auth/middleware.ts
git commit -m "feat(auth): JWT 로그인 및 미들웨어 추가

- JWT 토큰 생성 구현
- 보호된 라우트용 인증 미들웨어 추가
- 기존 사용자 서비스와 통합"

# Commit 2: Bug fix
git add utils/date.ts
git commit -m "fix(utils): 날짜 포맷팅 시 타임존 처리 수정

이전에는 UTC 대신 로컬 시간을 사용하여
다른 서버 위치에서 날짜 불일치 문제 발생"

# Commit 3: Documentation
git add README.md
git commit -m "docs: README에 새 인증 플로우 안내 추가

JWT 인증 설정을 위한 단계별 가이드 작성"
```

### 5. Verification
```bash
# Review commit history
git log --oneline -5

# Verify each commit's changes
git show <commit-hash>
```

## Checklist
- [ ] `git status` 및 `git diff`로 모든 변경 파일 분석
- [ ] 기능 그룹 식별 (기능 추가, 버그 수정, 문서 등)
- [ ] 각 커밋마다 관련 파일만 스테이징
- [ ] 커밋 메시지는 반드시 **한글**로 작성
- [ ] Conventional Commits 형식 준수
- [ ] 모든 커밋 생성 후 커밋 내역 검증
