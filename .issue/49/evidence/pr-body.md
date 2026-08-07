관련 이슈: [#49 Add versioned machine phase APIs for issue lifecycle skills](https://github.com/Mineru98/skills-store/issues/49) (통합 테스트 뒤 close)

## 배경

세 lifecycle 스킬(`issue-start` / `issue-end` / `issue-merge`)은 사람이 읽는 CLI 출력만 노출했다. 캠페인 컨트롤러처럼 기계가 단계를 호출하고 중단 지점에서 재개하려면, 버전이 고정되고 스키마로 검증되는 단계 계약이 필요하다. 기존 사람용 흐름·승인·증거 순서·워크트리 경계는 하나도 바꾸지 않는 것이 전제였다.

## 무엇을 추가했나

### 1. 정본 phase 프로토콜

`tools/issue-phase-contract.mjs` 와 `schemas/issue-phase/` 가 단일 정본이다.

- RFC-8785 canonical JSON 직렬화, 중복 키 거부
- phase envelope / capability bundle / protocol 스키마 (strict, `additionalProperties: false`)
- checkpoint·effect·exit code 정의와 재개(resume) 의미

### 2. 세 스킬의 기계 단계

| 스킬 | 단계 수 | 성격 |
|---|---:|---|
| `issue-start` | 13 | 검토 승인 경계까지 |
| `issue-end` | 11 | 증거 정합·push·PR 승인을 각각 분리 |
| `issue-merge` | 9 | 누적 base 바인딩, CI/critic/PR 게이트, cleanup |
| **합계** | **33** | |

단계는 기존 워크플로를 우회하지 않는다. **외부 효과를 실행하지 않고 `proposedEffect` 로 제안**하며, 승인 없이는 zero effect 로 멈춘다.

### 3. fail-closed 무결성

`tools/issue-phase-capabilities.mjs` 가 capability bundle 을 검증한다.

- 저장소 상대 경로 **87개**의 raw-byte(sha256) 폐쇄
- 판정 기준은 번들의 자기 선언이 아니라 **코드가 소유한 13/11/9 단계 목록과 효과 정책** (independent normative oracle)
- 승인 ID 는 checkpoint + 전체 효과 요청 + 불변 상태를 canonical SHA-256 으로 묶어 **정확한 대상에 바인딩**

거부하는 것: 경로 이탈, dangling symlink, 미등록 cleanup worktree, 승인 대상 바꿔치기, 중복 단계, digest 까지 다시 계산한 self-digested 변조(`NORMATIVE_PHASE_MISMATCH`).

## digest

```text
capability  808c41072003062333bc5c4ca87a7eff9a663e0bbe3e1fc110f569c86222a779
closure     8c5f36d189ba7ee0bf725be653e181a800266bfc2341dd4fba1ad7f358fb386e
entries     87
```

## rebase 중 잡힌 실제 회귀

브랜치를 현재 main 위로 rebase 하자 폐쇄 검증이 곧바로 깨졌다. 텍스트 충돌은 0건이었으므로, **이 설계가 없었다면 조용히 통과했을 변경**이다.

```text
242e24a  #48  issue-start/SKILL.md
6670b26  #50  issue-start/scripts/issue-start.mjs
```

87개 중 위 두 파일의 Claude/Codex 미러 4개가 `CLOSURE_HASH_MISMATCH` 로 거부됐다. 번들을 재생성하고 미러를 동기화해 해소했다(`987e358`).

## 검증

```text
node --test scripts/test-*.mjs      90 pass / 0 fail
  ├ test-phase-api.mjs              44
  └ test-phase-compatibility.mjs     9
sh scripts/check-shared.sh          통과   (정본과 사본 68개 동일)
sh scripts/test-flow.sh             통과
sh scripts/test-preflight.sh        통과
node scripts/test-common.mjs        통과
```

설치 미러 양쪽에서 33단계를 실제 호출해 **66회** 통과시켰고, fake provider receipt 로 외부 효과 없이 확인했다.

## 증거

이 작업은 CLI/JSON 프로토콜과 무결성 검증 변경이라 비교할 시각 표면이 없다. webp 캡처 대신 명령 출력과 raw-byte digest 를 텍스트로 남겼다.

- 변경 전: `.issue/49/evidence/before/phase-api-baseline.txt`
- 변경 후: `.issue/49/evidence/after/phase-api-bundle.txt`
