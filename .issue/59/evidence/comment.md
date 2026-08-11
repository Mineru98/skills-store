## 작업 요약

private 저장소 증거 이미지를 이슈 코멘트에 넣을 때, `gh-attach` 확장으로 자동 업로드를 먼저
시도하고 실패한 이미지만 기존 수동 웹 UI 업로드로 폴백하도록 issue-* 스킬과 `gh-setup` 을
바꿨다. 실패해도 브라우저 자동화로 우회하지 않는다.

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
```

## 변경 파일

- `tools/issue-tracker.mjs`(정본) — `gitHost.hasAttachExtension()` / `uploadAttachment()` 추가,
  `evidenceUrls()` 를 private 저장소 자동 업로드 우선으로 변경. `sync-shared.sh` 로 4개 스킬에 전파.
- `issue-start/references/evidence-capture.md`, `issue-end/references/report-and-pr.md`,
  `issue-start/SKILL.md` — 자동 업로드 우선 흐름, 실패 시 이미지 단위 폴백, 브라우저 자동화
  금지 규칙 반영.
- `gh-setup/scripts/gh-env.mjs`, `gh_env.py`, `gh-env.sh`, `gh-env.ps1` — `gh-attach` 확장 자동
  설치. `SKILL.md`, `references/install-matrix.md` 갱신.

## 검증

- node --check / python -m py_compile / sh -n 문법 검사 통과
- `sync-shared.sh --check` 로 정본·사본 드리프트 없음 확인
- `.claude`/`.codex` gh-setup 트리 diff 동일(agents/ 제외) 확인
- private 테스트 저장소에 실제 `gh attach upload` 호출 → 쿠키 없는 환경에서 예외 없는
  graceful fallback 확인

## 남은 이슈

- 로컬에 github.com 로그인 브라우저가 없는 순수 헤드리스 환경에서는 여전히 수동 업로드로
  폴백된다(이 환경이 그 예). 사용자 데스크톱처럼 브라우저 로그인이 있는 환경에서 자동
  업로드가 실제로 성공하는지는 별도로 확인이 필요하다.
