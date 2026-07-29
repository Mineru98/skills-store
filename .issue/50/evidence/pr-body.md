관련 이슈: [#50 fix(skills): 심볼릭 링크로 설치된 스킬에서 스크립트 main() 이 실행되지 않음](https://github.com/Mineru98/skills-store/issues/50) (통합 테스트 뒤 close)

## 원인

`migrate-skill-agent.sh --link` 로 설치하면 `~/.claude/skills/<name>` 이 이 저장소를 가리키는 심볼릭 링크가 된다. 그 경로로 스크립트를 실행하면 **아무 출력 없이 `exit 0`** 으로 끝났다. 에러도 usage 도 없어 "성공했는데 결과만 없는" 상태로 보인다.

진입점 가드의 두 값이 서로 다른 기준을 쓰고 있었다.

```js
if (process.argv[1] && import.meta.url === `file://${path.resolve(process.argv[1])}`) main();
```

Node ESM 로더는 모듈 URL 을 **realpath 로 정규화**하는데(`--preserve-symlinks-main` 미사용 시), `process.argv[1]` 은 **링크 경로 그대로**이고 `path.resolve` 는 심볼릭 링크를 따라가지 않는다. 그래서 비교가 영원히 불일치했다.

```text
import.meta.url               file:///…/skills-store/.claude/skills/issue-start/scripts/issue-start.mjs
path.resolve(process.argv[1])      /home/doweb/.claude/skills/issue-start/scripts/issue-start.mjs
```

## 수정

세 갈래로 흩어져 있던 판별 로직을 `isMainModule()` 하나로 통일했다.

```js
function isMainModule(metaUrl) {
  const entry = process.argv[1];
  if (!entry) return false;
  const here = fileURLToPath(metaUrl);
  const resolved = path.resolve(entry);
  if (here === resolved) return true;   // 일반 실행 — 파일시스템 접근 없이 끝난다
  try {
    return realpathSync(here) === realpathSync(resolved);
  } catch {
    // 같은 경로였다면 위에서 이미 true 다. 여기서 실패했다면 진입점이 아니다.
    return false;
  }
}
```

핵심은 **양쪽을 모두 realpath 로 푸는 것**이다. `argv[1]` 만 풀면 `--preserve-symlinks-main` 으로 실행할 때 `import.meta.url` 쪽이 링크 경로로 남아 반대 방향으로 다시 어긋난다.

`fileURLToPath` 로 `file://` 문자열 조합도 제거했다. 손으로 이어붙이면 공백이 든 경로에서 퍼센트 인코딩이 빠져 어긋나는데, **이건 심볼릭 링크와 독립된 별개 결함**이었다.

빠른 경로를 앞에 둬 일반 실행에서는 `realpathSync` 호출이 아예 없다.

## 변경 파일 9개

| 형태 | 파일 |
|---|---|
| A `` `file://${path.resolve(argv[1])}` `` | `issue-start.mjs` · `issue-create.mjs` · `gh-env.mjs` 의 `.claude` / `.codex` 사본 (6) |
| B `` `file://${argv[1]}` `` | `imagine/scripts/verify.js` (1) |
| C `path.resolve(argv[1]) === fileURLToPath(…)` | `loop.mjs` · `schedule.mjs` (2) |

`.claude` 와 `.codex` 사본은 동일성을 유지했다. `issue-end.mjs` · `issue-merge.mjs` 는 가드가 없어 해당 없음.

## 검증

9개 스크립트 × 4개 실행 경로. 값은 `<출력바이트>:<exit code>` 이고 **`0:0` 이 조용한 실패**다.

| | symlink | realpath | relative | spaced |
|---|:---:|:---:|:---:|:---:|
| **변경 전** — 형태 A·B (7개) | `0:0` | 정상 | 정상 | `0:0` |
| **변경 전** — 형태 C (2개) | `0:0` | 정상 | 정상 | 정상 |
| **변경 후** — 9개 전부 | 정상 | 정상 | 정상 | 정상 |

**36칸 전부 realpath 기준과 일치**한다. 심볼릭 링크로 실제 서브커맨드(`issue-start.mjs guard`)가 동작하는 것도 확인했다 — usage 출력만이 아니다.

```
node --check (문법)   9/9 OK
loop.test.mjs         33 pass / 0 fail
schedule.test.mjs     38 pass / 6 fail   ← 아래 참고
import 시 main() 미실행  clean
```

`schedule.test.mjs` 의 `fail 6` 은 전부 `run-due`(codex 실행 하네스) 계열이며, 변경 전 `origin/main`(`9054bc1`)에서도 동일하게 38 pass / 6 fail 인 것을 별도 워크트리로 대조 확인했다. 진입점 가드와 무관하다.

## 조사 중 정정한 것 두 가지

**1. 결함이 하나가 아니라 둘이었다.** `spaced` 를 심볼릭 링크와 섞지 않고 실제 복사본으로 분리 측정하니, 형태 A·B 7개는 **공백 경로에서도** 같은 증상으로 깨지고 있었다. `fileURLToPath` 를 쓰는 형태 C 만 그것에 면역이었다.

**2. "상대 경로에서도 깨진다"는 추정은 틀렸다.** Node 가 `process.argv[1]` 을 이미 절대 경로로 만들어 주기 때문에 변경 전에도 정상이었다. 측정으로 확인했다.

## merge 후에 효력이 생긴다

`~/.claude/skills/*` 심볼릭 링크는 이 저장소의 기본 브랜치를 가리킨다. 지금 기본 브랜치에는 증거만 올라가 있고 수정은 이 브랜치에 있다. **merge 돼야 설치된 스킬이 실제로 고쳐진다.**

## 증거

[전후 리포트 보기](https://github.com/Mineru98/skills-store/issues/50#issuecomment-5110554233)

재현: `bash .issue/50/evidence/harness/run-entrypoint-probe.sh after`
