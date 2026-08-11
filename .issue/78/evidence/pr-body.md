관련 이슈: [#78 GitHub 정본 기반 추적 가능한 이슈 그래프 V2 설계](https://github.com/Mineru98/skills-store/issues/78) (통합 테스트 뒤 close)

## 변경 내용

- GitHub 정본·구조화 승인 코멘트·V2 관계 어휘를 그래프 계약으로 추가했습니다.
- snapshot·중복·상하위 관계의 provenance와 fail-closed 일정 계산을 구현했습니다.
- issue list에서 제외되는 참조 PR/이슈도 개별 해석해 선행 상태를 보존합니다.

## 검증

- `node scripts/test-issue-graph-v2.mjs`
- `sh scripts/test-issue-create.sh`
- `sh scripts/check-shared.sh`
- 실제 GitHub sync → validate → plan → next

## 증거

[구현 리포트 보기](https://github.com/Mineru98/skills-store/issues/78#issuecomment-5255610522)
