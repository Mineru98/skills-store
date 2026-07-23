# 프론트엔드 증거 — Playwright webp 전/후 캡처

목표: 리뷰어가 코드를 읽지 않고도 "고쳐졌다"를 눈으로 확인하게 만든다.

## 1. 캡처 대상 정하기

이슈 본문과 변경 파일에서 화면 단위를 뽑는다. 보통 2~4장이면 충분하다.

- 이슈가 지목한 그 화면 (필수)
- 상태 변화가 있으면 상태별 1장 (기본 / 에러 / 빈 목록 / 선택됨)
- 반응형 이슈면 데스크톱 + 모바일 폭 각 1장
- 관련 없는 화면은 찍지 않는다

`.issue-start/<번호>/images/` 에 이슈 첨부 스크린샷이 있으면 **같은 화면, 같은 상태, 같은 폭**으로 맞춰 찍는다.

## 2. before 캡처

before 는 수정 전 상태다. 이미 수정한 뒤라면 아래 중 하나를 쓴다.

1. 이슈에 첨부된 원본 스크린샷을 before 로 사용 (가장 정확하고 비용이 낮다)
2. `git stash` 로 변경을 잠시 되돌리고 촬영 → `git stash pop`
3. 기본 브랜치 워크트리를 임시로 띄워 촬영

```bash
# 2번 방식 예시
git stash push -u -m issue-end-before
node <skill>/scripts/capture.mjs --url http://localhost:3000/orders \
  --out .issue-evidence/<key>/before/orders-list.webp --wait "text=주문 목록"
git stash pop
```

before 를 재현할 수 없으면 **재현 불가라고 코멘트에 명시**한다. 만들어내지 않는다.

## 3. 개발 서버 확인

```bash
curl -sS -o /dev/null -w '%{http_code}\n' http://localhost:3000
```

응답이 없으면 프로젝트의 실제 개발 서버 명령을 `package.json` 에서 확인해 백그라운드로 띄우고, 뜬 뒤에 캡처한다.
포트가 막혀 있으면 `kill-process` 스킬로 정리한다.

## 4. after 캡처

```bash
node <skill>/scripts/capture.mjs \
  --url http://localhost:3000/orders \
  --out .issue-evidence/<key>/after/orders-list.webp \
  --width 1440 --height 900 --wait "text=주문 목록"
```

옵션:

```text
--full            전체 페이지
--width/--height  뷰포트. 모바일은 390x844
--wait <sel>      셀렉터 대기. 로딩 스켈레톤이 찍히는 것을 막는다
--delay <ms>      애니메이션 종료 대기
--storage <file>  로그인 상태 재사용 (Playwright storageState)
--quality <n>     webp 품질. 기본 82
```

파일명은 `before/` 와 `after/` 에서 **똑같이** 맞춘다. 짝이 맞아야 비교표가 만들어진다.

```text
.issue-evidence/59/before/orders-list.webp
.issue-evidence/59/after/orders-list.webp
```

## 5. 로그인이 필요한 화면

```bash
npx playwright open --save-storage=.issue-evidence/<key>/.auth.json http://localhost:3000/login
node <skill>/scripts/capture.mjs --url ... --storage .issue-evidence/<key>/.auth.json --out ...
```

`.auth.json` 은 **절대 커밋하지 않는다**. `.issue-evidence/**/.auth.json` 을 `.gitignore` 에 추가하고,
`issue-end.mjs commit` 전에 파일이 남아 있는지 확인한다.

## 6. webp 변환

`capture.mjs` 는 sharp → cwebp → ffmpeg 순으로 변환한다. 셋 다 없으면 png 로 남기고 그 사실을 출력한다.
png 로 남았으면 코멘트에 그대로 png 를 쓰고, 변환 도구 설치를 권한다.

```bash
npm i -D sharp        # 또는
sudo apt-get install webp
```

## 7. 코멘트 증거 섹션 형식

이미지 두 장을 나란히 놓는다. GitHub 코멘트에서는 HTML 표가 가장 안정적으로 붙는다.

```markdown
## 증거

### 주문 목록 - 탭 활성 상태

| Before | After |
| --- | --- |
| <img src="<BEFORE_BRANCH_URL>" width="420"> | <img src="<AFTER_BRANCH_URL>" width="420"> |

<sub>이미지가 보이지 않으면: [before](<BEFORE_MIRROR_URL>) · [after](<AFTER_MIRROR_URL>)</sub>

- 변경점: 선택된 탭에만 active 스타일이 적용되도록 수정
- 확인 조건: 1440x900, Chromium, `/orders`
```

`<BEFORE_MIRROR_URL>` 은 기본 브랜치(또는 evidence 브랜치) 기준 URL 이다.
두 벌을 넣는 이유와 생성 방법은 `evidence-commit.md` 참고.

## 체크

- [ ] before/after 파일명이 짝을 이룬다
- [ ] 같은 뷰포트, 같은 상태에서 찍었다
- [ ] 로딩 스켈레톤·툴팁·개인정보가 화면에 없다
- [ ] `.auth.json` 등 인증 파일이 증거 디렉터리에 남아 있지 않다
- [ ] 이미지가 webp 이고 각 500KB 이하다
