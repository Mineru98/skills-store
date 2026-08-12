# DAG 연산 — sync · link · plan · next · validate

## sync — 그래프 갱신

```bash
node <skill>/scripts/issue-todo.mjs sync [--state open|closed|all] [--limit <n>]
```

- 트래커에서 이슈를 끌어와 노드를 갱신한다(기본 `--state all`, `--limit 200`).
- 각 이슈 본문에서 아래 패턴을 엣지로 자동 감지한다.

```text
"depends on #N" / "depends-on #N" / "blocked by #N" / "needs #N"   → depends-on
"blocks #N"                                                        → blocks
```

- 자동 엣지는 `createdBy=sync` 로 매번 다시 계산한다. 손으로 건 엣지(`createdBy=link`)는 보존한다.
- 출력 `CYCLE=` 이 비어 있지 않으면 순환이 있다. `validate` 로 경로를 확인한다.

## link / unlink — 의존 손보기

```bash
node <skill>/scripts/issue-todo.mjs link <from> <to> [--type depends-on|blocks|relates-to|parent-of|duplicate-of] [--why "<근거>"]
node <skill>/scripts/issue-todo.mjs unlink <from> <to> [--type <type>]
```

- `--type` 기본값은 `depends-on`. `--why` 로 근거를 남긴다(provenance).
- 순서 엣지(depends-on/blocks)가 순환을 만들면 추가하지 않고 거부한다(exit 2).
- 자기 자신 엣지, 중복 엣지는 거부/무시한다.
- `unlink` 는 `--type` 을 주면 그 타입만, 없으면 from→to 의 모든 엣지를 뗀다.

## plan (todo) — 분류 산출

```bash
node <skill>/scripts/issue-todo.mjs plan [--json]
```

각 노드를 네 부류로 나눈다. 판정 규칙:

```text
done         status == close
blocked      선행(prereq) 중 close 가 아닌 것이 있음
in-progress  선행이 전부 close 이고 status ∈ {plan, in-process, review}
ready        선행이 전부 close 이고 status == open
```

- `ready` 와 `in-progress` 는 우선순위(priorityRank) → 번호 순으로 정렬한다.
- `blocked` 은 각 항목에 "대기 중인 선행 번호"를 함께 낸다.
- 기계 출력: `READY_NUMBERS` / `BLOCKED_NUMBERS` / `IN_PROGRESS_NUMBERS` / `DONE_NUMBERS`.
- 인자 없이 `issue-todo` 만 부르면 plan 을 낸다.

## next — 다음 착수 추천

```bash
node <skill>/scripts/issue-todo.mjs next
```

ready-frontier 의 첫 이슈(우선순위·번호 순)를 골라 `NEXT=$issue-start #N` 을 제안한다.
ready 가 비면 진행 중 목록을 안내한다.

## validate — 점검

```bash
node <skill>/scripts/issue-todo.mjs validate
```

- **사이클**: 순서 엣지에서 순환을 찾으면 경로를 내고 exit 2.
- **dangling 엣지**: from/to 가 노드에 없는 엣지.
- **알 수 없는 타입**: EDGE_TYPES 밖의 엣지.
- **close 불일치**: done 인 노드가 아직 done 이 아닌 선행에 의존.
- 문제가 하나라도 있으면 exit 1(사이클이면 2). 없으면 `VALID=1`.

## 전형적 흐름

```text
sync                      # 그래프를 최신으로
plan                      # 지금 뭐부터 할 수 있나
link 70 60 --why "..."    # 자동 감지 못한 의존 보강
validate                  # 순환·불일치 없나
next                      # 다음 착수 1건 → $issue-start #N
```
