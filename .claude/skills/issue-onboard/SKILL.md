---
name: issue-onboard
description: GitHub 이슈 그래프를 읽어 현재 작업 맥락, 우선순위, 시각화, 다음 행동을 한 번에 안내합니다. "무엇부터 할까", "이슈 온보딩", "이슈 현황", "다음 작업 추천", "그래프 보고 시작", "/issue-onboard" 요청에 사용합니다. 그래프가 없으면 issue-sync로 완전 스냅샷을 만든 뒤 HTML·이미지와 최대 6개의 우선순위를 보여 주고, 착수·열린 PR 병합·새 이슈 등록 중 다음 행동을 묻습니다.
---

# Issue Onboard

GitHub 이슈가 정본이고 `.issue/graph.json`은 재생성 캐시다. `issue-onboard`는 그래프를 온보딩 화면으로 바꾸는 진입점이다. 관계를 직접 수정하거나 이슈 상태를 바꾸지 않는다.

## 입력

```text
/issue-onboard [--all] [--out <html 경로>] [--image-out <webp 경로>]
```

- 기본: 최대 6개 우선순위, 그래프 HTML·이미지, 다음 행동을 낸다.
- `--all`: 같은 우선순위 형식으로 전체 목록도 이어서 낸다.
- `sync`, `plan`, `next`, `validate`, `audit`, `migrate`는 그래프 유지·진단용 하위 명령이다.

## 절차

1. `.issue/graph.json`을 확인한다. 없으면 `/issue-sync`를 호출해 GitHub 전체 snapshot을 만든다.
2. 완전 snapshot만 읽는다. partial·cycle·dangling이면 순위와 다음 추천을 내지 않고 이유를 알린다.
3. GitHub의 열린 이슈와 그래프 상태를 함께 읽어 ready → in-progress → blocked 순, P0~P3·번호 순으로 정렬한다.
4. `/issue-viz`로 HTML을 렌더하고 webp 이미지를 추출한다.
5. 최대 6개를 먼저 보여 준다. 더 있으면 `--all` 요청으로 같은 형식의 전체 목록을 이어서 낸다.
6. 최우선 이슈 착수, 열린 PR 병합, 새 이슈 등록 중 하나를 선택받는다.

## 경로 규칙

- 기본 브랜치: HTML·이미지는 저장소 기준 상대 경로로 보고한다.
- 링크된 워크트리: HTML·이미지는 Markdown 대괄호 없이 절대 경로로 보고한다.
- webp 이미지 추출이 가능한 브라우저가 없으면 HTML 경로와 `IMAGE_STATUS=unavailable`만 남긴다. 그래프와 우선순위 흐름은 계속한다.

## 하드 규칙

- 그래프가 없을 때 빈 결과를 내지 않는다. `issue-sync`를 먼저 실행한다.
- `issue-sync` 실패는 명확히 보고하고, 불완전 그래프에서 추천하지 않는다.
- 그래프 캐시를 직접 부분 수정하지 않는다. GitHub에서 다시 동기화한다.
- 우선순위 목록은 처음에 6개를 넘지 않는다.
- 이슈 생성은 issue-create, 착수는 issue-start, PR 생성은 issue-end, 병합은 issue-merge가 맡는다.

## 실행

```bash
node <skill>/scripts/issue-onboard.mjs
node <skill>/scripts/issue-onboard.mjs --all
node <skill>/scripts/issue-onboard.mjs sync --state all
```

## 보고 형식

```text
그래프       <상대 또는 절대 HTML 경로>
이미지       <상대 또는 절대 webp 경로 | unavailable>
우선순위     #<번호> <제목> (최대 6개)
더 보기      /issue-onboard --all
다음 행동    /issue-start #N | /issue-merge | /issue-create
```
