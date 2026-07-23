# 백엔드 증거 — 전/후 비교표

목표: 숫자로 끝낸다. "빨라졌습니다" 대신 "p95 820ms → 140ms (-83%)".

## 1. 무엇을 측정할지 먼저 고른다

이슈 성격에 따라 지표가 다르다. 관련 없는 지표를 채우지 않는다.

```text
성격              1순위 지표                        보조 지표
---------------  --------------------------------  --------------------------
API 응답 성능     p50 / p95 / p99 latency, RPS      에러율, CPU, 메모리
쿼리 튜닝         쿼리 실행시간, 스캔 행 수          EXPLAIN 계획, 인덱스 사용 여부
N+1 제거          쿼리 횟수, 총 응답시간             DB 커넥션 점유 시간
배치/워커         처리 건수/초, 총 소요시간          재시도 수, 피크 메모리
버그 수정         재현 케이스 입출력                 관련 테스트 통과 여부
메모리/누수       RSS, heap used 추이                GC 횟수
```

## 2. before 측정

before 를 못 재현하면 만들어내지 말고 "미측정"으로 남긴다. 재현 방법 우선순위:

1. 기본 브랜치 워크트리를 따로 띄워 같은 조건에서 측정
   ```bash
   git worktree add ../<repo>-base origin/<base>
   ```
2. `git stash` 로 변경분만 잠시 되돌리고 측정
3. 이슈 본문에 이미 기록된 수치를 인용 (출처를 명시)

**측정 조건을 반드시 고정한다.** 같은 데이터셋, 같은 머신, 같은 동시성, 같은 워밍업.

## 3. 측정 명령

프로젝트에 이미 있는 벤치마크·부하 스크립트를 먼저 찾는다(`package.json`, `Makefile`, `k6/`, `locust/`, `bench/`).
없을 때만 아래를 쓴다.

```bash
# HTTP 지연/처리량
oha -z 30s -c 50 http://localhost:8080/api/orders
# 또는
hey -z 30s -c 50 http://localhost:8080/api/orders
autocannon -d 30 -c 50 http://localhost:8080/api/orders

# 단발 응답시간 20회
for i in $(seq 20); do curl -sS -o /dev/null -w '%{time_total}\n' http://localhost:8080/api/orders; done

# 쿼리 계획
psql -c 'EXPLAIN (ANALYZE, BUFFERS) SELECT ...'
```

원본 출력은 `.issue-evidence/<key>/before/bench.txt`, `after/bench.txt` 로 저장한다.
표에 요약을 쓰되 원본을 증거로 함께 커밋한다.

## 4. 코멘트 비교표 형식

이슈 코멘트에서는 GitHub 마크다운 표를 쓴다. 변화율까지 계산해서 넣는다.

```markdown
## 증거

### 측정 조건
- 커밋: `abc1234` (before) → `def5678` (after)
- 데이터: 주문 12만 건 시드, 로컬 Postgres 16
- 부하: `oha -z 30s -c 50 GET /api/orders?page=1`
- 3회 반복 중 중앙값

### GET /api/orders

| 지표 | Before | After | 변화 |
| --- | ---: | ---: | ---: |
| p50 | 410 ms | 82 ms | **-80%** |
| p95 | 820 ms | 140 ms | **-83%** |
| p99 | 1,240 ms | 210 ms | -83% |
| RPS | 61 | 348 | **+470%** |
| 쿼리 수 | 141 | 3 | -98% |
| 에러율 | 0% | 0% | - |

### 원인과 조치
- N+1: `OrderService.list` 가 주문마다 고객을 개별 조회 → `IN` 배치 조회로 변경
- `orders(created_at, status)` 복합 인덱스 추가

<details>
<summary>원본 측정 출력</summary>

```text
<before bench.txt 요약 붙여넣기>
---
<after bench.txt 요약 붙여넣기>
```

</details>
```

## 5. 표 작성 규칙

- 숫자는 오른쪽 정렬(`---:`), 단위를 셀 안에 함께 쓴다.
- 변화율은 (after-before)/before 로 계산하고, 개선이면 부호와 함께 굵게.
- 좋아진 지표만 고르지 않는다. 악화된 지표도 그대로 넣고 이유를 쓴다.
- 측정 노이즈가 큰 항목은 "측정 편차 ±n%" 를 각주로 남긴다.
- 미측정 항목은 빈칸이 아니라 `미측정 (사유)` 로 채운다.

## 6. 성능 이슈가 아닌 백엔드 변경

버그 수정·계약 변경이면 성능표 대신 케이스 표를 쓴다.

```markdown
| 케이스 | 입력 | Before | After |
| --- | --- | --- | --- |
| 만료 쿠폰 | `coupon=EXPIRED1` | 200 + 할인 적용 | 400 `COUPON_EXPIRED` |
| 정상 쿠폰 | `coupon=OK1` | 200 + 할인 적용 | 200 + 할인 적용 (동일) |
```

관련 테스트를 추가했다면 실행 결과를 함께 붙인다.

```bash
npm test -- orders   # 실제 명령은 저장소 스크립트를 확인해서 특정
```

## 체크

- [ ] before/after 측정 조건이 동일하다
- [ ] 원본 출력을 `.issue-evidence/<key>/{before,after}/` 에 저장했다
- [ ] 표에 변화율이 있다
- [ ] 악화된 지표를 숨기지 않았다
- [ ] 측정하지 못한 항목을 "미측정"으로 명시했다
