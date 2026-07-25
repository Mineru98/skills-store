## 작업 요약

`issue-create` / `issue-start` / `issue-end` / `issue-merge` 네 스킬의 마무리 구간을 다듬었다.
증거를 올린 뒤 기본 브랜치를 자동으로 최신화하고, 스킬이 끝날 때 다음 단계를 추천하고,
이슈·PR·워크트리 경로를 클릭 가능하게 쓰고, 기본 브랜치를 저장소별로 기억하고,
`nested` 를 `children` 으로 바꿨다.

화면이 없는 CLI·문서 변경이라 스크린샷 대신 **명령 출력을 증거로** 남긴다.

## 변경 전후

| 항목 | 전 | 후 |
| --- | --- | --- |
| `test-flow` 검사 | 28 | **41** (+13) |
| `test-common` 단언 | 36 | **51** (+15) |
| `sync-base` 서브커맨드 | `✗ 알 수 없는 모드` | 구조화 JSON 반환 |
| 워크트리 배치 이름 | `['sibling', 'nested']` | `['sibling', 'children']` |
| 표시 경로 계산(`worktreeDisplayPath`) | 없음 | 있음 |
| 프로젝트 기본 브랜치 설정 | 없음 | `.issue/settings.json` |
| `next-actions.md` | 1개 (issue-end) | **4개** (전 스킬) |
| `링크와 경로 쓰는 법` 블록 | 없음 | **4개 SKILL.md 전부** |

원본은 `.issue/6/evidence/` 에 있다.

- `before/test-flow.txt` · `after/test-flow.txt` — 흐름 테스트 전문
- `before/features.txt` · `after/features.txt` — 기능 유무 확인
- `after/verify.txt` — 전체 검증

변경 전 상태는 `issue-end` 의 `pure-tree` 로 `0db4314` 를 그대로 체크아웃해 같은 명령을 돌렸다.

## `sync-base` 실제 동작

증거 캡처 중에 실제로 안전장치가 걸렸다. 꾸며낸 출력이 아니다.

```json
{
  "ok": false,
  "base": "main",
  "path": "/Users/mineru/Documents/Github/skills-store",
  "branch": "main",
  "skipped": "dirty",
  "reason": "주 체크아웃에 저장하지 않은 변경이 있습니다."
}
```

메인 체크아웃에 저장 안 된 변경이 있어 **아무것도 건드리지 않고** 사유를 돌려줬다.
스킬은 이 값을 받아 쉬운 말로 풀어 사용자에게 선택지를 준다.

## 변경 파일

48개 파일 (+5230 / −281). 주요 부분만 적는다.

- `tools/issue-common.mjs` — 정본. `syncBaseCheckout` / `worktreeDisplayPath` / 프로젝트 설정 / `detectBase` 우선순위
- `.claude|.codex/skills/issue-*/scripts/*.mjs` — `sync-base` 서브커맨드, `base` 모드, `display` 필드
- `.claude|.codex/skills/issue-*/SKILL.md` — `링크와 경로 쓰는 법` 공통 블록, 단계·마무리 보고 갱신
- `.claude|.codex/skills/issue-{create,start,merge}/references/next-actions.md` — 신규
- `scripts/test-common.mjs` · `scripts/test-flow.sh` — 검증 추가
- `README.md` — 배치 이름, 기본 브랜치 전략, 자동 최신화, 다음 단계 추천

## 검증

```text
sync-shared --check   정본과 사본 8벌 동일
check-shared          통과
test-common           통과 (51개 단언)
test-flow             통과 (41개 검사)
verify-ignore         통과 (11개 무시, 5개 커밋)
node --check          17개 스크립트 전부 통과
```

## 정정

커밋 메시지에 "함께 고친 버그 3건" 이라고 적었는데 정확하지 않다.
세 건 모두 **이번 변경에서 새로 만든 결함을 테스트로 잡아 고친 것**이고, 기존에 배포돼 있던 버그가 아니다.

1. `children` 안전장치가 `layout === 'nested'` 를 검사 — 이름을 바꾸면서 생긴 누락
2. `git status --porcelain` 첫 줄 파싱이 한 글자 밀림 — 새로 쓴 코드
3. `resolveWorktreePath` 가 모르는 layout 을 sibling 으로 떨어뜨림 — 이름 변경으로 드러난 경로

## 남은 이슈

- 이 이슈는 작업 후 소급 등록이라 `issue-create` → `issue-start` 정상 순서를 밟지 않았다.
- #5 (`status:*` 라벨)가 같은 정본 파일을 건드린다. merge 순서를 `issue-merge` 가 잡아야 한다.
