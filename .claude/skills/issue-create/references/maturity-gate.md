# 성숙도 게이트

이 스킬이 오발동하면 가장 해로운 곳은 **아직 아무것도 없는 새 프로젝트**다.
파일 몇 개 만드는 단계에서 이슈부터 만들면 방해만 된다. 그래서 신호로 먼저 거른다.

## 스크립트 방식 (권장)

```bash
node <skill>/scripts/issue-create.mjs gate
```

## 신호

```text
commits>=20          git rev-list --count HEAD
remote+gh            원격이 있고 gh repo view 성공
issue/pr-history     닫힌 것 포함해 이슈 또는 PR 이력이 하나라도 있음
build-config         package.json / pyproject.toml / go.mod / Cargo.toml / pom.xml / Makefile 등
source>=10           추적 중인 소스 파일 10개 이상
```

## 판정

```text
SKIP    커밋 2개 이하 (신호 수와 무관)
SKIP    충족 신호 0~1개
ASK     충족 신호 2~3개
READY   충족 신호 4개 이상
```

`ASK` 는 AskUserQuestion 한 번으로 끝낸다. 물음은 "이 작업을 이슈로 먼저 등록할까요?" 하나면 충분하다.
`SKIP` 이면 **아무 말도 하지 않고** 원래 요청을 그대로 수행한다. "이슈를 안 만들었습니다" 같은 보고도 하지 않는다.

## 게이트를 건너뛰는 경우

- 사용자가 `/issue-create` 를 직접 호출했다.
- 사용자가 "이슈 만들어줘" 라고 명시적으로 요청했다.

이때는 판정 결과와 무관하게 진행한다. 게이트는 **자동 발동일 때만** 적용된다.

## 이미 이슈가 있는 경우

- 현재 브랜치 이름에 이슈 번호가 있다 (`fix/59-...`) → 이 스킬을 쓰지 않는다. `issue-start` 나 `issue-end` 로 간다.
- 사용자가 이슈 번호를 함께 말했다 → `issue-start` 로 넘긴다.

## 인라인 방식 (스크립트가 없을 때)

```bash
git rev-list --count HEAD
git remote -v
gh repo view --json nameWithOwner
gh issue list --state all --limit 1 --json number
gh pr list --state all --limit 1 --json number
git ls-files | wc -l
```

같은 임계값으로 직접 판정한다.
