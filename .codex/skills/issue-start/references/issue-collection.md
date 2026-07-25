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

본문과 코멘트에서 이미지 URL 을 모두 뽑는다. 마크다운 `![alt](url)` 과 HTML `<img src="url">` 을 **둘 다** 훑고 중복을 제거한다.

```bash
curl -sSL --max-time 60 -H "Authorization: Bearer $(gh auth token)" \
  -o .issue/59/images/image-01.png "<이미지 URL>"
```

`https://github.com/user-attachments/assets/...` 는 인증이 필요하고 S3 서명 URL 로 리다이렉트된다.
curl 은 호스트가 바뀌면 `Authorization` 헤더를 자동으로 떼므로 위 명령이 그대로 동작한다.
받은 파일이 이미지가 아니면(HTML 오류 페이지 등) 실패로 처리한다.

## 열람 규칙

- `issue.md`(또는 `issue.json`)를 **전부 읽는다**. 스크립트 요약 출력만 믿지 않는다.
- 이미지를 **하나씩 Read 로 연다**. Read 는 이미지를 시각적으로 렌더링한다.
  스크린샷 속 화면, 강조 영역, 에러 메시지, URL, 브라우저 폭, UI 상태를 분석에 반영한다.
- 이미지 입력을 지원하지 않는 환경이면 경로를 사용자에게 알리고 내용 확인을 요청한다.
- 다운로드가 실패했으면 실패 사실과 원본 URL 을 알린다.
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
