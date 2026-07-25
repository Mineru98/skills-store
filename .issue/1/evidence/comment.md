## 작업 요약

공용 모듈 정본을 `shared/issue-common.mjs` → `tools/issue-common.mjs` 로 옮기고 참조 지점 5곳을 갱신했다. vendored 사본 8개의 배너는 `sync-shared.sh` 재실행으로 자동 갱신됐다.

`sync-shared.sh` 라는 **파일명**의 `shared` 는 이슈 범위 밖이라 그대로 뒀다.

## 변경 전후

이 이슈는 화면·성능과 무관해 캡처와 측정 대신 **구조 변화와 검증 명령 출력**을 증거로 남긴다. 그래서 바운딩 박스 이미지가 없다.

### 저장소 루트

```diff
  AGENTS.md      assets/       CLAUDE.md
  LICENSE        README.md     scripts/
- shared/
+ tools/
```

### 정본 참조 지점

변경 전 13곳이 `shared/issue-common.mjs` 를 가리켰고, 변경 후 **0곳**이다.

| 파일 | 변경 전 | 변경 후 |
| --- | ---: | ---: |
| `scripts/sync-shared.sh` | 3 | 0 |
| `scripts/test-common.mjs` | 2 | 0 |
| vendored 사본 (`*/scripts/issue-common.mjs`) | 8 | 0 |
| **합계** | **13** | **0** |

원본 출력은 `.issue/1/evidence/{before,after}/canonical-refs.txt`.

## 변경 파일

- `shared/issue-common.mjs` → `tools/issue-common.mjs` (rename, 내용 동일)
- `scripts/sync-shared.sh` — `SRC` 경로, 사본 배너, 헤더 주석
- `scripts/test-common.mjs` — `import` 경로, 헤더 주석
- `.claude/skills/*/scripts/issue-common.mjs` ×4, `.codex/skills/*/scripts/issue-common.mjs` ×4 — 배너 (sync 로 자동 생성)
- `README.md` — 저장소 구조 블록에 `tools/` 추가

## 검증

변경 전후 같은 명령을 돌렸고 전부 통과했다. 원본 출력은 `.issue/1/evidence/{before,after}/verify.txt`.

| 명령 | 변경 전 | 변경 후 |
| --- | --- | --- |
| `sh scripts/check-shared.sh` | 통과 | 통과 |
| `node scripts/test-common.mjs` | 통과 | 통과 |
| `bash scripts/verify-ignore.sh` | 통과 (11 무시 / 5 커밋) | 통과 (11 무시 / 5 커밋) |
| `bash scripts/test-flow.sh` | 통과 | 통과 |
| `grep -rn "shared/issue-common"` | 13건 | **0건** |

## 완료 기준 대조

- [x] `shared/` 가 사라지고 `tools/issue-common.mjs` 존재
- [x] `sync-shared.sh` 가 8개 사본을 갱신하고 배너가 `canonical: tools/issue-common.mjs`
- [x] `check-shared.sh` 통과
- [x] `test-common.mjs` 통과
- [x] `test-flow.sh` 통과 (회귀 없음)
- [x] `shared/issue-common` 잔존 0건
- [x] `README.md` 저장소 구조에 `tools/` 추가

## 남은 이슈

없음.

---

<sub>`issue-end` 재확인: 증거 완결성 `complete` · 기본 브랜치 미러 `main` (변경 없음) · 검증 명령 4종 재통과.</sub>
