## 작업 요약

private 저장소 증거 이미지를 이슈 코멘트에 넣을 때, `gh-attach` 확장으로 자동 업로드를 먼저
시도하고 실패한 이미지만 기존 수동 웹 UI 업로드로 폴백하도록 issue-* 스킬과 `gh-setup` 을
바꿨다. 실패해도 브라우저 자동화로 우회하지 않는다. 이어서 브라우저가 없는 헤드리스 서버
(Ubuntu server 등)를 위한 `GH_ATTACH_SESSION_TOKEN` 대안과 배치 가이드도 추가했다.

## 왜 캡처 대신 텍스트 증거인가

이 변경은 CLI 스킬(`tools/issue-tracker.mjs`, `gh-setup` 스크립트, 관련 레퍼런스 문서)의 내부
로직만 바꾸고 UI 화면이나 성능 지표를 다루지 않는다(작업 성격 판정: `neither`). 그래서
전후 스크린샷·벤치마크가 성립하지 않아 아래 실행 로그를 증거로 남긴다.

## 검증 로그

`verification.txt` 전문:

```text
=== node --check ===
OK
OK
OK

=== python -m py_compile ===
OK

=== sh -n ===
OK

=== sync-shared drift check ===
sync-shared: 정본과 모든 사본이 동일하다

=== .claude vs .codex gh-setup diff (agents/, __pycache__ 제외 동일해야 함) ===
Only in .codex/skills/gh-setup: agents

=== gh attach 확장 설치 확인 ===
gh attach	sudosubin/gh-attach	v0.4.2

=== private 저장소(Mineru98/screen-cleaner) 업로드 시도 (gh-attach 확장, 실제 호출) ===
{
  "ok": false,
  "reason": "failed to resolve usable cookie source from 18 attempt(s)"
}

→ 로그인된 브라우저 쿠키가 없는 이 환경에서는 예외 없이 graceful fallback(ok:false + reason) 확인.

=== 추가 검증 (2b1bf17, e5c00c6) ===

--- gh-setup status: gh-attach + 세션 토큰 감지 (값은 절대 안 찍힘) ---
  gh        : 설치됨 (2.92.0)
  로그인     : 됨 (Mineru98)
  gh-attach  : 설치됨
  세션 토큰  : 없음 (브라우저 쿠키로 대체 시도)

GH_ATTACH_SESSION_TOKEN_SET=0

--- GH_ATTACH_SESSION_TOKEN 이 flag 없이 자동으로 읽히는지 실측 ---
가짜 값으로 시도 → 브라우저 쿠키 탐색을 건너뛰고 그 값으로 바로 요청이 감:
HTTP 404 (https://github.com/upload/policies/assets)

→ 코드 변경(gitHost.uploadAttachment()) 없이 서버 환경변수만으로 헤드리스 업로드 경로가 동작함을 확인.

--- node/python/sh 문법 재검사 (2b1bf17, e5c00c6 반영 후) ---
OK
OK
OK
OK
sync-shared: 정본과 모든 사본이 동일하다
Only in .codex/skills/gh-setup: agents
```

## 실제 브라우저 로그인 환경 확인 (별도 코멘트)

로그인된 브라우저가 있는 이 사용자의 실제 데스크톱 환경에서 `gh attach upload` 를 4회 연속
재시도해 전부 성공을 확인했다. macOS 가 Chrome 의 쿠키 저장소 접근을 몇 차례 다시 물었으나
"항상 허용" 이후로는 팝업 없이 조용히 성공했다. 자세한 로그는
[후속 확인 코멘트](https://github.com/Mineru98/skills-store/issues/59#issuecomment-5250687711)에
남겨 뒀다.

## 변경 파일

- `tools/issue-tracker.mjs`(정본) — `gitHost.hasAttachExtension()` / `uploadAttachment()` 추가,
  `evidenceUrls()` 를 private 저장소 자동 업로드 우선으로 변경. `sync-shared.sh` 로 4개 스킬에 전파.
- `issue-start/references/evidence-capture.md`, `issue-end/references/report-and-pr.md`,
  `issue-start/SKILL.md` — 자동 업로드 우선 흐름, 실패 시 이미지 단위 폴백, 브라우저 자동화
  금지 규칙 반영.
- `gh-setup/scripts/gh-env.mjs`, `gh_env.py`, `gh-env.sh`, `gh-env.ps1` — `gh-attach` 확장 자동
  설치 + `GH_ATTACH_SESSION_TOKEN` 존재 여부 확인(값은 절대 미출력). `SKILL.md`,
  `references/install-matrix.md` 갱신(헤드리스 서버 대안, 쉘 프로파일/`.env` 배치 가이드,
  다중 사용자 서버 주의사항, 세션 만료 신호 판단법 포함).

## 검증

- node --check / python -m py_compile / sh -n 문법 검사 통과 (초기 구현 + 후속 커밋 2회 모두)
- `sync-shared.sh --check` 로 정본·사본 드리프트 없음 확인
- `.claude`/`.codex` gh-setup 트리 diff 동일(agents/ 제외) 확인
- 쿠키 없는 환경에서 graceful fallback 확인, `GH_ATTACH_SESSION_TOKEN` 이 flag 없이 자동으로
  읽혀 코드 변경 없이 헤드리스 경로가 동작함을 실측
- 로그인된 브라우저가 있는 실제 환경에서 자동 업로드 4회 연속 성공 확인

## 남은 이슈

- 로컬에 github.com 로그인 브라우저도 없고 `GH_ATTACH_SESSION_TOKEN` 도 없는 순수 헤드리스
  환경에서는 여전히 수동 업로드로 폴백된다. 의도된 동작이다.
- `GH_ATTACH_SESSION_TOKEN` 실측은 가짜 값으로 인증 실패 경로만 확인했다. 실제 유효한 세션
  토큰으로 헤드리스 업로드 성공까지 확인하려면 진짜 쿠키 값이 필요해 이번 검증 범위에서는
  하지 않았다.
