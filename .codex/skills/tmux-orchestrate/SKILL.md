---
name: tmux-orchestrate
description: 같은 프로젝트에서 동시에 굴리고 있는 여러 tmux 세션의 상태를 한 번에 파악하고 필요한 지시를 각 세션으로 전파합니다. 세션 목록을 뽑아 pane 별로 병렬 수집·요약하고, 항상 같은 양식(상태표 + 세션 카드 + 교차 분석 + 전파 제안)으로 보고합니다. "세션 현황", "지금 어디까지 됐지", "다른 창들 뭐 하고 있어", "세션 점검", "전부 어떻게 돼가", "다른 세션에 알려줘", "전 세션에 전파", "/tmux-orchestrate" 요청에 씁니다. 워크트리라 경로가 달라도 같은 git 저장소면 한 프로젝트로 묶습니다. 새 tmux 세션을 만들거나 작업을 분배하는 일, 단일 세션 안에서의 구현 작업에는 쓰지 않습니다.
---

<skill>
  <purpose>
    여러 세션에 작업을 흩뿌려 놓았을 때 "어디까지 갔는지" 를 잃어버리는 문제를 푼다.
    각 세션 화면을 병렬로 걷어와 상태를 판정하고, 늘 같은 양식으로 보고하고,
    필요하면 판정 결과를 근거로 각 세션에 지시를 전파한다.
    구현은 하지 않는다. 관측하고, 판정하고, 전달한다.
  </purpose>

  <inputs>
    <arg name="$ARGUMENTS" optional="true">
      세션 이름 조각으로 대상을 좁힌다. 생략하면 같은 저장소의 모든 pane.
      "전파: &lt;문구&gt;" 형태면 수집·판정 후 전파까지 간다.
    </arg>
    <detected>현재 저장소의 git common-dir, 같은 common-dir 를 쓰는 모든 tmux pane</detected>
  </inputs>

  <preconditions>
    <item>`tmux -V` 성공. 실패하면 tmux 미설치로 보고하고 중단</item>
    <item>현재 디렉터리가 git 저장소. 아니면 `--scope all` 사용 여부를 사용자에게 확인</item>
    <item>Node 18+ (스크립트는 의존성 없는 .mjs)</item>
  </preconditions>

  <tools>
    <script path="scripts/tmux-capture.mjs">
      `list` 스코프 안의 pane 목록(JSON). `capture` 목록 + 각 pane 의 마지막 N 줄.
      pane 마다 session·target·paneId·cwd·branch·dirtyFiles·command·title·active·attached 를 붙인다.
      워크트리 판별은 git common-dir 로 하므로 경로가 달라도 같은 프로젝트로 묶인다.
    </script>
    <script path="scripts/tmux-send.mjs">
      `send --target &lt;t&gt; --message &lt;m&gt;` 한 pane 에. `broadcast --message &lt;m&gt;` 스코프 전체에.
      본문은 `send-keys -l` 로 리터럴 입력하고 Enter 는 지연 뒤 따로 보낸다.
      기본으로 개행을 공백으로 접는다 — 개행이 곧 제출인 TUI 에서 메시지가 잘려 나가는 것을 막기 위함.
    </script>
  </tools>

  <workflow>
    <step n="1" name="스코프 확정">
      `node scripts/tmux-capture.mjs list` 를 돌린다. $ARGUMENTS 에 세션 조각이 있으면 `--target` 으로 넘긴다.
      exit 2(pane 0 개) 면 "이 저장소에 붙은 tmux 세션이 없다" 고 한 줄로 보고하고 끝낸다.
      자기 자신 pane 은 기본으로 빠진다. 이 단계는 tail 을 읽지 않는다 — 목록만 보고 다음 단계 규모를 정한다.
    </step>

    <step n="2" name="병렬 수집·요약">
      pane 이 3개 미만이면 직접 `capture --lines 160` 을 돌려 읽는다.
      3개 이상이면 pane 당 서브에이전트 1개를 <b>한 번에</b> 띄운다. 각 서브에이전트에게 준다.
      - 실행할 명령: `node &lt;스킬경로&gt;/scripts/tmux-capture.mjs capture --scope all --target &lt;paneId&gt; --lines 160`
      - 아래 <status-rules> 전문
      - 반환 스키마: <pane-report>
      tail 원문을 메인 컨텍스트로 끌어오지 않는다. 서브에이전트가 읽고 요약본만 돌려준다.
      필요하면 서브에이전트가 `--lines 400` 으로 한 번 더 파고들 수 있다고 알려 준다.
    </step>

    <step n="3" name="교차 분석">
      요약본을 모아 다음을 판정한다. 근거 없는 추측은 쓰지 않는다.
      - 같은 파일·같은 브랜치를 두 세션이 만지고 있는가 (dirtyFiles 와 요약의 대상 파일로)
      - 같은 일을 중복해서 하고 있는가
      - WAIT 인 세션이 있는가 — 사람이 막고 있는 것이므로 항상 최우선
      - ERROR 가 다른 세션의 전제를 깨는가
    </step>

    <step n="4" name="보고">
      <output-format> 를 <b>글자 그대로</b> 지킨다. 섹션 순서·라벨·상태 토큰을 바꾸지 않는다.
      매번 같은 모양이어야 훑어보는 비용이 0 에 수렴한다.
    </step>

    <step n="5" name="전파" optional="true">
      사용자가 전파를 요청했거나, 4단계에서 충돌·중복을 발견해 알릴 필요가 있을 때만 간다.
      1. 세션별 전송 문구를 <b>초안으로 먼저 보여주고</b> 승인받는다. 승인 없이 보내지 않는다.
      2. `--dry-run` 으로 대상과 본문을 확인한다.
      3. 승인되면 dry-run 을 뺀 같은 명령을 돌린다.
      4. 결과 JSON 의 `sent` 를 확인해 실패한 pane 을 그대로 보고한다.
      전 세션 동일 문구면 `broadcast`, 세션마다 다르면 `send` 를 세션 수만큼.
    </step>
  </workflow>

  <status-rules>
    tail 의 <b>마지막 화면</b>을 기준으로 아래 6개 중 하나로만 판정한다. 새 토큰을 만들지 않는다.

    WAIT   사람 입력에서 멈춰 있다. 권한 승인 프롬프트, 선택지 목록(`❯ 1.`, `Do you want`),
           질문으로 끝난 응답, 빈 입력창에 커서만 있고 직전이 질문인 경우.
    WORK   지금 돌고 있다. 스피너·경과시간 표시(`✻`, `esc to interrupt`, `Running`),
           도구 호출이 열린 채 끝남, 빌드·테스트 로그가 흐르는 중.
    DONE   마지막 응답이 완료 보고이고 더 시킬 것이 없어 대기 중.
    ERROR  실패로 끝났다. traceback, `error`/`failed`/`exit 1`, hook 차단, merge conflict.
    IDLE   쉘 프롬프트만 있고 에이전트가 떠 있지 않다.
    UNKNOWN 위 어디에도 확신이 안 선다. 억지로 배정하지 말고 이걸 쓴다.

    판정 근거는 반드시 tail 에서 인용한 한 줄로 남긴다. 인용할 줄이 없으면 UNKNOWN 이다.
  </status-rules>

  <pane-report>
    서브에이전트는 정확히 이 필드만 돌려준다. 산문 서술을 덧붙이지 않는다.
    ```json
    {
      "session": "omc-foo-main-20260101120000",
      "target": "omc-foo-main-20260101120000:0.0",
      "paneId": "%12",
      "branch": "feat/42-login",
      "dirtyFiles": 8,
      "agent": "claude|codex|shell|unknown",
      "status": "WAIT",
      "headline": "한 줄 요약 (40자 이내, 명사형)",
      "now": "지금 무엇을 하고 있는지 한 문장",
      "lastResult": "직전에 끝낸 일과 결과 한 문장",
      "blocker": "막고 있는 것 한 문장, 없으면 없음",
      "nextAction": "사람이 해야 할 다음 조치 한 문장",
      "touchedFiles": ["경로", "..."],
      "evidence": "판정 근거로 tail 에서 인용한 한 줄"
    }
    ```
  </pane-report>

  <output-format>
    아래 4개 섹션을 이 순서로만 낸다. 빈 섹션은 "없음" 한 줄로 남기고 생략하지 않는다.

    ```
    # 세션 현황 — {저장소명} · {N}개 · {HH:MM}

    STATUS  SESSION                   BRANCH            AGENT   HEADLINE
    ------  ------------------------  ----------------  ------  ------------------------------
    WAIT    omc-foo-main-2026…        feat/42-login     claude  로그인 리다이렉트 승인 대기
    WORK    omx-foo-main-1785…        fix/50-guard      codex   가드 테스트 재실행 중

    ## {세션 이름}
    - 지금     : {now}
    - 최근 결과 : {lastResult}
    - 막힌 것   : {blocker}
    - 다음 조치 : {nextAction}
    - 근거     : {evidence}

    ## 교차 분석
    - 충돌   : {같은 파일·브랜치를 만지는 세션 쌍, 없으면 없음}
    - 중복   : {같은 일을 하는 세션, 없으면 없음}
    - 우선순위 : {지금 사람이 손대야 할 세션 순서와 이유}

    ## 전파 제안
    - {세션} ← "{보낼 문구}"
    - 명령: node {스킬경로}/scripts/tmux-send.mjs send --target {paneId} --message "{문구}" --dry-run
    ```

    표는 고정폭 ASCII 로만 낸다. 마크다운 표를 쓰지 않는다.
    SESSION 열은 24자에서 자르고 `…` 를 붙인다. 세션 카드는 STATUS 표와 같은 순서로 나열한다.
    카드 5줄의 라벨과 순서를 바꾸지 않는다. 값이 없으면 "없음".
  </output-format>

  <rules>
    <item>승인 없이 어떤 pane 에도 메시지를 보내지 않는다. 전파는 항상 초안 → 승인 → dry-run → 실행.</item>
    <item>`--allow-outside` 는 사용자가 명시적으로 다른 프로젝트를 지목했을 때만 쓴다.</item>
    <item>tail 원문을 보고서에 붙여넣지 않는다. 인용은 근거 한 줄까지.</item>
    <item>상태를 추측으로 채우지 않는다. 근거 줄이 없으면 UNKNOWN 이다.</item>
    <item>다른 세션의 작업을 이 세션에서 대신 구현하지 않는다. 전파해서 그 세션이 하게 한다.</item>
    <item>broadcast 는 전 세션에 같은 문구가 맞을 때만. 세션마다 맥락이 다르면 send 를 나눠 쓴다.</item>
  </rules>

  <failure-modes>
    <item>`tmux -V` 실패 → tmux 미설치. 설치 안내 한 줄 후 중단.</item>
    <item>list exit 2 → 붙은 세션 없음. 한 줄 보고 후 종료. 세션을 새로 만들지 않는다.</item>
    <item>send 가 exit 2 → 대상 모호. 스크립트가 출력한 후보를 그대로 보여주고 paneId 로 다시 지정한다.</item>
    <item>send 가 exit 3 → 일부 전송 실패. 실패한 pane 을 숨기지 않고 그대로 보고한다.</item>
    <item>capture 결과가 비어 있음 → 그 pane 은 UNKNOWN. 다른 pane 보고를 막지 않는다.</item>
  </failure-modes>
</skill>
