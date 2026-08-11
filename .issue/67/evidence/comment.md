## 재착수 작업 요약

기존 PR #72는 capability bundle 생성 파일 충돌로 보류한 채 유지했습니다. 최신 main에서 새 브랜치를 만들고, private 저장소의 bare URL 문법 오류가 불필요하게 수동 업로드 필요로 분류되지 않도록 수정했습니다.

bare URL은 여전히 문법 오류라 거부됩니다. 다만 보조 링크 문법으로 고치면 사람 개입 없이 통과하고, 실제 private 인라인 이미지는 기존처럼 수동 업로드 대상으로 남습니다.

## 변경 전후

- 전: bare URL이 `needsManualUpload: true`, `pendingUploads` 1개로 분류됨
- 후: 같은 입력이 `needsManualUpload: false`, `pendingUploads` 0개로 분류됨
- 후: 보조 링크로 고친 입력은 `ok: true`로 통과함
- 회귀 확인: private raw 인라인 이미지는 `needsManualUpload: true`를 유지함

원본 로그:

- 전: `.issue/67/evidence/before/retry-bare-url-repro.txt`
- 후: `.issue/67/evidence/after/retry-bare-url-repro.txt`

## 변경 파일

- `tools/issue-media.mjs` — bare URL만 private 수동 업로드 판정에서 제외
- `scripts/test-images.mjs` — bare URL 문법 오류와 보조 링크 수정 경로를 회귀 테스트로 추가
- 공유 사본과 capability bundle — 동기화·재생성

## 검증

- `node scripts/test-images.mjs` 통과
- `sh scripts/test-check-shared.sh` 통과
- `sh scripts/check-shared.sh` 통과
- `TMPDIR=/private/tmp node --test scripts/test-phase-compatibility.mjs` 통과 (9/9)

## 남은 이슈

- 없음. 기존 PR #72는 보류 상태로 유지하며, 이번 새 브랜치에서 별도 PR을 만들 예정입니다.
