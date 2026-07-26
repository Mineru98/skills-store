관련 이슈: [#6 feat(issue): 워크트리 흐름의 마무리 경험을 다듬는다](https://github.com/Mineru98/skills-store/issues/6) (통합 테스트 뒤 close)

## 변경 내용

`issue-create` / `issue-start` / `issue-end` / `issue-merge` 네 스킬의 마무리 구간을 다듬는다.
다섯 기능이 모두 정본 `tools/issue-common.mjs` 를 공유해서 한 커밋으로 묶었다.

### 1. 증거 push 뒤 기본 브랜치 자동 최신화

`sync-base` 서브커맨드를 `issue-start` / `issue-end` 에 추가했다. 미러는 임시 워크트리에서
`origin/<base>` 로 곧장 push 하므로 주 체크아웃이 뒤처지는데, 그걸 바로 받아온다.

안전할 때만 받아온다 — 브랜치를 갈아타지 않고, 임의로 stash 하지 않고, 실패하면 되돌린다.
스킬군이 스스로 만든 `.gitignore` 블록과 증거 파일은 받아올 내용과 글자까지 같을 때만
정리하고, 하나라도 다르면 손대지 않고 막은 파일을 `dirtyPaths` 로 알린다.

### 2. 네 스킬 모두 종료 시 다음 단계 4지선다

`references/next-actions.md` 를 세 스킬에 새로 두고 `issue-end` 것도 형식을 맞췄다.
상황에 따라 권장 위치가 바뀐다. 선택은 항상 사용자가 한다.

### 3. 링크와 경로를 클릭 가능하게

4개 SKILL.md 에 `링크와 경로 쓰는 법` 공통 블록을 넣었다.
이슈·PR 은 `[설명](링크)`, 워크트리는 `children` → 상대 / `sibling` → 절대.
설정값이 아니라 `git worktree list` 의 실제 경로로 판별한다.

### 4. 기본 브랜치를 저장소별로 기억

`--base` → `.issue/settings.json` → `origin/HEAD`→main→master → 홈 기본값 순.
판별한 값을 `.issue/settings.json` 에 적어 재사용한다. 그 파일은 기존 `.issue/**`
무시 규칙에 걸려 커밋되지 않는다.

### 5. `nested` → `children` 일괄 변경

완전 교체. 옛 값은 모르는 값으로 취급해 배치를 한 번만 다시 묻는다.

## 검증

```text
sync-shared --check   정본과 사본 8벌 동일
check-shared          통과
test-common           통과   36 → 51 단언 (+15)
test-flow             통과   28 → 41 검사 (+13)
verify-ignore         통과   11개 무시 / 5개 커밋
node --check          17개 스크립트 전부 통과
```

변경 전 수치는 `issue-end` 의 `pure-tree` 로 `0db4314` 를 그대로 체크아웃해 같은 명령을 돌려 얻었다.

## 증거

[전후 리포트 보기](https://github.com/Mineru98/skills-store/issues/6#issuecomment-5081053511)

화면이 없는 CLI·문서 변경이라 스크린샷 대신 명령 출력을 증거로 남겼다.
원본은 `.issue/6/evidence/` 에 있고 `main` 에 커밋돼 있다.

## 리뷰어가 봐야 할 것

- `tools/issue-common.mjs` 의 `syncBaseCheckout` / `blockingPaths` — 사용자 파일을 덮어쓸 여지가 없는지
- `detectBase` 우선순위가 기존 호출부(4개 스크립트)를 깨지 않는지. 시그니처는 그대로 뒀다
- `.issue/settings.json` 이 실제로 무시되는지 (`verify-ignore` 가 확인하지만 눈으로도)

## 알려진 겹침

[#5 `status:*` 라벨](https://github.com/Mineru98/skills-store/issues/5) 이 같은 정본 파일을 건드린다.
merge 순서는 `issue-merge` 가 잡아야 한다.
