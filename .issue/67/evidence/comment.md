## 작업 요약

`tools/issue-media.mjs`의 `validateEvidenceReport`가 private 저장소에서 bare URL(마크다운 문법으로 감싸지 않은 맨 URL) 문법 오류를 실제 사람 업로드가 필요한 상황으로 잘못 분류하던 문제를 고쳤습니다. 이제 bare-url 문법 오류는 문법만 고치면(`[파일명](URL)`로 감싸면) 사람 개입 없이 통과합니다.

이 이슈도 화면 변경이 없어(neither 판정) 스크립트 실행 로그로 전후를 비교합니다.

## 변경 전후

같은 입력(private 저장소, raw URL을 bare URL로 씀)에 대해:

**before**

```json
{
  "ok": false,
  "errors": [
    "이미지 URL이 bare URL로 작성되었습니다: ...",
    "private 저장소라 인라인 렌더링이 안 됩니다(...): ..."
  ],
  "needsManualUpload": true,
  "pendingUploads": ["raw.githubusercontent.com/acme/private/main/after.webp"]
}
```

**after**

```json
{
  "ok": false,
  "errors": [
    "이미지 URL이 bare URL로 작성되었습니다: ..."
  ],
  "needsManualUpload": false,
  "pendingUploads": []
}
```

`ok: false`는 그대로입니다(문법은 여전히 고쳐야 함). 달라진 건 `needsManualUpload`가 `false`로 바뀐 것 — 이제 `[파일명](URL)`로 감싸는 문법 수정만으로 통과하고, `issue-start`/`issue-end`가 더 이상 "이슈 웹 UI에 이미지를 직접 업로드하라"는 7.5단계로 잘못 유도하지 않습니다.

원본 로그는 `.issue/67/evidence/before/bare-url-repro.txt`, `.issue/67/evidence/after/bare-url-repro.txt`에 있습니다.

## 변경 파일

- `tools/issue-media.mjs` — `validateEvidenceReport`의 private raw/release 분기에 `ref.syntax !== 'bare-url'` 조건 추가. `markdown-image` 등 실제로 인라인 렌더링을 의도한 문법(진짜 업로드가 필요한 경우)은 기존 동작 그대로 유지.
- `scripts/test-images.mjs` — bare-url 오분류를 막는 회귀 테스트 2건 추가(문법 오류로만 거부되는 것, 문법을 고치면 통과하는 것).
- `.claude`/`.codex` 각 스킬의 `scripts/issue-media.mjs` 미러 사본, `contracts/issue-phase-capability-bundle-v1.json` 및 미러 — `tools/issue-media.mjs`가 capability bundle 87경로 closure에 포함되어 있어 `sync-shared.sh` + `build-phase-capability-bundle.mjs`로 재생성했다.

## 검증

- `node scripts/test-images.mjs` 통과 (신규 테스트 포함)
- `node --test scripts/test-phase-compatibility.mjs` — 8/9 통과. 남은 1개(`installed phase contracts complete through both mirrors with fake providers`)는 이번 변경 이전에도 동일하게 실패하던 환경 종속 문제로, 이 이슈와 무관해 손대지 않았다.
- `sh scripts/check-shared.sh` 통과

## 남은 이슈

- `html-image` 문법(`<img src=...>`)은 이번 수정 범위 밖입니다. 안내 메시지가 `markdown-image`(인라인 이미지 문법)로 고치라고 유도하는데, private raw/release는 그 문법으로 고쳐도 여전히 렌더링이 불가능해 진짜 사람 업로드가 필요하기 때문입니다.
