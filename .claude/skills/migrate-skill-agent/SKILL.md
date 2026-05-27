---
name: migrate-skill-agent
description: skills-store에서 명시한 skill 또는 agent를 찾아 git pull 후 홈 디렉토리나 현재 프로젝트의 Claude/Codex skills/agents로 설치합니다.
argument-hint: "[--skill|--agent] <name> [--target home|project]"
---

$ARGUMENTS: 설치할 skill 또는 agent 이름과 옵션

skills-store에서 지정한 skill 또는 agent를 설치해줘.

다음 순서로 진행해:

1. `$ARGUMENTS`에서 이름과 옵션을 확인해
2. `--target home` 또는 `--target project`가 없으면 사용자에게 홈 디렉토리 업데이트인지 현재 프로젝트 업데이트인지 물어봐
3. 이 스킬의 `scripts/migrate-skill-agent.sh`를 사용해
4. 원본 `$ARGUMENTS`를 셸 문자열로 그대로 붙이지 말고, 파싱한 값을 각각 따옴표로 감싸서 다음 형태로 실행해:

```sh
"<이 스킬의 scripts/migrate-skill-agent.sh 경로>" --skill "<name>" --target home
```

agent를 설치할 때는 `--agent "<name>"`를 사용하고, 현재 프로젝트에 설치할 때는 `--target project`를 사용해.

## 옵션

- `--skill <name>`: skill만 검색해서 설치
- `--agent <name>`: agent만 검색해서 설치
- `<name>`: skill과 agent를 검색. 둘 다 있으면 명시 옵션을 요구
- `--target home`: `~/.claude`와 `~/.codex` 아래에 설치
- `--target project`: 현재 프로젝트의 `.claude`와 `.codex` 아래에 설치

## 동작

- 사용자 디렉토리에서 `skills-store` 프로젝트를 찾는다
- 찾은 저장소에서 `git pull`을 실행한다
- `git pull`이 실패하면 복사하지 않고 중단한다
- 지정한 항목만 복사한다
- 대상 선택 이후에는 기존 항목을 바로 덮어쓴다
- 완료 조건은 복사 성공과 필수 파일 존재 확인이다

## 하지 않는 일

- diff 미리보기 없음
- 백업 없음
- 롤백 없음
- 해시 비교 없음
- 전체 동기화 없음
- 변경 항목 자동 감지 없음
