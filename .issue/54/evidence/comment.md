## 작업 요약

private 저장소에서 증거 이미지 게시가 멈추던 데드락을 없앴습니다.
문서가 시키는 "보조 링크"를 검증기가 거부하던 모순을 고치고, 사람이 이미지를 올려야 하는 상황을 기계적으로 구분해 전용 단계로 분리했습니다.

## 근본 원인

GitHub 은 저장소 파일 자산 응답을 `Sec-Fetch-Site` 로 가릅니다.

- 주소창 접근 → 서명 토큰이 붙어 이미지가 열림
- 코멘트의 `<img>` 요청 → 토큰이 붙지 않아 항상 깨짐

`raw.githubusercontent.com`, `github.com/<owner>/<repo>/raw/...`, release 자산이 모두 같습니다.
**주소창에서 열린다는 사실은 렌더링 근거가 아닙니다.** private 저장소에서는 `user-attachments` 외에 인라인 방법이 없습니다.

실측은 `.issue/54/evidence/before/github-raw-http.txt` 에 있습니다.

## 변경 전후 (검증기 동작)

UI 변경이 아니라 검증 로직·프롬프트 변경이라 캡처 대신 실행 결과를 증거로 남깁니다.

```text
                                   before        after
classify github.com/o/r/raw/...    "page"        "raw"
private 보조 링크 통과              false         true
public github-raw 인라인 통과       false         true
private raw 인라인 통과             false         false   (의도된 차단)
needsManualUpload 필드              없음          true
```

- 변경 전: `.issue/54/evidence/before/validator-behavior.txt`
- 변경 후: `.issue/54/evidence/after/validator-behavior.txt`

`private raw 인라인` 이 여전히 막히는 것이 맞는 동작입니다. 달라진 점은 그 실패가 이제 `needsManualUpload` 로 표시되어 7.5단계로 이어진다는 것입니다.

## 변경 파일

- `tools/issue-media.mjs` — 보조 링크 예외, `github.com/<o>/<r>/raw/...` 를 `raw` 로 분류·다운로드 치환, `needsManualUpload`/`pendingUploads` 추가
- `tools/issue-tracker.mjs`, `tools/issue-common.mjs` — `evidenceUrls` 에 `renderMode`·`uploadUrl`·`inlineUrl`·`auxUrl`·`localPath` 추가
- `.claude/skills/issue-end/scripts/issue-end.mjs` — `report-check` exit 5/6 분리, 실패 메시지에 다음 행동 명시
- `.claude/skills/issue-start/scripts/issue-start.mjs` — 같은 종료 코드 규칙
- `.claude/skills/issue-end/SKILL.md`, `references/report-and-pr.md`, `references/context-triage.md` — 7.5단계(private 이미지 업로드) 신설·연결
- `.claude/skills/issue-start/SKILL.md`, `references/evidence-capture.md` — `inlineUrl` 기준으로 교체, "주소창에서 열린다 ≠ 렌더링된다" 명시
- `scripts/test-images.mjs` — 회귀 테스트 6건 추가
- `.codex/skills/...` — Claude 지침과 동일 내용 동기화

## 검증

`.issue/54/evidence/after/tests.txt`

- `test-images` / `test-common` / `test-tracker` / `test-docs` / `test-convention` 통과
- `test-flow` / `test-preflight` / `test-issue-create` 통과
- `check-shared` 통과 (정본·vendored 사본·codex 미러 일치)
- private 저장소(`Mineru98/flower-rag`)에서 `urls` 실행 → `renderMode: "manual-upload"`, `inlineUrl: null`, `uploadUrl`·`localPath` 정상 출력. 워킹트리는 원복

## 남은 이슈

private 저장소의 인라인 이미지는 여전히 사람이 한 번 드래그해야 합니다. GitHub 이 세션 쿠키 없이 접근 가능한 업로드 경로를 제공하지 않아 자동화가 불가능합니다. 이 제약을 숨기지 않고 7.5단계로 드러냈습니다.
