# Git Commit 메시지 컨벤션

## 개요
Conventional Commits는 Git 커밋 메시지의 표준 형식을 제공합니다. 이를 통해 자동화된 도구로 CHANGELOG 생성, 시맨틱 버전 관리, 변경사항 추적이 가능합니다.

## Conventional Commits 형식

### 기본 구조
```
<type>(<scope>): <subject>

<body>

<footer>
```

### 간단한 형식
```
<type>: <subject>
```

### 예제
```bash
# 간단한 형식
git commit -m "feat: add user authentication"

# 스코프 포함
git commit -m "fix(auth): resolve login timeout issue"

# 전체 형식
git commit -m "feat(user): add user profile page" \
  -m "Implement user profile page with avatar upload and bio editing" \
  -m "Closes #123"
```

## Type (타입)

### 주요 타입
커밋의 성격을 나타내는 타입입니다.

#### feat
- 새로운 기능 추가
- MINOR 버전 증가

```bash
feat: add user registration
feat(api): implement REST API for products
```

#### fix
- 버그 수정
- PATCH 버전 증가

```bash
fix: resolve null pointer exception
fix(auth): correct token expiration logic
```

#### docs
- 문서만 변경

```bash
docs: update README with installation steps
docs(api): add API endpoint documentation
```

#### style
- 코드 의미에 영향을 주지 않는 변경
- 포맷팅, 세미콜론 누락, 공백 등

```bash
style: format code with prettier
style: add missing semicolons
```

#### refactor
- 기능 변경 없는 코드 리팩토링
- 버그 수정도 아니고 기능 추가도 아님

```bash
refactor: simplify user validation logic
refactor(db): optimize database queries
```

#### perf
- 성능 개선

```bash
perf: improve page load time
perf(api): optimize database query performance
```

#### test
- 테스트 코드 추가 또는 수정
- 프로덕션 코드 변경 없음

```bash
test: add unit tests for user service
test(auth): add integration tests
```

#### build
- 빌드 시스템 또는 외부 의존성 변경
- npm, webpack, gradle 등

```bash
build: upgrade webpack to v5
build(deps): update dependencies
```

#### ci
- CI 설정 파일 및 스크립트 변경
- GitHub Actions, Travis, CircleCI 등

```bash
ci: add automated testing workflow
ci(github): update deployment pipeline
```

#### chore
- 기타 변경사항
- 프로덕션 코드나 테스트에 영향 없음

```bash
chore: update .gitignore
chore(deps): bump version to 1.2.0
```

#### revert
- 이전 커밋 되돌리기

```bash
revert: revert "feat: add user authentication"
```

## Scope (범위)

### 설명
- 변경 범위를 나타냄 (선택사항)
- 프로젝트에 따라 자유롭게 정의

### 예제
```bash
feat(auth): add OAuth2 support
fix(database): resolve connection pool leak
docs(readme): add contributing guidelines
style(header): adjust navbar spacing
```

### 일반적인 스코프 예시
```
- api: API 관련
- ui: UI 관련
- db/database: 데이터베이스 관련
- auth: 인증 관련
- config: 설정 관련
- deps: 의존성 관련
```

## Subject (제목)

### 규칙
1. **명령형, 현재 시제** 사용
   - "add" (O) / "added", "adds" (X)
   - "fix" (O) / "fixed", "fixes" (X)

2. **첫 글자 소문자**
   - "add feature" (O)
   - "Add feature" (X)

3. **마침표 없음**
   - "fix bug" (O)
   - "fix bug." (X)

4. **50자 이내** 권장

### 좋은 예
```bash
feat: add email notification
fix: resolve memory leak in cache
docs: update installation guide
refactor: simplify error handling
```

### 나쁜 예
```bash
feat: Added email notification.  # 과거형, 마침표
Fix: Resolve memory leak          # 대문자 시작
docs: updated installation guide  # 과거형
```

## Body (본문)

### 설명
- 상세한 설명 (선택사항)
- "무엇을", "왜" 변경했는지 설명
- 72자마다 줄바꿈 권장

### 예제
```bash
git commit -m "feat: add user authentication" \
  -m "Implement JWT-based authentication system.
This change adds login and registration endpoints,
token generation and validation, and user session management.

The implementation uses bcrypt for password hashing
and includes rate limiting to prevent brute force attacks."
```

## Footer (푸터)

### Breaking Changes
- **BREAKING CHANGE:** 접두사 사용
- MAJOR 버전 증가

```bash
git commit -m "feat!: redesign authentication API" \
  -m "Complete overhaul of authentication endpoints" \
  -m "BREAKING CHANGE: Authentication endpoints have been redesigned.
Old endpoints /auth/login and /auth/register are removed.
Use /api/v2/auth/signin and /api/v2/auth/signup instead."
```

### 이슈 참조
- 관련 이슈 참조

```bash
git commit -m "fix: resolve login timeout" \
  -m "Increase session timeout to 30 minutes" \
  -m "Closes #123"

# 여러 이슈
git commit -m "feat: add search functionality" \
  -m "Implement full-text search for products" \
  -m "Closes #45, #67, #89"

# 관련 이슈 (닫지 않음)
git commit -m "docs: update API documentation" \
  -m "Refs #100"
```

## 특수 케이스

### Breaking Change (!)
타입 뒤에 `!` 추가하여 Breaking Change 표시

```bash
feat!: remove deprecated API endpoints
fix!: change response format of user API

# 또는 footer에 명시
git commit -m "feat: update authentication system" \
  -m "BREAKING CHANGE: Old authentication method is no longer supported"
```

### 다중 타입
커밋에 여러 변경사항이 있을 경우, 주요 타입 하나만 선택

```bash
# 잘못된 예
git commit -m "feat/fix: add feature and fix bug"

# 올바른 예 - 주요 변경사항으로 분류
git commit -m "feat: add feature and fix related bug"

# 또는 커밋 분리
git commit -m "feat: add new feature"
git commit -m "fix: fix related bug"
```

## 실제 사용 예제

### Feature 추가
```bash
git commit -m "feat(user): add user profile page" \
  -m "Create user profile page with following features:
- Display user information
- Edit profile functionality
- Avatar upload
- Bio editing" \
  -m "Closes #234"
```

### 버그 수정
```bash
git commit -m "fix(auth): resolve token expiration issue" \
  -m "Fix bug where expired tokens were not being refreshed properly.
Updated token validation logic to check expiration time
and automatically refresh when needed." \
  -m "Fixes #145"
```

### 문서 업데이트
```bash
git commit -m "docs: update README with new API examples" \
  -m "Add comprehensive examples for all REST API endpoints
Include request/response samples and error handling"
```

### 리팩토링
```bash
git commit -m "refactor(api): restructure user service layer" \
  -m "Reorganize user service to improve maintainability:
- Separate validation logic
- Extract database operations
- Improve error handling

No functional changes."
```

### Breaking Change
```bash
git commit -m "feat!: redesign API response format" \
  -m "Standardize all API responses to follow new format

Old format:
{ data: {...} }

New format:
{
  success: true,
  data: {...},
  timestamp: '2025-01-01T00:00:00Z'
}" \
  -m "BREAKING CHANGE: All API endpoints now return standardized response format.
Clients need to update response parsing logic."
```

## 모범 사례

### 작은 커밋 유지
```bash
# 좋은 예 - 논리적으로 분리
git commit -m "feat: add user model"
git commit -m "feat: add user service"
git commit -m "feat: add user controller"

# 나쁜 예 - 너무 많은 변경
git commit -m "feat: implement entire user management system"
```

### 의미 있는 메시지
```bash
# 좋은 예
git commit -m "fix(auth): prevent multiple login sessions"

# 나쁜 예
git commit -m "fix: update code"
git commit -m "chore: changes"
git commit -m "feat: stuff"
```

### 현재 시제 사용
```bash
# 좋은 예
git commit -m "add feature"
git commit -m "fix bug"
git commit -m "update documentation"

# 나쁜 예
git commit -m "added feature"
git commit -m "fixed bug"
git commit -m "updating documentation"
```

## 자동화 도구

### commitlint
커밋 메시지 형식 검증

```bash
# 설치
npm install --save-dev @commitlint/cli @commitlint/config-conventional

# commitlint.config.js
module.exports = {
  extends: ['@commitlint/config-conventional']
};
```

### husky
Git hook으로 커밋 전 검증

```bash
# 설치
npm install --save-dev husky

# package.json
{
  "husky": {
    "hooks": {
      "commit-msg": "commitlint -E HUSKY_GIT_PARAMS"
    }
  }
}
```

### Commitizen
대화형 커밋 메시지 작성

```bash
# 설치
npm install --save-dev commitizen cz-conventional-changelog

# 사용
git cz  # git commit 대신 사용
```

### semantic-release
커밋 기반 자동 버전 관리 및 릴리스

```bash
# 설치
npm install --save-dev semantic-release

# 자동으로 다음 작업 수행:
# - 커밋 분석
# - 버전 결정
# - CHANGELOG 생성
# - Git 태그 생성
# - npm 배포
```

## 버전 관리 (Semantic Versioning)

### 버전 증가 규칙
```
- MAJOR (1.0.0): BREAKING CHANGE
- MINOR (0.1.0): feat
- PATCH (0.0.1): fix
```

### 예제
```bash
# 현재 버전: 1.2.3

# PATCH 증가 (1.2.4)
git commit -m "fix: resolve memory leak"

# MINOR 증가 (1.3.0)
git commit -m "feat: add new feature"

# MAJOR 증가 (2.0.0)
git commit -m "feat!: redesign API"
# 또는
git commit -m "feat: breaking changes" \
  -m "BREAKING CHANGE: API redesigned"
```

## 다국어 지원

### 한국어 사용 시
```bash
# 타입은 영어, 본문은 한국어 가능
git commit -m "feat: 사용자 프로필 페이지 추가" \
  -m "아바타 업로드 및 자기소개 수정 기능 포함"

# 권장: 타입과 제목은 영어
git commit -m "feat: add user profile page" \
  -m "사용자 프로필 페이지를 추가합니다.
- 아바타 업로드
- 자기소개 수정"
```

## 템플릿

### 커밋 메시지 템플릿 설정
```bash
# .gitmessage 파일 생성
cat > ~/.gitmessage << EOF
# <type>(<scope>): <subject>
# |<----  50 chars  ---->|

# <body>
# |<----  72 chars  ---->|

# <footer>

# Type: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert
# Scope: api, ui, db, auth, etc.
# Subject: imperative, lowercase, no period
# Body: what and why (optional)
# Footer: issue references, breaking changes (optional)
EOF

# Git에 템플릿 설정
git config --global commit.template ~/.gitmessage
```

## 참고 자료
- [Conventional Commits 공식 문서](https://www.conventionalcommits.org/)
- [Conventional Commits Cheatsheet](https://gist.github.com/qoomon/5dfcdf8eec66a051ecd85625518cfd13)
- [Git Commit Message Best Practices](https://cbea.ms/git-commit/)
- [commitlint](https://commitlint.js.org/)
- [semantic-release](https://semantic-release.gitbook.io/)
