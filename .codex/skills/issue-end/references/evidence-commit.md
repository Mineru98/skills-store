# 증거 커밋과 렌더링 URL

## 왜 이 절차가 필요한가

이슈 코멘트의 이미지는 저장소 안의 실제 파일을 raw URL 로 가리켜야 렌더링된다. 그런데

1. 스크린샷은 프로젝트 `.gitignore` 의 `*.png`, `screenshots/`, `*.webp` 같은 규칙에 걸려 커밋되지 않는 경우가 많다.
2. 작업 브랜치 기준 URL 은 브랜치가 삭제되면 깨진다. merge 후 브랜치 삭제가 기본인 저장소에서는 거의 항상 깨진다.

그래서 **gitignore 예외 + 강제 add** 로 1번을, **작업 브랜치와 기본 브랜치 이중 커밋** 으로 2번을 막는다.
코멘트에는 두 URL 을 모두 넣어 둘 중 하나는 항상 살아 있게 한다.

## 1. 디렉터리와 gitignore 예외

```bash
node <skill>/scripts/issue-end.mjs init --issue 59
```

- `.issue-evidence/59/before/`, `.issue-evidence/59/after/` 생성
- 프로젝트 `.gitignore` 끝에 예외 규칙 추가 (이미 있으면 건너뜀)

```gitignore
# issue-end evidence (must stay committed so issue comments render)
!.issue-evidence/
!.issue-evidence/**
```

부모 디렉터리 자체가 무시되면 하위 negation 이 먹지 않는 git 규칙 때문에, 예외 규칙은 **파일 끝에** 붙인다.
그래도 안 걸리는 케이스가 있어 커밋은 항상 `-f` 로 한다.

인증 파일이 섞이지 않도록 아래도 함께 확인한다.

```gitignore
.issue-evidence/**/.auth.json
```

## 2. 작업 브랜치 커밋

```bash
node <skill>/scripts/issue-end.mjs commit --issue 59
```

- `git add -f .issue-evidence/59 .gitignore` 후 커밋
- 커밋 메시지: `docs(issue-59): 작업 전후 증거 자료 추가`
- 스테이징된 변경이 없으면 커밋하지 않고 그 사실을 알린다

증거 커밋은 **구현 커밋과 분리한다**. 리뷰에서 diff 를 볼 때 바이너리가 섞이지 않게 하기 위해서다.

## 3. push (사용자 확인 필수)

```bash
git push -u origin <branch>
```

AskUserQuestion 으로 확인한 뒤에만 실행한다. 원격에 올라가야 raw URL 이 살아난다.
push 하지 않기로 하면 이미지 URL 을 코멘트에 넣을 수 없다는 점을 알리고, 이미지 없이 텍스트 증거만 코멘트한다.

## 4. 기본 브랜치 미러 (사용자 확인 필수)

```bash
node <skill>/scripts/issue-end.mjs mirror --issue 59 --push
```

동작:

1. `origin/<base>` 에서 임시 워크트리를 만든다 (현재 작업 트리는 건드리지 않는다)
2. 증거 파일만 복사하고 gitignore 예외를 적용해 커밋한다
3. `HEAD:<base>` 로 push 를 시도한다
4. 브랜치 보호 등으로 거부되면 `evidence/issue-59` 브랜치로 폴백 push 한다
5. 임시 워크트리와 임시 브랜치를 지운다

출력의 `mirrorRef` 가 코멘트에 넣을 두 번째 기준이다. `fallback: true` 면 evidence 브랜치가 쓰인 것이고,
이 브랜치는 **삭제하지 않는다**. 정리 단계에서도 제외한다.

기본 브랜치에 직접 push 하는 동작이므로 반드시 사전 확인을 받는다. 질문에는
"기본 브랜치에 증거 파일만 담긴 커밋 1개가 추가됩니다" 를 명시한다.
거부하면 `--push` 없이 실행해 로컬 커밋만 만들거나, 미러를 건너뛰고 브랜치 URL 만 사용한다.

## 5. URL 생성

```bash
node <skill>/scripts/issue-end.mjs urls --issue 59 --mirrorRef evidence/issue-59
```

출력 형식:

```json
{
  "images": [
    {
      "path": ".issue-evidence/59/after/orders-list.webp",
      "phase": "after",
      "branchUrl": "https://raw.githubusercontent.com/<owner>/<repo>/fix/59-tab/....webp",
      "mirrorUrl": "https://raw.githubusercontent.com/<owner>/<repo>/main/....webp"
    }
  ]
}
```

코멘트에는 `branchUrl` 을 `<img>` 로, `mirrorUrl` 을 텍스트 링크로 넣는다.
브랜치가 지워져 이미지가 깨져도 아래 링크는 살아 있다.

```markdown
| Before | After |
| --- | --- |
| <img src="<before branchUrl>" width="420"> | <img src="<after branchUrl>" width="420"> |

<sub>이미지가 보이지 않으면: [before](<before mirrorUrl>) · [after](<after mirrorUrl>)</sub>
```

## 6. private 저장소

`urls` 출력의 `isPrivate: true` 면 raw URL 은 코멘트에서 렌더링되지 않는다(GitHub 이미지 프록시가 인증 없이 접근).
이때는 순서를 바꾼다.

1. 이미지 파일 경로를 사용자에게 알리고 이슈 코멘트 편집창에 직접 드래그해 업로드하도록 안내
2. 업로드된 `user-attachments` URL 을 받아 코멘트 본문에 넣는다
3. raw URL 은 보조 링크로만 남긴다

커밋 자체는 그대로 한다. 저장소 안에 증거가 남는 것이 목적이기도 하다.

## 7. 용량

- webp 각 500KB 이하, 총 5MB 이하를 목표로 한다
- 초과하면 `--quality 70`, `--width` 축소, 불필요한 캡처 제거로 줄인다
- 동영상은 커밋하지 않는다. 필요하면 이슈에 직접 업로드한다
