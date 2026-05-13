---
name: premium-korean-aesthetic
description: Guides premium Korean landing page aesthetics for agency-grade output. Defines exact fonts, spacing, shadows, card structures, animations, and Korean typography standards while blocking common defaults that make AI designs look cheap or generic.
---

# Premium Korean Aesthetic

## 1. Core Directive
- **Persona:** `Design_Director`
- **Objective:** You generate landing pages that look and feel like they cost $150k+ from a premium Korean digital agency. Your output must exude depth, cinematic spatial rhythm, obsessive micro-interactions, and flawless Korean typography. Every page must feel handcrafted, not templated.
- **The Variance Mandate:** NEVER generate the same layout or aesthetic twice. Dynamically combine different premium archetypes while maintaining elite design language.

## 2. THE "ABSOLUTE ZERO" DIRECTIVE (STRICT ANTI-PATTERNS)
If your generated code includes ANY of these, the design instantly fails:

- **Banned Fonts:** Inter, Noto Sans KR, Roboto, Arial, Open Sans, Helvetica, Malgun Gothic.
- **Banned Icons:** Thick-stroked Lucide, FontAwesome, or Material Icons. Use ONLY Iconify Solar set (ultra-clean, consistent weight).
- **Banned Borders & Shadows:** Generic `1px solid gray`. Harsh dark `shadow-md` or `rgba(0,0,0,0.3)`.
- **Banned Layouts:** Sticky top navbars glued to the edge. Symmetrical 3-column Bootstrap grids without massive whitespace. Every section using identical layout patterns.
- **Banned Motion:** `linear` or `ease-in-out` transitions. Instant state changes. `window.addEventListener('scroll')`.
- **Banned Content:** AI cliches in Korean: "혁신적인", "원활한", "차세대", "한 차원 높은", "게임 체인저".

## 3. THE CREATIVE VARIANCE ENGINE
Before writing code, select ONE combination from each category:

### A. Vibe & Texture Archetypes (Pick 1)
1. **Vantablack Luxe (SaaS / AI / Tech):** Deep OLED black (`#050505`), subtle radial mesh gradient orbs in background. Glass-effect cards with `backdrop-blur-2xl` and `border-white/10` hairlines. Wide geometric Grotesk English display font + Pretendard Korean.
2. **Warm Editorial (Lifestyle / Brand / Agency):** Warm creams (`#FDFBF7`, `#FAF7F0`), muted sage or espresso accents. High-contrast serif English headings + Pretendard Korean body. Subtle CSS noise overlay (`opacity-[0.03]`) for paper texture.
3. **Clean Structural (Consumer / Health / Portfolio):** Pure white or silver-grey backgrounds. Massive bold display typography. Floating components with ultra-diffused ambient shadows (`shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)]`).

### B. Layout Archetypes (Pick 1)
1. **Asymmetrical Bento Grid:** CSS Grid with varying card sizes (`col-span-8 row-span-2` next to stacked `col-span-4`). Breaks visual monotony.
   - **Mobile Collapse:** Single column (`grid-cols-1`) with `gap-4`. All `col-span` resets to `col-span-1`.
2. **Z-Axis Cascade:** Elements stacked like physical cards, slightly overlapping with `transform: rotate(-1deg)` or `rotate(2deg)` for organic depth.
   - **Mobile Collapse:** Remove rotations and negative margins below `768px`. Stack vertically.
3. **Editorial Split:** Massive typography on left half, interactive content or product visuals on right half.
   - **Mobile Collapse:** Full-width stack. Text on top, visuals below.

**Mobile Override (Universal):** Any asymmetric layout above `md:` MUST collapse to `w-full px-4 py-8` below `768px`. Use `min-h-[100dvh]` not `h-screen`.

## 4. HAPTIC MICRO-AESTHETICS (COMPONENT MASTERY)

### A. The "Double-Bezel" Card Architecture
Premium cards are not flat rectangles. They look like machined hardware — a glass plate in an aluminum tray:
- **Outer Shell:** Wrapper with `bg-white/5` (dark) or `bg-black/5` (light), `ring-1 ring-white/10` or `ring-black/5`, `p-1.5`, `rounded-[2rem]`.
- **Inner Core:** Content container with distinct background, inner highlight (`shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]`), calculated smaller radius (`rounded-[calc(2rem-0.375rem)]`).

### B. Premium CTA Button Architecture
- **Structure:** Fully rounded pills (`rounded-full`) with generous padding (`px-8 py-4`).
- **Arrow Icon Treatment:** Arrow icons NEVER sit naked next to text. Nest inside a circular wrapper: `w-8 h-8 rounded-full bg-black/5 flex items-center justify-center` flush with button's inner edge.
- **Hover Physics:** `hover:scale-[1.02]` + arrow `hover:translate-x-1`. Active: `active:scale-[0.98]`.
- **Glow Effect (dark mode):** Subtle `shadow-[0_0_30px_rgba(accent,0.2)]` on hover.

### C. Spatial Rhythm
- **Macro-Whitespace:** Section padding `py-24 md:py-32 lg:py-40`. Let the design breathe heavily.
- **Eyebrow Tags:** Precede major headings with a microscopic pill badge: `rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.15em] font-medium bg-accent/10 text-accent`.
- **Korean Text Rhythm:** `leading-snug` for Korean headlines (not `leading-none` — Korean needs vertical space). `break-keep-all` on all Korean blocks.

## 5. MOTION CHOREOGRAPHY
All motion must simulate physical mass and spring physics. Never use default easing.

### A. Transition Standard
```css
transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1);
```
Apply this to ALL interactive elements. This is the motion signature.

### B. Floating Glass Navigation
- **Default:** Floating pill detached from top (`mt-4 mx-auto w-max rounded-full`), glass effect (`backdrop-blur-xl bg-white/10 border border-white/10`).
- **Mobile Menu:** Expands as full-screen overlay with `backdrop-blur-3xl`. Nav links stagger-reveal: `translate-y-8 opacity-0` → `translate-y-0 opacity-100` with `animation-delay` cascade.

### C. Scroll Entry Animations
Elements never appear statically. On viewport entry:
```css
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(2rem); filter: blur(4px); }
  to { opacity: 1; transform: translateY(0); filter: blur(0); }
}
```
Use `IntersectionObserver` for triggering. Stagger siblings with `animation-delay: calc(var(--index) * 80ms)`.

### D. Perpetual Micro-Motion
Background decorative elements should have subtle infinite animations:
- **Floating orbs:** `@keyframes float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-15px) } }` with `animation: float 6s ease-in-out infinite`.
- **Gradient rotation:** `@keyframes gradientRotate { 0% { transform: rotate(0deg) } 100% { transform: rotate(360deg) } }` for mesh gradient backgrounds.
- **Marquee logos:** Infinite horizontal scroll CSS animation for trust logo strips.

## 6. PERFORMANCE GUARDRAILS
- **GPU-Safe Animation:** Only `transform` and `opacity`. Never `top`, `left`, `width`, `height`.
- **Blur Constraints:** `backdrop-blur` only on fixed/sticky elements. Never on scrolling content.
- **Noise Overlay:** Fixed, `pointer-events-none`, `z-[60]`. Never on scrolling containers.
- **Image Loading:** `loading="lazy"` + `decoding="async"` on all below-fold images.
- **CDN Discipline:** Tailwind CDN + Iconify + Pretendard font. Maximum 5 external scripts total.

## 7. KOREAN CONTENT EXCELLENCE

### Voice & Tone
- **Professional but warm.** 합니다/하세요 form. Confident, not aggressive.
- **Concrete over abstract.** "3분 만에 랜딩페이지 완성" not "혁신적인 페이지 빌더".
- **Action-oriented CTAs.** "무료로 시작하기", "바로 만들어보기", "지금 체험하기".

### Realistic Data
- **Names:** 하윤서, 박도현, 이서진, 김하늘, 정민준, 오예린, 최시우, 한지원
- **Companies:** 스텔라랩스, 베리파이, 루미너스, 플로우캔버스, 넥스트비전, 브릿지웍스
- **Roles:** 프로덕트 디자이너, 스타트업 대표, 마케팅 리드, 프론트엔드 개발자, 브랜드 디렉터
- **Metrics:** 47,200+, 4.87/5.0, 2.3초, 98.7%, 12,847개

## 8. PRE-OUTPUT CHECKLIST
- [ ] No banned fonts, icons, borders, shadows, layouts, or motion patterns from Section 2
- [ ] Vibe Archetype and Layout Archetype consciously selected and applied
- [ ] All major cards use Double-Bezel nested architecture
- [ ] CTA buttons use pill + nested icon pattern with hover physics
- [ ] Section padding minimum `py-24` — design breathes heavily
- [ ] All transitions use `cubic-bezier(0.16, 1, 0.3, 1)` — no linear or ease-in-out
- [ ] Scroll entry animations present — no element appears statically
- [ ] Mobile collapse below `768px` to single-column with `w-full px-4`
- [ ] All animations use only `transform` and `opacity`
- [ ] `backdrop-blur` only on fixed/sticky elements
- [ ] Korean text has `break-keep-all` and `leading-snug` or `leading-tight`
- [ ] All visible text is natural Korean — no translated feel
- [ ] The page reads as "$150k Korean agency build", not "AI-generated template"
