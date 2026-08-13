# issue-onboard graph.json V1 데이터 모델 (폐기됨)

V2 구현부터는 [graph-v2.md](graph-v2.md)가 정본이다. 이 문서는 기존 캐시를 읽는 참고용이며,
`blocks`·로컬 `link`·로컬 `unlink` 규칙을 새 그래프에 적용하면 안 된다.

## 위치

`.issue/graph.json` — V1의 로컬 캐시였다. V2부터 GitHub 이슈·구조화된 결정 코멘트가 정본이며,
이 파일은 재생성 후에도 추적하지 않는다. 새 구현은 [graph-v2.md](graph-v2.md)를 따른다.

## 스키마

```json
{
  "version": 1,
  "provider": "github",
  "updatedAt": "2026-08-11T08:35:11.236Z",
  "nodes": {
    "60": {
      "number": 60,
      "title": "feat(issue-onboard): 이슈 온보딩 스킬",
      "status": "in-process",
      "labels": ["enhancement"],
      "url": "https://github.com/owner/repo/issues/60",
      "priority": 1
    }
  },
  "edges": [
    {
      "from": 61,
      "to": 60,
      "type": "depends-on",
      "rationale": "본문 참조에서 자동 감지",
      "createdBy": "sync",
      "createdAt": "2026-08-11T08:35:11.236Z"
    }
  ]
}
```

- `nodes` 는 이슈 번호 문자열 → 노드. 제목·상태·라벨·url 은 트래커가 정본이라 sync 가 덮어쓴다.
  `priority` 는 선택 필드로 sync 가 보존한다.
- `status` 는 기존 `status:*` 라벨 상태기계를 미러한다: open / plan / in-process / review / close.
  status 라벨이 없으면 트래커 state(CLOSED→close, 그 외 open)로 폴백한다.
- `edges` 는 `(from, to, type)` 로 유일하다. 저장 시 번호·타입 순으로 정렬해 diff 를 안정시킨다.

## 엣지 방향 규약

**한 방향만 저장한다.** `from --depends-on--> to` = "from 은 to 가 close 되기 전엔 착수 불가".

```text
depends-on   from 이 to 에 의존         순서 제약 O   (to 를 먼저 끝낸다)
blocks       from 이 to 를 막음          순서 제약 O   (depends-on 의 역: A blocks B == B depends-on A)
relates-to   느슨한 연관                 순서 제약 X   (정보성)
parent-of    from 이 to 의 상위          순서 제약 X   (계층)
duplicate-of from 이 to 의 중복          순서 제약 X   (정보성)
```

순서 제약은 `depends-on` 과 `blocks` 뿐이다. 위상정렬·ready 판정·사이클 검사는 이 둘만 본다.
나머지는 시각화(issue-viz)와 맥락 파악용이다.

## priority

`priority` 는 랭크(작을수록 높음). 노드 필드가 있으면 그 값, 없으면 라벨 `p0`~`p3` 에서 뽑고,
그것도 없으면 뒤로(9) 민다. plan 의 ready·in-progress 정렬에 쓰인다.

## createdBy

- `sync` : 본문 참조에서 자동 감지한 엣지. sync 마다 다시 계산되므로 손으로 고치지 않는다.
- `link` : 사람이 근거와 함께 건 엣지. sync 가 보존한다.
