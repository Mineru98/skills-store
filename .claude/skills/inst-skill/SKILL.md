---
name: inst-skill
description: GitHub URL로 Claude Code 스킬을 설치합니다. GitHub 저장소의 스킬 폴더 URL을 입력하면 해당 스킬의 모든 파일을 자동으로 다운로드하여 .claude/skills/ 에 설치합니다.
argument-hint: "<GitHub URL> [옵션: --global, --name <이름>, --dry-run]"
---

$ARGUMENTS: GitHub 스킬 폴더 URL과 옵션

GitHub URL에서 Claude Code 스킬을 설치해줘.

다음 순서로 진행해:

1. `$ARGUMENTS`를 파싱해서 GitHub URL과 옵션을 분리해줘
2. 스크립트 경로를 확인해: 이 스킬의 script 폴더에 있는 `install-skill.js`를 사용해
3. 다음 명령을 실행해:

```
node <이 스킬의 script/install-skill.js 경로> $ARGUMENTS
```

## 입력 형식

- **URL 형식**: `https://github.com/{owner}/{repo}/tree/{branch}/{path}`
- **옵션**:
  - `--global` : `~/.claude/skills/`에 전역 설치 (기본은 현재 프로젝트의 `.claude/skills/`)
  - `--name <이름>` : 스킬 폴더명을 직접 지정
  - `--dry-run` : 실제 설치 없이 파일 목록만 확인

## 사용 예시

```
/inst-skill https://github.com/Mineru98/skills-store/tree/main/.claude/skills/commands-creator
/inst-skill https://github.com/Mineru98/skills-store/tree/main/.claude/skills/mcp-builder --global
/inst-skill https://github.com/user/repo/tree/main/my-skill --name custom-name
/inst-skill https://github.com/user/repo/tree/main/my-skill --dry-run
```

## 주의사항

- private 저장소는 `GITHUB_TOKEN` 또는 `GH_TOKEN` 환경변수 설정이 필요합니다
- GitHub API 속도 제한(시간당 60회)에 걸리면 토큰을 설정하세요
- 이미 설치된 스킬은 덮어쓰기(업데이트) 됩니다
