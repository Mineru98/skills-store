# issue-onboard 이슈 그래프 V2 계약

GitHub 이슈와 구조화된 결정 코멘트가 정본이다. `.issue/graph.json`은 재생성 가능한 캐시이며,
`snapshot.status`가 `complete`가 아니면 `plan`, `next`, 자동 코멘트와 상태 변경은 모두 거부한다.
본문 참조가 issue list에 없는 GitHub PR/이슈를 가리키면 sync가 개별 조회해 provenance와 상태를 보존한다.
그 조회가 실패하면 snapshot은 `partial`이며 일정 계산을 재개하지 않는다.

## 저장 계약

```json
{
  "version": 2,
  "provider": "github",
  "repository": "owner/repo",
  "snapshot": { "status": "complete", "fetchedAt": "ISO-8601", "digest": "sha256:..." },
  "nodes": {
    "78": {
      "id": "github:owner/repo#78",
      "number": 78,
      "title": "...",
      "status": "open",
      "labels": ["enhancement"],
      "url": "...",
      "context": {
        "problem": { "value": "unknown", "reason": "...", "source": "..." },
        "outcome": { "value": "unknown", "reason": "...", "source": "..." },
        "scope": { "value": "unknown", "reason": "...", "source": "..." },
        "acceptance": { "value": "unknown", "reason": "...", "source": "..." },
        "result": { "value": "unknown", "reason": "...", "source": "..." },
        "components": { "value": "unknown", "reason": "...", "source": "..." },
        "decisions": { "value": "unknown", "reason": "...", "source": "..." },
        "evidence": { "value": "unknown", "reason": "...", "source": "..." }
      },
      "provenance": { "url": "...", "revision": "GitHub updatedAt", "observedAt": "ISO-8601" }
    }
  },
  "edges": []
}
```

`unknown`은 결측을 숨기지 않는다. 사람·자동화가 사실을 알 수 없으면 값 대신
`{ "value": "unknown", "reason": "...", "source": "..." }`를 기록한다.
sync는 이전 캐시 노드를 보존하지 않고 GitHub snapshot에서 다시 만든 뒤 임시 파일 rename으로
원자 저장한다. `migrate`는 V1의 `blocks`를 역방향 `depends-on`으로 정규화하지만 snapshot을
`migrating`으로 남긴다. `sync`와 `audit`을 통과하기 전에는 이를 실행 가능한 그래프로 취급하지 않는다.

## 온톨로지 검증

tools/issue-ontology가 graph-v2 JSON Schema와 create/start/end/merge action schema의
정본이다. Ajv는 문서 shape, 필수 키, 허용된 enum과 action precondition을 검사하고,
기존 issue-graph-v2 walker는 dangling edge, parent-of 순환·중복 parent, duplicate 승인과
close 불일치를 검사한다. Ajv가 없는 복사 설치의 경계 guard는 skip하지만, 이 저장소의
validate와 island 테스트는 Ajv 없이는 실패한다.

노드 상태를 계산할 때는 tracker state의 CLOSED 또는 MERGED가 stale status 라벨보다
우선한다. 따라서 CLOSED 이슈에 status:open이 남아 있어도 close/done으로 분류한다.

## 관계와 실행 규칙

`depends-on`, `parent-of`, `duplicate-of`, `relates-to`, `supersedes`만 허용한다.

- `from --depends-on--> to`: from은 to가 close 되기 전 착수할 수 있다. 이것만 plan/next에 쓴다.
- `from --parent-of--> to`: from이 상위 이슈다. child는 하나의 parent만 가질 수 있고 계층 순환은 금지한다.
- `from --duplicate-of--> to`: from은 중복이고 to가 canonical 이슈다. 구조화 승인 없이는 만들 수 없다.
- `relates-to`는 번호가 작은 쪽에서 큰 쪽으로 정규화한다.
- `supersedes`는 from이 to를 대체한다. 어느 관계도 `depends-on` 외 스케줄에 영향을 주지 않는다.

## GitHub 승인 코멘트

관계·중복·override는 대상 이슈에 아래 형식의 전용 코멘트로 남긴다. 구현자는 이 JSON 문법을
바꾸지 않으며, `id`, 증거, 코멘트 ID와 digest를 캐시에 함께 보존한다.

```html
<!-- issue-graph-v2-decision
{"version":1,"id":"relation-78-60-1","action":"relation","decision":"approved","type":"depends-on","from":78,"to":60,"graphRevision":"sha256:...","rationale":"...","evidence":["https://github.com/owner/repo/issues/78#issuecomment-1"]}
-->
```

중복 후보 검색은 생성 전 후보를 넓게 찾는 용도다. 점수는 outcome 35%, surface 30%,
mechanism 25%, acceptance 10%으로 합산한다. 0.88 이상은 `review-required`, 0.72 이상은
`candidate`, 그 미만은 `distinct`다. 어떤 점수도 자동 등록 차단·이슈 종료·관계 생성을 하지 않는다.
`duplicate-of`는 사람이 증거를 포함한 승인 코멘트를 남긴 뒤에만 캐시에 반영한다.
같은 `id`의 최신 코멘트가 `revoked`이면 기존 승인을 폐기한다. `graphRevision`이 없거나
증거가 비어 있는 결정은 그래프 관계가 되지 않는다.
