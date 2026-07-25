Closes #1

## 변경 내용

- `shared/issue-common.mjs` → `tools/issue-common.mjs` (rename, 내용 동일)
- `scripts/sync-shared.sh` — `SRC` 경로, 사본 배너, 헤더 주석
- `scripts/test-common.mjs` — `import` 경로, 헤더 주석
- `.claude/skills/*/scripts/issue-common.mjs` ×4, `.codex/skills/*/scripts/issue-common.mjs` ×4 — 배너 (sync 로 자동 생성)
- `README.md` — 저장소 구조 블록에 `tools/` 추가

`sync-shared.sh` 라는 **파일명**의 `shared` 는 이슈 범위 밖이라 그대로 뒀다.

## 검증

변경 전후 같은 명령을 돌렸고 전부 통과했다.

| 명령 | 전 | 후 |
| --- | --- | --- |
| `sh scripts/check-shared.sh` | 통과 | 통과 |
| `node scripts/test-common.mjs` | 통과 | 통과 |
| `bash scripts/verify-ignore.sh` | 통과 | 통과 |
| `bash scripts/test-flow.sh` | 통과 | 통과 |
| `grep -rn "shared/issue-common"` | 13건 | **0건** |

## 증거

https://github.com/Mineru98/skills-store/issues/1#issuecomment-5080624380

원본은 `.issue/1/evidence/{before,after}/` 에 있고 `main` 에도 커밋돼 있다.
