## 작업 요약

README 최상단의 사용 순서와 상세 가이드를 issue 워크플로 우선으로 재구성했습니다.
Codex와 Claude Code용 복사 가능한 설치 프롬프트, 설치 위치, 필수 에이전트, 전제 조건, 단일·병렬 사용 흐름을 추가했습니다.
현재 스킬 정본과 대조해 오래된 provider·워크트리·증거·상태·merge 안내도 함께 바로잡았습니다.

## 변경 전후

- 전: `visual-companion`이 상세 가이드 1번이고 issue 스킬은 14~17번에 흩어져 있었습니다.
- 후: `issue-create`, `issue-start`, `issue-end`, `issue-merge`가 1~4번이고 `visual-companion`은 5번입니다.
- 전: 네 스킬과 세 보조 에이전트를 한 번에 설치하는 프롬프트가 없었습니다.
- 후: Codex와 Claude Code 각각에 대해 홈·프로젝트 설치를 선택할 수 있는 복사용 프롬프트가 있습니다.

이미지는 생략했습니다. README 문서 구조와 프롬프트 내용은 브라우저 캡처보다 텍스트 diff와 Markdown 렌더링 결과가 직접적인 증거입니다.

## 변경 파일

- `README.md` — issue 워크플로 우선 배치, 설치 프롬프트와 사용 가이드 추가, 최신 스킬 동작에 맞춘 기존 설명 보정

## 검증

- `git diff --check` 통과
- GitHub Markdown render API 통과
- 번호가 있는 상세 가이드 1~17 순서 확인
- `<details>` 24개 열기 / 24개 닫기 확인
- Markdown 코드 펜스 158개로 균형 확인
- 프롬프트에 적힌 스킬·에이전트 경로가 모두 존재함을 확인
- 구현 커밋의 변경 파일이 `README.md` 하나뿐임을 확인

## 증거

- `.issue/26/evidence/before/readme-structure.txt`
- `.issue/26/evidence/after/readme-structure.txt`

## 남은 이슈

없음
