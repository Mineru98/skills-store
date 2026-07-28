## 구현 및 검증 리포트

이 작업은 화면 변경이 아니라 CLI/JSON 프로토콜과 무결성 검증 변경입니다. 같은 화면을
비교할 수 있는 시각 표면이 없으므로 webp 캡처와 바운딩 박스는 적용하지 않았고, 변경 전후
명령 출력과 raw-byte digest를 텍스트 증거로 남겼습니다.

| 항목 | 변경 전 | 변경 후 |
| --- | --- | --- |
| 기계 단계 API | 사람용 CLI만 존재 | issue-start 13 / issue-end 11 / issue-merge 9, 총 33단계 |
| 설치 미러 | 단계 계약 없음 | Claude/Codex 양쪽 33단계, 실제 66회 호출 통과 |
| 무결성 | capability 폐쇄 없음 | 87개 저장소 상대 경로 raw-byte 폐쇄 |
| capability digest | 없음 | `98d8ed89292930fbcc5f43ad1f0cf06099883ae2efe3fedeeb33345811746d48` |
| closure digest | 없음 | `b9701b1f9fe31baebb36109d2aa01c6fa478b628883a1f0efddd39da420e7480` |
| 실패 폐쇄 | 없음 | ID/스키마/미러/경로/심볼릭 링크/효과/공급자 드리프트 모두 거부 |

### 검증 명령

- `sh scripts/check-shared.sh` — 통과
- `node scripts/test-common.mjs` — 통과
- `sh scripts/test-flow.sh` — 통과
- `sh scripts/test-preflight.sh` — 통과
- `node --test scripts/test-phase-api.mjs scripts/test-phase-compatibility.mjs` — 47개 통과, 실패 0
- 변경된 모든 `.mjs`의 `node --check` — 통과
- commit `6424edb55abaf2cc6df6842e14015c857c4e4dfb`의 fresh clone에서 같은 전체 명령 — 통과

### 수동 및 적대적 확인

fresh clone의 실제 capability bundle을 읽어 양쪽 설치 미러의 모든 단계 계약을 fake provider
receipt로 호출했습니다. 이어서 미러 계약 한 바이트와 canonical schema 한 바이트를 각각 바꿨을 때
compatibility/active eligibility가 모두 실패하는 것을 확인했습니다. malformed input, prompt-shaped
issue data, stale/dirty state, uncertain provider outcome, 반복 중단/재개도 외부 효과 없이 held/rejected로
남는 것을 확인했습니다.

### 증거 파일

- 변경 전: `.issue/49/evidence/before/phase-api-baseline.txt`
- 변경 후: `.issue/49/evidence/after/phase-api-bundle.txt`
