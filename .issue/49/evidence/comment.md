## 구현 및 검증 리포트

이 작업은 화면 변경이 아니라 CLI/JSON 프로토콜과 무결성 검증 변경입니다. 같은 화면을
비교할 수 있는 시각 표면이 없으므로 webp 캡처와 바운딩 박스는 적용하지 않았고, 변경 전후
명령 출력과 raw-byte digest를 텍스트 증거로 남겼습니다.

| 항목 | 변경 전 | 변경 후 |
| --- | --- | --- |
| 기계 단계 API | 사람용 CLI만 존재 | issue-start 13 / issue-end 11 / issue-merge 9, 총 33단계 |
| 설치 미러 | 단계 계약 없음 | Claude/Codex 양쪽 33단계, 실제 66회 호출 통과 |
| 무결성 | capability 폐쇄 없음 | 87개 저장소 상대 경로 raw-byte 폐쇄와 독립 normative oracle |
| capability digest | 없음 | `235d2a50e35bc2f4e05b7b7e6e1d387e3f6702806cf750e2bcb5dafed58c7d0f` |
| closure digest | 없음 | `8097512fd6589d7395983484907aa19de6621fb3dbbbef33b0a901cfb95352f9` |
| 실패 폐쇄 | 없음 | 경로 이탈·dangling symlink·승인 대상 바꿔치기·중복 단계·self-digested 단계 변조를 거부 |

### 보완 사항

- issue-end는 게시 증거가 있어도 필수 코멘트가 미게시이면 `tracker-comment` 효과를 유지합니다.
- issue-start는 신뢰된 base checkout/workspace 경계 밖 경로와 symlink ancestor를 효과 제안 전에 거부합니다.
- 승인 ID는 checkpoint, 전체 효과 요청, 불변 상태를 canonical SHA-256으로 결합해 정확한 대상에 바인딩합니다.
- capability 검증은 번들 자체 선언이 아니라 코드 소유의 13/11/9 단계 목록과 효과 정책을 기준으로 판정합니다.

### 검증 명령

- `sh scripts/check-shared.sh` — 통과
- `node --test scripts/test-*.mjs` — 88개 통과, 실패 0
- `sh scripts/test-flow.sh` — 통과
- `sh scripts/test-preflight.sh` — 통과
- `sh scripts/test-issue-create.sh` — 통과
- 실제 CLI 수동 시나리오 — 필수 코멘트, 경로 이탈/dangling symlink, cleanup 승인 바꿔치기 모두 fail-closed

### 수동 및 적대적 확인

실제 `.codex` CLI에 canonical 요청 파일을 입력해 외부 효과 없이 상태 코드, stdout/stderr,
`proposedEffect`를 확인했습니다. 서로 다른 cleanup 대상은 다른 승인 ID를 만들고, 다른 대상의
승인 ID 재사용은 `CLEANUP_APPROVAL_MISMATCH`와 zero effect로 중단됩니다. 저장소 capability
bundle은 정상 상태에서 33단계 eligible이며, 단계 효과를 바꾼 뒤 digest까지 다시 계산한 변조본도
`NORMATIVE_PHASE_MISMATCH`로 거부됩니다. 모든 임시 디렉터리와 QA 드라이버를 제거했습니다.

### 증거 파일

- 변경 전: `.issue/49/evidence/before/phase-api-baseline.txt`
- 변경 후: `.issue/49/evidence/after/phase-api-bundle.txt`
