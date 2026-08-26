## 작업 요약

Issue workflow 스킬과 전용 에이전트를 `Mineru98/samsara`로 분리한 뒤 원본 저장소에 남은 중복 자산을 제거했습니다. README는 현재 저장소의 일반 스킬과 분리된 저장소 위치를 안내하도록 갱신했습니다.

## 변경 전후

작업 성격이 문서·자산 정리(`neither`)라 실행 화면이나 API 응답을 캡처할 대상이 없습니다. 대신 파일 목록과 diff 검증 결과를 `.issue/103/evidence/before/manifest.txt`와 `.issue/103/evidence/after/manifest.txt`에 남겼습니다.

## 변경 파일

- `.claude/skills/`와 `.codex/skills/`의 issue workflow 및 지정 보조 스킬 제거
- `.claude/agents/`와 `.codex/agents/`의 issue 전용 에이전트 제거
- `README.md`의 저장소 설명과 설치 안내 갱신

## 검증

- 제거 대상 18개 스킬 디렉터리와 8개 issue 에이전트가 모두 존재하지 않음
- 남은 스킬·에이전트가 일반 자산으로만 구성됨
- README에 `Mineru98/samsara` 링크가 있고 제거된 개별 자산명은 없음
- `git diff --check origin/main..HEAD` 통과
- 삭제와 README를 다음 두 커밋으로 분리
  - `bc760f5` `chore(issue): issue 워크플로 자산 제거`
  - `61c0b11` `docs(readme): samsara 분리 안내 갱신`

## 남은 이슈

없음
