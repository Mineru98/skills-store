## 작업 요약

누락된 Codex 스킬 UI 메타데이터 5개를 추가했습니다.
메타데이터 규격에 맞지 않던 기본 프롬프트 참조 3개도 실제 `$skill-name`으로 바로잡았습니다.

## 변경 전후 근거

- 변경 전: 스킬 14개 중 메타데이터 5개 누락, 기본 프롬프트 참조 3개 불일치
- 변경 후: 스킬 14개 모두 메타데이터 보유, 누락 0개, 참조 불일치 0개
- 화면 캡처 생략: UI 화면이 아닌 YAML 설정 메타데이터만 변경한 작업입니다.
- 원본 검증 결과: `.issue/3/evidence/before/openai-yaml-audit.txt`, `.issue/3/evidence/after/openai-yaml-audit.txt`

## 변경 파일

- `commit`, `install-skill`, `kill-process`, `migrate-skill-agent`, `visual-companion` — `agents/openai.yaml` 추가
- `irasutoya-search`, `loop`, `schedule` — `default_prompt`의 스킬 참조 수정

## 검증

- 추가·수정한 메타데이터 8개 YAML 파싱 및 필수 필드 검증 통과
- `short_description` 25~64자 규칙 통과
- 모든 `default_prompt`의 `$skill-name` 일치 확인
- `git diff --check` 통과

## 남은 이슈

- 이번 범위 밖의 기존 검증 문제: `issue-end`, `issue-merge`의 설명 길이가 64자를 초과합니다.
- 이번 범위 밖의 기존 검증 문제: `install-skill`, `migrate-skill-agent`의 `SKILL.md`가 `argument-hint` 키를 사용합니다.
