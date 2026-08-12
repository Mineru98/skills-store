# issue-onboard 이슈 그래프 V2 계약

GitHub 이슈와 구조화된 결정 코멘트가 정본이다. `.issue/graph.json`은 재생성 가능한 캐시이며,
`snapshot.status`가 `complete`가 아니면 `plan`, `next`, 자동 코멘트와 상태 변경은 모두 거부한다.
본문 참조가 issue list에 없는 GitHub PR/이슈를 가리키면 sync가 개별 조회해 provenance와 상태를 보존한다.
그 조회가 실패하면 snapshot은 `partial`이며 일정 계산을 재개하지 않는다.
모든 노드는 `problem`, `outcome`, `scope`, `acceptance`, `result`, `components`, `decisions`,
`evidence` 맥락 필드를 갖는다. 알 수 없는 값은 reason/source가 있는 `unknown` 객체로 남기며,
provenance에는 GitHub URL, revision, observedAt을 기록한다. sync는 노드를 GitHub snapshot에서
완전히 재생성해 임시 파일 rename으로 저장한다. V1 `blocks`는 `migrate`에서 역방향
`depends-on`으로 바꾸되 snapshot을 `migrating`으로 남기므로, 이어지는 sync/audit 전에는 실행할 수 없다.

관계는 `depends-on`, `parent-of`, `duplicate-of`, `relates-to`, `supersedes`만 허용한다.
`depends-on`만 실행 순서에 쓰며, `relates-to`는 번호가 작은 쪽에서 큰 쪽으로 정규화한다.
`duplicate-of`는 증거를 포함한 GitHub 구조화 승인 코멘트 뒤에만 만들어진다.

```html
<!-- issue-graph-v2-decision
{"version":1,"id":"relation-78-60-1","action":"relation","decision":"approved","type":"depends-on","from":78,"to":60,"graphRevision":"sha256:...","rationale":"...","evidence":["https://github.com/owner/repo/issues/78#issuecomment-1"]}
-->
```

중복 후보 점수는 outcome 35%, surface 30%, mechanism 25%, acceptance 10%이다. 0.88 이상은
`review-required`, 0.72 이상은 `candidate`이며 어떤 점수도 자동으로 이슈를 닫거나 관계를 만들지 않는다.
