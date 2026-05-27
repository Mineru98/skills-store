#!/usr/bin/env bash
# slide-ko-verify — 한국어 슬라이드 번역체·구조 자동 검증
# Stage 1   번역체 11시그널 lint (regex)
# Stage 1.5 HTML 구조 lint (CSS / max-width)
# Stage 2   브라우저 렌더링 안내 (수동)
# Stage 3   입말 테스트 안내 (수동)
#
# usage: verify.sh <slide-file.html|.md>
# exit:  0=PASS, 1=WARN, 2=FAIL

set -u
export LC_ALL=en_US.UTF-8

FILE="${1:-}"
if [ -z "$FILE" ] || [ ! -f "$FILE" ]; then
  echo "usage: $0 <slide-file.html|.md>"
  exit 64
fi

# 색상
if [ -t 1 ]; then
  R=$'\033[31m'; Y=$'\033[33m'; G=$'\033[32m'; B=$'\033[34m'; D=$'\033[2m'; N=$'\033[0m'
else
  R=''; Y=''; G=''; B=''; D=''; N=''
fi

echo "${B}━━━ slide-ko-verify — $FILE ━━━${N}"

# ── Stage 1: 번역체 시그널 ──────────────────────────────
echo
echo "${B}[Stage 1] 번역체 11시그널 lint${N}"

TMP=$(mktemp); trap 'rm -f "$TMP"' EXIT
# HTML 태그·스크립트·스타일·주석·&nbsp; 제거 (정밀하진 않지만 충분)
sed -E '
  s|<script[^>]*>.*</script>||g
  s|<style[^>]*>.*</style>||g
  s|<!--.*-->||g
  s|<[^>]+>||g
  s|&nbsp;| |g
' "$FILE" > "$TMP"

SIGS=(
  "① 대명사(그것 류)|그것(이|을|은|만|도|마저)"
  "② 피동 되어지다|되어지(다|는|었)"
  "③ 의 ~의 체인|의 [가-힣]+의[ ,]"
  "④ ~의 경우|의 경우(에|는| )"
  "⑤ ~에 대하여|에 (대해|대하여|대한 )"
  "⑥ ~하고 있는 중|하고 있는 중"
  "⑦ ~을 가지다(have)|(을|를) 가지(고 있|는 것|는 사람)"
  "⑧ ~로부터(from)|로부터"
  "⑨ ~을 통해(through)|(을|를) 통해"
  "⑩ ~에 있어(in)|에 있어[서 ]"
  "⑪ ~기 전에(before)|기 전에[ ,.]"
)

TOTAL=0
for s in "${SIGS[@]}"; do
  L="${s%%|*}"; P="${s#*|}"
  C=$(grep -oE "$P" "$TMP" 2>/dev/null | wc -l | tr -d ' ')
  if [ "$C" -gt 0 ]; then
    echo "  ${Y}⚠${N}  $L — ${C}회"
    grep -nE "$P" "$FILE" 2>/dev/null | head -2 | sed "s|^|       ${D}line |; s|$|${N}|"
    TOTAL=$((TOTAL+C))
  fi
done

if [ "$TOTAL" -eq 0 ]; then
  echo "  ${G}✅ PASS — 시그널 0개${N}"; S1=0
elif [ "$TOTAL" -le 3 ]; then
  echo "  ${Y}⚠️  WARN — 시그널 ${TOTAL}개 (3개 이하)${N}"; S1=1
else
  echo "  ${R}❌ FAIL — 시그널 ${TOTAL}개 (3개 초과)${N}"; S1=2
fi

# ── Stage 1.5: HTML 구조 ──────────────────────────────
echo
echo "${B}[Stage 1.5] HTML 구조 lint${N}"

S15=0
case "$FILE" in
  *.html|*.htm)
    if grep -qE 'word-break:\s*keep-all' "$FILE"; then
      echo "  ${G}✓${N}  word-break: keep-all"
    else
      echo "  ${R}✗${N}  word-break: keep-all 없음 (한국어 어절 보호 필수)"
      S15=2
    fi
    if grep -qE 'text-wrap:\s*(balance|pretty)' "$FILE"; then
      echo "  ${G}✓${N}  text-wrap balance/pretty"
    else
      echo "  ${Y}~${N}  text-wrap 미적용 — 권장: balance (제목·짧은 본문)"
      [ "$S15" -lt 1 ] && S15=1
    fi
    NARROW=$(grep -oE 'max-width:\s*[12][0-9]ch|max-width:\s*3[0-5]ch' "$FILE" | wc -l | tr -d ' ')
    if [ "$NARROW" -gt 0 ]; then
      echo "  ${Y}~${N}  max-width ≤35ch ${NARROW}곳 — 자동 wrap 위험. <br /> 수동 박기 권장"
      [ "$S15" -lt 1 ] && S15=1
    fi
    NB=$(grep -oE 'class="nb"' "$FILE" | wc -l | tr -d ' ')
    echo "  ${D}(참고) <span class=\"nb\"> ${NB}곳 사용 — 인용구/고유명사 보호${N}"

    # 검사용 임시 파일: CSS 주석(/* */)과 HTML 주석(<!-- -->) 제거
    CLEAN=$(mktemp)
    trap 'rm -f "$TMP" "$CLEAN"' EXIT
    perl -0777 -pe 's|/\*.*?\*/||gs; s|<!--.*?-->||gs' "$FILE" > "$CLEAN"

    # FAIL: 목적격 ~을/를 + <br /> = 목적어/서술어 분리 (Korean에서 절대 금지)
    BAD_OBJ=$(grep -nE '(을|를)[ ]*<br' "$CLEAN" 2>/dev/null)
    if [ -n "$BAD_OBJ" ]; then
      BAD_CNT=$(echo "$BAD_OBJ" | wc -l | tr -d ' ')
      echo "  ${R}✗ FAIL${N}  ~을/를 + <br /> ${BAD_CNT}곳 — 목적어/서술어 분리"
      echo "$BAD_OBJ" | head -3 | sed "s|^|       ${D}line |; s|$|${N}|"
      S15=2
    fi

    # WARN: 주격/부사격 조사 + <br />. 은/는은 동사 어미(닫는, 본)와 헷갈리므로 제외.
    BAD_SUBJ=$(grep -nE '(이|가|와|과|에)[ ]*<br' "$CLEAN" 2>/dev/null)
    if [ -n "$BAD_SUBJ" ]; then
      BAD_CNT=$(echo "$BAD_SUBJ" | wc -l | tr -d ' ')
      echo "  ${Y}~ WARN${N}  ~이/가/와/과/에 + <br /> ${BAD_CNT}곳 — 주어·부사어 분리"
      echo "$BAD_SUBJ" | head -3 | sed "s|^|       ${D}line |; s|$|${N}|"
      [ "$S15" -lt 1 ] && S15=1
    fi

    # FAIL: 동사 수식형(~하는/한/할/된/될) + <br /> + 한글 = modifier ↔ head noun 분리
    BAD_MOD=$(grep -nE '(하는|한|할|된|될|는|은)[ ]*<br[^>]*>[ ]*[가-힣]' "$CLEAN" 2>/dev/null)
    if [ -n "$BAD_MOD" ]; then
      BAD_CNT=$(echo "$BAD_MOD" | wc -l | tr -d ' ')
      echo "  ${R}✗ FAIL${N}  동사 수식형 + <br /> + 명사 ${BAD_CNT}곳 — 수식어/피수식어 분리"
      echo "$BAD_MOD" | head -3 | sed "s|^|       ${D}line |; s|$|${N}|"
      S15=2
    fi

    # WARN: 무거운 인용 부호 + 짧은 명사 + 콤마 패턴 ("X"는 Y, 형태)
    BAD_QUOTE=$(grep -nE '"[가-힣]+"는 [가-힣]{1,4},' "$CLEAN" 2>/dev/null)
    if [ -n "$BAD_QUOTE" ]; then
      BAD_CNT=$(echo "$BAD_QUOTE" | wc -l | tr -d ' ')
      echo "  ${Y}~ WARN${N}  무거운 인용+명사 단편 ${BAD_CNT}곳 — 슬라이드에 무겁고 어색 ('X'는 Y, 구조)"
      echo "$BAD_QUOTE" | head -3 | sed "s|^|       ${D}line |; s|$|${N}|"
      [ "$S15" -lt 1 ] && S15=1
    fi

    # WARN: 추상 은유 동사 — 영어 관용어(close/ship/kill 등) 직역 의심
    BAD_META=$(grep -nE '(닫는다|닫는|태운다|태우는|죽인다|죽이는|던진다|던지는) [가-힣]+(다|단계|작업|기능|모듈|트랙|페이즈)' "$CLEAN" 2>/dev/null)
    if [ -n "$BAD_META" ]; then
      BAD_CNT=$(echo "$BAD_META" | wc -l | tr -d ' ')
      echo "  ${Y}~ WARN${N}  추상 은유 동사 ${BAD_CNT}곳 — 영어 관용어(close/ship/kill) 직역 의심"
      echo "$BAD_META" | head -3 | sed "s|^|       ${D}line |; s|$|${N}|"
      [ "$S15" -lt 1 ] && S15=1
    fi
    ;;
  *.md|*.markdown)
    echo "  ${D}(MD — HTML 구조 검사 생략)${N}"
    ;;
  *)
    echo "  ${D}(텍스트 — 구조 검사 생략)${N}"
    ;;
esac

[ "$S15" -eq 0 ] && echo "  ${G}✅ PASS${N}"
[ "$S15" -eq 1 ] && echo "  ${Y}⚠️  WARN${N}"
[ "$S15" -eq 2 ] && echo "  ${R}❌ FAIL${N}"

# ── Stage 2: 시각 검증 안내 ──────────────────────────────
echo
echo "${B}[Stage 2] 시각 검증 (수동)${N}"
case "$FILE" in
  *.html|*.htm)
    ABS=$(cd "$(dirname "$FILE")" 2>/dev/null && pwd)/$(basename "$FILE")
    echo "  열기:        ${B}open '$ABS'${N}"
    echo "  스크린샷:    ${B}npx playwright screenshot '$ABS' /tmp/slide.png --viewport-size=1280,720 --full-page${N}"
    echo "  ${D}체크: 의미 단위로 줄바꿈이 떨어지는지${N}"
    ;;
  *)
    echo "  ${D}(HTML 아님)${N}"
    ;;
esac

# ── Stage 3: 입말 테스트 안내 ────────────────────────────
echo
echo "${B}[Stage 3] 입말 테스트 (사람)${N}"
echo "  슬라이드 본문을 ${G}소리 내서${N} 읽으세요."
echo "  ${D}혀가 꼬이거나 호흡이 끊기면 그 문장 재작업${N}"

# ── Stage 4: LLM Fresh Review (Claude / Codex / Gemini CLI) ──────────────
echo
echo "${B}[Stage 4] LLM Fresh Review${N}"
echo "${D}-----------------------------------${N}"

# LLM CLI 자동 감지 — claude → codex → gemini 순. env LLM_CLI=claude|codex|gemini 로 override 가능.
LLM_CLI="${LLM_CLI:-}"
if [ -z "$LLM_CLI" ]; then
  if command -v claude >/dev/null 2>&1; then
    LLM_CLI="claude"
  elif command -v codex >/dev/null 2>&1; then
    LLM_CLI="codex"
  elif command -v gemini >/dev/null 2>&1; then
    LLM_CLI="gemini"
  fi
fi

if [ -n "$LLM_CLI" ]; then
  # 슬라이드 텍스트 추출 — 인라인 태그는 공백 없이 제거, 블록 태그는 줄바꿈으로
  # 주의: s 연산자 delimiter는 # 사용 (alternation의 | 와 충돌 방지)
  SLIDE_TEXT=$(perl -0777 -pe '
    s#<script[^>]*>.*?</script>##gs;
    s#<style[^>]*>.*?</style>##gs;
    s#<!--.*?-->##gs;
    s#</?(span|strong|em|b|i|code|a)[^>]*>##g;
    s#<br\s*/?>#\n#g;
    s#</?(p|div|li|h[1-6]|section|main|article)[^>]*>#\n#g;
    s#<[^>]+>##g;
    s#&nbsp;# #g;
    s#&amp;#\&#g;
    s#^[ \t]+##gm;
    s#[ \t]+$##gm;
    s#\n{2,}#\n#g;
    s#[ \t]+# #g;
  ' "$FILE")

  PROMPT="당신은 엄격한 한국어 카피라이터입니다. 이 슬라이드는 이미 여러 번 다듬어진 상태일 수 있습니다.
**기본 응답은 PASS입니다.** 명백한 영어 직역체만 [BLOCKING]으로 보고하세요.

[절대 지적하지 말 것]
- 단어 선택 취향 ('X도 자연스럽지만 Y가 낫다' 류)
- 동의어 추천 / 어순 미세 조정 / 띄어쓰기 / 오타
- 슬라이드 명사구 enumeration ('A, B, C.')
- 영어 약어 (verifier, AC, replay, fat-harness, ledger, run, auto, OS surface 등)
- 직전 iteration에서 적용했을 만한 수정의 역방향

[BLOCKING으로 보고할 것 — 이게 있을 때만]
- 영어 전치사 직역체 ('X를 통해 Y를 한다' 류)
- 이중 피동 ('~되어진다')
- 영어 대명사 + be동사 직역 ('그것은 ~이다')
- 영어 관용어 그대로 직역 (close/ship/kill/live → 닫다/태우다/죽이다/살아있다 식)
- 한국어 화자가 명백히 '이건 번역이네' 라고 단언할 표현

[리포트 형식]
- BLOCKING 있을 때만:
  [BLOCKING] \"문제 텍스트\" → \"수정안\" (한 줄 이유)
- BLOCKING 없으면 'PASS — 자연스러움' 한 줄만 출력. 끝.

의심스러우면 무조건 PASS. 취향 차이는 BLOCKING 아닙니다.

[슬라이드 텍스트]
${SLIDE_TEXT}"

  echo "  ${D}LLM CLI 호출 중 ($LLM_CLI, ~10초)...${N}"
  case "$LLM_CLI" in
    claude)
      # Anthropic Claude Code CLI
      REVIEW=$(claude --print --effort low "$PROMPT" 2>&1 | tail -80)
      ;;
    codex)
      # OpenAI Codex CLI — non-interactive exec mode
      REVIEW=$(codex exec --skip-git-repo-check "$PROMPT" 2>&1 | tail -80)
      ;;
    gemini)
      # Google Gemini CLI — non-interactive
      REVIEW=$(echo "$PROMPT" | gemini --non-interactive 2>&1 | tail -80)
      ;;
    *)
      REVIEW="(지원하지 않는 LLM_CLI: $LLM_CLI)"
      ;;
  esac

  if [ -n "$REVIEW" ]; then
    echo "$REVIEW" | sed "s|^|  |"
    if echo "$REVIEW" | grep -qE "^[ ]*PASS"; then
      echo
      echo "  ${G}✅ Stage 4 PASS${N}"
    else
      echo
      echo "  ${Y}⚠️  Stage 4 — LLM이 검토 항목 발견${N}"
      [ "$S15" -lt 1 ] && S15=1
    fi
  else
    echo "  ${R}✗ $LLM_CLI 응답 없음${N}"
  fi
else
  echo "  ${D}LLM CLI 없음 (claude/codex/gemini 중 하나 설치) — Stage 4 건너뜀${N}"
fi

# ── 종합 판정 ──────────────────────────────────────────
echo
if [ "$S1" -eq 0 ] && [ "$S15" -eq 0 ]; then
  echo "${G}━━━ 종합: PASS — Stage 2/3 사람이 확인 ━━━${N}"
  exit 0
elif [ "$S1" -lt 2 ] && [ "$S15" -lt 2 ]; then
  echo "${Y}━━━ 종합: WARN — 점검 권장 ━━━${N}"
  exit 1
else
  echo "${R}━━━ 종합: FAIL — 재작업 필요 ━━━${N}"
  exit 2
fi
