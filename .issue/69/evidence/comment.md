## 작업 요약

private 저장소에서 증거 이미지를 수동으로 올려야 할 때, issue-start가 일반 검증 오류 대신 원인을 바로 알리는 안내를 출력하도록 바꿨습니다.

Claude와 Codex 런타임 사본 및 capability bundle을 함께 갱신했습니다.

## 변경 전후

이 변경은 CLI 오류 문구만 다루므로 이미지 캡처 대신 텍스트 증거를 남겼습니다.

- 전: private 수동 업로드도 `리포트 이미지 검증 실패`로만 표시
- 후: `private 저장소라 이미지를 사람이 올려야 합니다. 아래를 처리한 뒤 다시 실행하세요`를 먼저 표시

## 변경 파일

- `.claude/skills/issue-start/scripts/issue-start.mjs` — 수동 업로드 오류 헤더 분기 추가
- `.codex/skills/issue-start/scripts/issue-start.mjs` — 런타임 미러 동기화
- `contracts/issue-phase-capability-bundle-v1.json` 및 사본 — 변경된 raw-byte digest 반영

## 검증

- `node --check` 두 사본 통과
- private raw 이미지 입력에서 `needsManualUpload: true` 확인
- `sh scripts/check-shared.sh` 통과

## 남은 이슈

- 없음
