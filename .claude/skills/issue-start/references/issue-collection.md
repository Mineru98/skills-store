# 이슈 수집과 열람

산출물 위치는 `.issue/<번호>/` 로 통일한다.

## 스크립트 방식 (권장)

```bash
node <skill>/scripts/issue-start.mjs fetch 59
# 다른 저장소: --repo <owner>/<name>
# 출력 위치 변경: --out <dir>
```

출력 마지막의 `ISSUE_DIR` / `IMAGE_FILES` / `SUGGESTED_PREFIX` 를 기억한다.

## 인라인 방식 (스크립트가 없을 때)

```bash
mkdir -p .issue/59/images
gh issue view 59 --json number,title,state,body,labels,assignees,milestone,comments,url \
  > .issue/59/issue.json
```

본문과 코멘트에서 이미지 URL 을 모두 뽑는다. 마크다운 `![alt](url)` 과 HTML `<img src="url">` 을 **둘 다** 읽는다.
각 URL은 본문이면 이슈 URL, 댓글이면 댓글 URL을 기준으로 절대경로로 해석한다.
일반 링크와 bare URL은 이미지 후보로 기록하되 인라인 이미지로 내려받지 않는다.

```bash
curl -sSL --max-time 60 -H "Authorization: Bearer $(gh auth token)" \
  -o .issue/59/images/image-01.png "<이미지 URL>"
```

`https://github.com/user-attachments/assets/...` 는 인증이 필요하고 S3 서명 URL 로 리다이렉트된다.
private blob은 raw 경로로, private release asset은 GitHub asset API로 전환한다.
인증 헤더는 GitHub 또는 Jira의 신뢰 호스트에만 보낸다. 외부 이미지 호스트에는 토큰을 보내지 않는다.
HTTP 성공 상태, 이미지 계열 Content-Type, 유효한 파일 시그니처를 모두 확인한다.
Content-Type과 시그니처의 이미지 형식만 다르면 시그니처 기준 확장자로 저장하고 경고한다.
HTML·텍스트 응답이나 이미지 시그니처가 없는 파일은 실패로 처리하고 임시 파일을 지운다.

## 열람 규칙

- `issue.md`(또는 `issue.json`)를 **전부 읽는다**. 스크립트 요약 출력만 믿지 않는다.
- 이미지를 **하나씩 Read 로 연다**. Read 는 이미지를 시각적으로 렌더링한다.
  스크린샷 속 화면, 강조 영역, 에러 메시지, URL, 브라우저 폭, UI 상태를 분석에 반영한다.
- 이미지 입력을 지원하지 않는 환경이면 경로를 사용자에게 알리고 내용 확인을 요청한다.
- 다운로드가 실패했으면 이슈 번호, 본문/댓글 위치, 원본 URL, 해석된 URL, 실패 이유를 알린다.
- Notion·Figma 등 외부 링크는 접근 가능하면 WebFetch 로 보강하고, 실패하면 링크만 남기고 진행한다.

## 이미지에서 꼭 뽑아낼 것

```text
화면 경로       URL 바 또는 브레드크럼
재현 조건       입력값, 선택 상태, 로그인 여부
기대와 실제      빨간 화살표·박스가 가리키는 지점
환경            브라우저 폭, 다크모드 여부, 언어
에러 메시지      콘솔·토스트·스택트레이스 원문
```

이 정보는 before 캡처 조건을 그대로 결정한다. plan.md 의 증거 계획에 함께 적어 둔다.

## gitignore

`fetch` 가 `.gitignore` 에 `.issue` 블록을 자동으로 넣는다. 사용자가 손댈 일은 없다.

```gitignore
# issue-* workspace — evidence only stays committed so issue comments render
.issue/**
!.issue/*/
!.issue/*/evidence/
!.issue/*/evidence/**
.issue/**/.auth.json
.issue/**/storage-state.json
```

`.issue/<번호>/` 의 계획·이슈 캐시·첨부 이미지는 무시되고, `.issue/<번호>/evidence/` 만 커밋된다.
이슈 코멘트의 이미지가 raw URL 로 렌더링되려면 증거는 반드시 커밋돼야 하기 때문이다.

`.issue/` 뒤에 `!.issue/` 를 두는 순진한 형태는 동작하지 않는다. `.gitignore` 는 마지막 매치가 이기므로 negation 이 앞줄을 통째로 무효화한다. 위 형태를 그대로 쓴다.
