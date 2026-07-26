## 작업 요약

프로젝트 스코프 `.claude/settings.json` 을 새로 추가해, 이 저장소에서 쓰지 않는 스킬 9개를 `skillOverrides` 로 `off` 처리하고 같은 스킬을 `permissions.deny` 로 이중 차단했습니다. `OMC_SKIP_HOOKS=keyword-detector` 로 키워드 자동 발동도 껐습니다. 설정을 커밋했으므로 이 저장소를 여는 모두가 같은 상태로 세션을 시작합니다.

## 증거 형식에 대해

UI 도 API 도 바뀌지 않는 **설정 파일 전용 변경**이라 스크린샷과 성능 측정을 생략했습니다. 대신 완료 기준을 프로그램으로 검증한 실행 출력을 증거로 남겼습니다.

## 변경 전후

**전** — 워크트리를 만든 직후, 파일을 하나도 고치지 않은 상태 ([before.log](https://raw.githubusercontent.com/Mineru98/skills-store/main/.issue/20/evidence/before.log))

```
$ ls .claude/settings.json
ls: .../.claude/settings.json: No such file or directory

$ git ls-files .claude/settings.json
(출력 없음 — 추적되는 파일이 아니다)
```

**후** — 완료 기준 4개 항목 프로그램 검증 ([after-verify.log](https://raw.githubusercontent.com/Mineru98/skills-store/main/.issue/20/evidence/after-verify.log))

```
PASS  JSON 파싱 가능
PASS  env.OMC_SKIP_HOOKS 에 keyword-detector
PASS  skillOverrides 9개 모두 off (실제 9개)
PASS  permissions.deny 18개 짝 완비 (실제 18개)

ALL PASS

$ git check-ignore -v .claude/settings.json ; echo exit=$?
exit=1 (1 = 무시되지 않음 → 커밋 가능)
```

파일 전문은 [after-file.log](https://raw.githubusercontent.com/Mineru98/skills-store/main/.issue/20/evidence/after-file.log) 에 있습니다.

## 변경 파일

- `.claude/settings.json` — 신규 38줄. `env` / `skillOverrides` / `permissions.deny` 세 블록

## 검증

- 완료 기준 4개 항목을 Node 스크립트로 검증 → 전부 PASS
- `git check-ignore` 로 `.gitignore` 에 걸리지 않음을 확인 (`.gitignore` 는 `.claude/worktrees` 만 무시)
- 저장소에 `package.json` 이 없어 lint/type-check/build 는 해당 없음

## 조사에서 확인한 사실

- `skillOverrides` 는 **Claude Code 공식 설정 키**입니다. changelog 근거: "`skillOverrides` setting now works: `off` hides from model and `/`". 따라서 `off` 만으로도 슬래시 호출까지 막힙니다.
- 위 때문에 `permissions.deny` 는 기능상 중복이지만, 설정 병합 순서가 달라져도 막히는 이중 방어로 그대로 유지했습니다.

## 남은 이슈

- 메인 작업 폴더에 같은 파일이 아직 추적되지 않은 상태로 남아 있어, 기본 브랜치를 받아올 때 충돌할 수 있습니다. 내용이 동일하므로 잃는 것은 없습니다. 처리는 마무리 단계에서 확인합니다.
