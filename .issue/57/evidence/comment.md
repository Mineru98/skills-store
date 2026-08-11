## 작업 요약

`scripts/check-shared.sh` 가 capability bundle(87경로 raw-byte closure) 최신성을 검사하지 않아, 87경로 중 하나라도 바뀐 채 번들을 재생성하지 않고 merge 되는 사고가 두 번(#48·#50, #53·#55) 있었습니다. `scripts/build-phase-capability-bundle.mjs` 에 `--check` 모드를 추가하고 `check-shared.sh` 가 이를 호출하도록 해, merge 전 검사에서 걸러지게 했습니다.

이 이슈는 화면 변경이 없어(neither 판정) 스크린샷 대신 스크립트 실행 로그로 전후를 비교합니다.

## 변경 전후

**before** — `check-shared.sh` 는 정본↔사본 드리프트만 검사하고 capability bundle 최신성은 검사하지 않습니다. 낡은 번들이어도 통과합니다.

```text
sync-shared: 정본과 모든 사본이 동일하다

check-shared: 통과
```

**after** — 같은 명령이 이제 capability bundle 최신성도 함께 검사합니다.

```text
sync-shared: 정본과 모든 사본이 동일하다

capability bundle: 최신

check-shared: 통과
```

**stale 거부 확인** — 신규 테스트 `scripts/test-capability-bundle-check.mjs` 가 closure 파일 하나를 수정한 뒤 재생성 없이 `--check` 를 돌리면 실패하고, `sync-shared.sh → build-phase-capability-bundle.mjs → sync-shared.sh` 로 재생성한 뒤에는 통과하는 것을 고정합니다.

```text
✔ [active-required] --check rejects a stale capability bundle and accepts a regenerated one
```

원본 로그는 `.issue/57/evidence/before/check-shared.txt`, `.issue/57/evidence/after/check-shared.txt` 에 있습니다.

## 변경 파일

- `scripts/build-phase-capability-bundle.mjs` — `--check` 모드 추가. 파일을 쓰지 않고 `verifyCapabilityBundle()` 로 최신성만 검사한다.
- `scripts/check-shared.sh` — `build-phase-capability-bundle.mjs --check` 호출 추가.
- `scripts/test-capability-bundle-check.mjs` (신규) — stale 거부 / 재생성 후 통과를 고정하는 회귀 테스트.
- `contracts/issue-phase-capability-bundle-v1.json` 및 `.claude`/`.codex` 미러 사본 — 위 스크립트 변경 자체가 closure 87경로에 포함되어 번들을 재생성했다(이번 이슈가 고치려는 바로 그 상황을 실제로 겪었다).

## 검증

- `node --test scripts/test-capability-bundle-check.mjs` 통과 (신규)
- `node --test scripts/test-phase-compatibility.mjs` — 8/9 통과. 남은 1개(`installed phase contracts complete through both mirrors with fake providers`)는 이번 변경 이전에도 동일하게 실패하던 환경 종속 문제로(`claude:issue-start.intake exited 2`), 이 이슈와 무관해 손대지 않았다.
- `sh scripts/check-shared.sh` 통과

## 남은 이슈

- 없음. CI(`​.github/workflows/`) 신설은 이슈 본문이 "구현 시 판단"으로 남겼고, 완료 기준이 `check-shared.sh` 확장을 명시적으로 인정하는 선택지로 적어 두어 그쪽으로 마무리했다.
