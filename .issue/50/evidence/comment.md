## 원인 — 두 값이 서로 다른 기준을 쓰고 있었다

```js
if (process.argv[1] && import.meta.url === `file://${path.resolve(process.argv[1])}`) main();
```

Node ESM 로더는 모듈 URL 을 **realpath 로 정규화**한다(`--preserve-symlinks-main` 미사용 시). 반면 `process.argv[1]` 은 **링크 경로 그대로**이고 `path.resolve` 는 심볼릭 링크를 따라가지 않는다. 그래서 비교가 영원히 불일치하고 `main()` 이 호출되지 않는다.

```text
import.meta.url               file:///…/skills-store/.claude/skills/issue-start/scripts/issue-start.mjs
path.resolve(process.argv[1])      /home/doweb/.claude/skills/issue-start/scripts/issue-start.mjs
                                   └ 링크 경로 그대로 → 불일치 → main() 미호출 → 조용한 exit 0
```

## 측정 결과 — 9개 스크립트 × 4개 실행 경로

값은 `<출력바이트>:<exit code>`. **`0:0` 이 조용한 실패**(출력 없이 성공 종료)다.

### 변경 전

| 스크립트 | symlink | realpath | relative | spaced |
|---|:---:|:---:|:---:|:---:|
| `issue-start.mjs` (claude) | **0:0** | 1090:1 | 1090:1 | **0:0** |
| `issue-start.mjs` (codex) | **0:0** | 1090:1 | 1090:1 | **0:0** |
| `issue-create.mjs` (claude) | **0:0** | 1343:1 | 1343:1 | **0:0** |
| `issue-create.mjs` (codex) | **0:0** | 1343:1 | 1343:1 | **0:0** |
| `gh-env.mjs` (claude) | **0:0** | 298:1 | 298:1 | **0:0** |
| `gh-env.mjs` (codex) | **0:0** | 298:1 | 298:1 | **0:0** |
| `imagine/verify.js` | **0:0** | 54:1 | 54:1 | **0:0** |
| `loop/loop.mjs` | **0:0** | 108:2 | 108:2 | 108:2 |
| `schedule/schedule.mjs` | **0:0** | 116:2 | 116:2 | 116:2 |

### 변경 후

| 스크립트 | symlink | realpath | relative | spaced |
|---|:---:|:---:|:---:|:---:|
| `issue-start.mjs` (claude) | 1090:1 | 1090:1 | 1090:1 | 1090:1 |
| `issue-start.mjs` (codex) | 1090:1 | 1090:1 | 1090:1 | 1090:1 |
| `issue-create.mjs` (claude) | 1343:1 | 1343:1 | 1343:1 | 1343:1 |
| `issue-create.mjs` (codex) | 1343:1 | 1343:1 | 1343:1 | 1343:1 |
| `gh-env.mjs` (claude) | 298:1 | 298:1 | 298:1 | 298:1 |
| `gh-env.mjs` (codex) | 298:1 | 298:1 | 298:1 | 298:1 |
| `imagine/verify.js` | 54:1 | 54:1 | 54:1 | 54:1 |
| `loop/loop.mjs` | 108:2 | 108:2 | 108:2 | 108:2 |
| `schedule/schedule.mjs` | 116:2 | 116:2 | 116:2 | 116:2 |

**36칸 전부 realpath 기준과 일치**한다. 조용한 실패가 하나도 남지 않았다.

심볼릭 링크 경로로 실제 서브커맨드도 확인했다 — usage 출력만이 아니다.

```bash
$ node /tmp/links/issue-start/scripts/issue-start.mjs guard
{ "ok": true, "branch": "fix/50-symlink-main-guard", "baseBranch": "main", "issue": "50", … }
```

## 조사 중 드러난 것 두 가지

**1. 결함이 하나가 아니라 둘이었다.** `spaced` 열을 심볼릭 링크와 섞지 않고 **실제 복사본**으로 분리 측정하니 갈렸다.

| 형태 | symlink | spaced |
|---|:---:|:---:|
| A·B — `` `file://${경로}` `` (7개) | 깨짐 | **깨짐** |
| C — `fileURLToPath` (2개) | 깨짐 | 정상 |

`file://` 를 손으로 이어붙이면 공백 경로에서 퍼센트 인코딩이 빠져 어긋난다. 심볼릭 링크와 **독립된 별개 결함**이며, `fileURLToPath` 를 쓰는 형태 C 만 면역이었다.

**2. "상대 경로에서도 깨진다"는 추정은 틀렸다.** Node 가 `process.argv[1]` 을 이미 절대 경로로 만들어 주기 때문에 `relative` 열은 변경 전에도 정상이었다. 측정으로 확인했고 이슈 본문의 해당 추정을 정정한다.

## 수정

`isMainModule()` 로 세 형태를 하나로 통일했다.

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

핵심은 **양쪽을 모두 realpath 로 푸는 것**이다. `argv[1]` 만 풀면 `--preserve-symlinks-main` 으로 실행할 때 `import.meta.url` 쪽이 링크 경로로 남아 **반대 방향으로 다시 어긋난다.**

빠른 경로를 앞에 둬서 일반 실행에서는 `realpathSync` 호출이 아예 없다. `catch` 의 `false` 는 조용한 실패가 아니다 — 경로가 같았다면 이미 위에서 `true` 로 끝났고, 여기까지 와서 경로가 없다면 그것은 실행 중인 진입점이 아니다.

| 실행 경로 | 통과 이유 |
|---|---|
| 일반 | `here === resolved` → 빠른 경로 |
| 심볼릭 링크(기본) | 양쪽 realpath → 일치 |
| 심볼릭 링크(`--preserve-symlinks-main`) | 양쪽 링크 경로 → 빠른 경로 |
| 상대 경로 | `path.resolve` 가 절대화 |
| 공백 포함 | `fileURLToPath` 가 퍼센트 디코딩 |
| 모듈 `import` | `argv[1]` 이 다른 파일 → `false` (성질 유지) |

## 변경 파일 9개

- 형태 A (6): `issue-start.mjs` · `issue-create.mjs` · `gh-env.mjs` 의 `.claude` / `.codex` 사본
- 형태 B (1): `imagine/scripts/verify.js` — 주변 스타일에 맞춰 `"..."` 따옴표와 `node:` 접두사 없는 import 유지
- 형태 C (2): `loop.mjs` · `schedule.mjs` — import 추가 불필요, `fs.realpathSync` 사용

`.claude` 와 `.codex` 사본은 동일성을 유지했다. `issue-end.mjs` · `issue-merge.mjs` 는 가드가 없어 해당 없음.

## 완료 조건 점검

- [x] 심볼릭 링크 경로 실행에서 9개 스크립트 모두 정상 동작
- [x] realpath / 상대 / 공백 포함 경로 모두 정상 — 36칸 전부 일치
- [x] 모듈 `import` 시 `main()` 미실행 유지 — `importMainNotExecuted: clean`
- [x] 존재하지 않는 경로에서 예외로 죽지 않음 — 빠른 경로 + `try/catch`
- [x] 진입점 판별 로직이 `isMainModule()` 한 형태로 통일

## 테스트

```
node --check (문법)   9/9 OK
loop.test.mjs         33 pass / 0 fail
schedule.test.mjs     38 pass / 6 fail   ← 아래 참고
```

`schedule.test.mjs` 의 `fail 6` 은 전부 `run-due`(codex 실행 하네스) 계열이며, 변경 전 `origin/main`(`9054bc1`)에서도 동일하게 38 pass / 6 fail 이다. 진입점 가드와 무관하다.

## 남은 한계

이슈 본문의 줄 번호(526·428)는 27커밋 뒤처진 로컬 main 기준이었다. `origin/main` 기준으로는 `issue-start.mjs:529`, `issue-create.mjs:463` 이다. 나머지는 동일하다.

---

증거 원본 — [before](https://github.com/Mineru98/skills-store/blob/main/.issue/50/evidence/before/) · [after](https://github.com/Mineru98/skills-store/blob/main/.issue/50/evidence/after/) · [재현 하네스](https://github.com/Mineru98/skills-store/blob/main/.issue/50/evidence/harness/run-entrypoint-probe.sh)

재현: `bash .issue/50/evidence/harness/run-entrypoint-probe.sh after`
