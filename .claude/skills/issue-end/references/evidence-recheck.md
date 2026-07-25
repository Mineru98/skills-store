# 증거 재확인과 재캡처

`issue-start` 가 이미 증거를 만들었다면 여기서는 **검사와 보강**만 한다. 처음부터 다시 만들지 않는다.

## 1. 완결성 검사

`context` 출력의 `evidence` 블록을 본다.

```json
{
  "evidence": { "total": 5, "before": 2, "after": 2, "hasComment": true, "files": [...] },
  "evidenceComplete": true
}
```

`evidenceComplete` 는 `before > 0 && after > 0` 이다. 이것만으로는 부족하니 `issue-verifier` 에 아래를 확인시킨다.

```text
1. before 와 after 의 파일명이 짝을 이루는가        (orders.webp ↔ orders.webp)
2. 확장자가 전부 .webp 인가                         (png 면 변환 도구 없이 찍힌 것)
3. after 에 바운딩 박스가 들어갔는가                (없으면 캡처 로그의 boxes.drawn 확인)
4. plan.md 의 증거 계획에 적힌 화면·지표를 다 덮는가
5. comment.md 가 있고 실제 수치·경로를 담고 있는가
```

하나라도 미달이면 그 항목만 보강한다.

## 2. after 재캡처 — 기본 경로

`issue-start` 이후에 수정 커밋이 더 쌓였을 수 있다. **현재 커밋 상태 기준으로 after 를 다시 찍는다.**
캡처 조건은 `plan.md` 의 증거 계획과 기존 before 파일명을 그대로 따른다.

```bash
node <skill>/scripts/capture.mjs \
  --url http://localhost:3000/orders \
  --out .issue/59/evidence/after/orders.webp \
  --width 1440 --height 900 --full --wait "text=주문 목록" \
  --box ".order-row:first-child .status" --box-label "상태 배지"
```

박스 셀렉터는 before 와 **같은 것**을 쓴다. 다르면 비교가 성립하지 않는다.

## 3. before 재캡처 — pure-tree

`before` 가 비었거나 조건이 어긋나면 변경 직전 상태를 복원해야 한다.

```bash
node <skill>/scripts/issue-end.mjs pure-tree --issue 59
```

`.issue/59/pure-tree/` 에 detached 워크트리가 생긴다. 기준은 브랜치 tip 이 아니라 `git merge-base origin/<base> HEAD` — 분기점이어야 "내 변경 직전"이다.

### 왜 git stash 를 쓰지 않는가

| | git stash | detached 워크트리 |
| --- | --- | --- |
| 실패 시 | 작업이 stash 에 갇힌다. 복구를 사람이 해야 한다 | 없다. 순수 추가 연산 |
| untracked | `-u` 없으면 남고, 쓰면 `node_modules` 까지 날아간다 | 무관 |
| 실행 중인 dev server | 파일이 발밑에서 바뀌어 캡처가 오염된다 | 별도 포트로 격리 |

이 스킬은 사람이 지켜보지 않는 상태로 돈다. 실패가 데이터 유실로 이어지는 쪽을 쓰지 않는다.

### 촬영

pure-tree 안에서 의존성을 설치하고 서버를 띄운다. 명령은 추측하지 말고 `plan.md` 의 검증 방법에 적힌 것을 쓴다. 없으면 AskUserQuestion 으로 묻는다.

```bash
cd .issue/59/pure-tree
<설치 명령>
<서버 기동 명령>   # 원래 포트와 충돌하면 다른 포트로
```

캡처 결과는 **원래 워크트리의** `.issue/59/evidence/before/` 에 저장한다. pure-tree 안에 남기면 정리할 때 같이 지워진다.

```bash
node <skill>/scripts/capture.mjs --url http://localhost:3101/orders \
  --out ../../../.issue/59/evidence/before/orders.webp ...
```

### 정리

```bash
node <skill>/scripts/issue-end.mjs pure-tree --issue 59 --remove
```

캡처가 끝나면 반드시 정리한다. 남겨두면 `issue-merge` 의 워크트리 인벤토리에 잡힌다.

## 4. 백엔드 — 측정 재확인

`before/bench.txt` 와 `after/bench.txt` 의 측정 조건이 같은지 본다. 데이터셋·동시성·반복 횟수가 다르면 비교가 무효다.

after 를 다시 재려면 현재 커밋 상태에서 같은 명령을 3회 돌려 중앙값을 쓴다.
before 를 다시 재야 하면 pure-tree 에서 같은 방식으로 잰다.

재현할 수 없으면 지어내지 말고 `미측정 (사유)` 로 남긴다.

## 5. 문서·설정만 바뀐 경우

캡처도 측정도 의미가 없으면 생략하되 `comment.md` 에 **왜 생략했는지와 변경 근거**를 글로 남긴다.
이때도 6·7단계(기본 브랜치 커밋과 이슈 코멘트)는 그대로 수행한다. 커밋 대상이 `comment.md` 하나뿐일 뿐이다.

## 6. 용량

- webp 는 장당 500KB, 총합 5MB 이하.
- 넘으면 `--quality 70` 이나 `--width` 축소로 다시 찍는다.
- 이미지가 4장을 넘으면 코멘트에서 `<details>` 로 접는다.
- 동영상은 커밋하지 않는다. 필요하면 이슈 웹 UI 에 직접 첨부한다.

## 7. 자격 증명

`.issue/**/.auth.json` 과 `storage-state.json` 은 `.gitignore` 블록이 따로 막는다.
커밋 전에 확인한다.

```bash
git status --porcelain .issue/ | grep -i auth   # 아무것도 나오면 안 된다
```
