---
allowed-tools: Bash(git add:*), Bash(git status:*), Bash(git commit:*)
model: claude-haiku-4-5-20251001
---
# Commit Workflow - Group Related Changes

## Description
기능별로 변경된 파일을 그룹화하여 구조화된 커밋을 생성합니다. Conventional Commits 형식을 따르며, 모든 커밋 메시지는 한글로 작성해야 합니다.

## PowerShell/Windows 환경: 한글 커밋 메시지 깨짐 방지

**PowerShell에서 실행 시** `git commit -m "한글"`은 인코딩 문제로 한글이 깨질 수 있습니다. 반드시 아래 방식을 사용하세요:

1. UTF-8로 저장된 임시 파일에 커밋 메시지 작성
2. `git commit -F <파일경로>` 로 커밋
3. 커밋 후 임시 파일 삭제

```powershell
# (선택) 터미널 UTF-8 설정
chcp 65001

# 예: commit_msg.txt에 메시지 저장 후
git commit -F commit_msg.txt
# 완료 후: Remove-Item commit_msg.txt
```

## Workflow

### 1. Analyze Changes
```powershell
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
각 그룹별로:

```powershell
# 해당 기능/변경에 해당하는 파일만 스테이징
git add <file1> <file2> <file3>

# 스테이징 확인
git status

# [PowerShell] 커밋 메시지를 UTF-8 파일로 작성 후 -F 옵션 사용
# 1. 임시 파일 생성 (예: commit_msg.txt)
# 2. Conventional Commits 형식으로 메시지 작성
# 3. git commit -F commit_msg.txt
# 4. Remove-Item commit_msg.txt
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

### 4. Example: Multiple Commits for Mixed Changes (PowerShell)

변경 사항:
- `auth/login.ts`, `auth/middleware.ts` (인증 기능)
- `utils/date.ts` (버그 수정)
- `README.md` (문서)

```powershell
# Commit 1: 인증 기능
git add auth/login.ts auth/middleware.ts
# commit_msg1.txt 작성:
# feat(auth): JWT 로그인 및 미들웨어 추가
#
# - JWT 토큰 생성 구현
# - 보호된 라우트용 인증 미들웨어 추가
# - 기존 사용자 서비스와 통합
git commit -F commit_msg1.txt
Remove-Item commit_msg1.txt

# Commit 2: 버그 수정
git add utils/date.ts
# commit_msg2.txt 작성:
# fix(utils): 날짜 포맷팅 시 타임존 처리 수정
#
# 이전에는 UTC 대신 로컬 시간을 사용하여
# 다른 서버 위치에서 날짜 불일치 문제 발생
git commit -F commit_msg2.txt
Remove-Item commit_msg2.txt

# Commit 3: 문서
git add README.md
# commit_msg3.txt 작성:
# docs: README에 새 인증 플로우 안내 추가
#
# JWT 인증 설정을 위한 단계별 가이드 작성
git commit -F commit_msg3.txt
Remove-Item commit_msg3.txt
```

### 5. Verification
```powershell
git log --oneline -5
git show <commit-hash>
```

## Checklist
- [ ] `git status` 및 `git diff`로 모든 변경 파일 분석
- [ ] 기능 그룹 식별 (기능 추가, 버그 수정, 문서 등)
- [ ] 각 커밋마다 관련 파일만 스테이징
- [ ] **PowerShell: `git commit -F <파일>` 사용** (한글 깨짐 방지)
- [ ] 커밋 메시지는 반드시 **한글**로 작성
- [ ] Conventional Commits 형식 준수
- [ ] 모든 커밋 생성 후 커밋 내역 검증
