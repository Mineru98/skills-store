---
description: 변경된 파일을 기능별로 그룹화하여 커밋 생성
allowed-tools: Bash(git add:*), Bash(git status:*), Bash(git commit:*), Bash(git diff:*), Bash(git log:*)
model: claude-haiku-4-5-20251001
argument-hint: [커밋 메시지 힌트 (선택)]
---

지금 즉시 아래 워크플로우를 실행하라. 질문하지 말고 바로 실행하라.

## 현재 상태 수집

```bash
!git status
!git diff --stat
!git log --oneline -3
```

## 실행 지시

위 상태를 분석하여 다음을 수행하라:

1. **변경 파일 분석**: 위의 git status와 git diff 결과를 기반으로 변경된 파일들을 파악한다.
2. **기능별 그룹화**: 변경 파일들을 아래 기준으로 그룹으로 나눈다:
   - `feat` - 새로운 기능 추가
   - `fix` - 버그 수정
   - `docs` - 문서 업데이트
   - `style` - 코드 스타일 수정 (동작 변경 없음)
   - `refactor` - 코드 리팩토링
   - `test` - 테스트 추가/수정
   - `chore` - 유지보수 작업
3. **그룹별 커밋 생성**: 각 그룹마다 관련 파일만 `git add`로 스테이징한 뒤 커밋한다.
4. **커밋 내역 검증**: `git log --oneline -5`로 결과를 확인한다.

## 커밋 메시지 규칙

- 형식: `<type>(<scope>): <subject>`
- **커밋 메시지는 반드시 한글로 작성**
- 명령형 현재 시제 사용: "추가", "수정", "삭제"
- subject는 50자 이내, 끝에 마침표 없음
- 필요시 body에 상세 설명 추가

## 한글 커밋 메시지 깨짐 방지

`git commit -m "한글"` 사용 시 터미널 환경에 따라 한글이 깨질 수 있다. **반드시 HEREDOC 또는 임시 파일 방식을 사용하라.**

### macOS/Linux (HEREDOC 방식 - 권장)
```bash
git commit -m "$(cat <<'EOF'
feat(auth): JWT 로그인 및 미들웨어 추가

- JWT 토큰 생성 구현
- 보호된 라우트용 인증 미들웨어 추가

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

### Windows PowerShell (임시 파일 방식)
PowerShell에서는 `-m` 옵션으로 한글 전달 시 인코딩 문제가 발생한다. UTF-8 임시 파일을 사용하라:
```powershell
chcp 65001
# commit_msg.txt에 UTF-8로 메시지 작성 후:
git commit -F commit_msg.txt
Remove-Item commit_msg.txt
```

사용자 힌트: $ARGUMENTS
