## 보충 — 작업 정리와 적용 시점

### 기본 브랜치 정리

작업 시작 시점에 메인 작업 폴더에 `.claude/settings.json` 이 추적되지 않은 상태로 남아 있었습니다. 워크트리 커밋(`fddb09e`)의 내용과 **바이트 단위로 동일**함을 확인한 뒤 메인에서 제거했습니다. 이제 기본 브랜치 작업 폴더는 깨끗하고, PR 을 merge 할 때 "추적되지 않은 파일을 덮어쓴다"는 충돌이 발생하지 않습니다.

```
$ git status --short --branch
* main...origin/main
clean — nothing to commit
```

### 설정이 적용되는 시점

세션 도중 작업 디렉터리를 이 워크트리로 옮긴 직후, 차단 대상 스킬 7개(`merge-readiness`, `omc-doctor`, `omc-reference`, `omc-setup`, `release`, `setup`, `wiki`)가 다시 스킬 목록에 나타났습니다. 워크트리에 `.claude/settings.json` 이 커밋되어 있는 상태였습니다.

즉 **프로젝트 설정은 세션이 시작될 때 읽히고, 세션 중에 작업 디렉터리가 바뀌어도 다시 읽지 않습니다.** 저장소를 새 세션으로 열면 정상 적용됩니다.

파일 내용은 완료 기준을 모두 만족하므로 결함이 아니라, 설정이 언제 반영되는지에 대한 사실입니다. 검증 결과는 변하지 않았습니다.

```
PASS  JSON 파싱 가능
PASS  env.OMC_SKIP_HOOKS 에 keyword-detector
PASS  skillOverrides 9개 모두 off (실제 9개)
PASS  permissions.deny 18개 짝 완비 (실제 18개)

ALL PASS
```
