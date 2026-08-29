## 작업 요약

`.claude/skills/imagine` 스킬 패키지를 제거했습니다.
스킬 본체, 설정, 설치 문서, 실행 스크립트 등 추적 파일 7개를 삭제했습니다.
저장소 외부 참조는 없었으며 다른 Claude 스킬 8개는 그대로 유지했습니다.

## 변경 전후 근거

- 변경 전: `.issue/105/evidence/before/inventory.txt`에 추적 파일 7개와 내부 참조 6개를 기록했습니다.
- 변경 후: `.issue/105/evidence/after/inventory.txt`에 빈 추적·참조 검색 결과와 보존된 스킬 8개를 기록했습니다.
- 이미지 생략: UI나 API가 없는 저장소 스킬 삭제이므로 화면 캡처 대신 파일·참조 인벤토리를 사용했습니다.

## 변경 파일

- `.claude/skills/imagine` 아래 추적 파일 7개 삭제

## 검증

- `git ls-files '.claude/skills/imagine/**'` 결과 없음
- 저장소 전체 `imagine` 경로·단어 검색 결과 없음 (`.git`, `.issue` 제외)
- `.claude/skills`의 다른 최상위 스킬 8개 유지
- `git diff HEAD^ --check` 통과

## 커밋

- `8f84ebf chore(imagine): 이미지 스킬 제거`

## 남은 이슈

- 없음
