---
name: landing-page-builder
description: Builds premium, conversion-optimized landing pages as standalone HTML using Tailwind CSS CDN. Overrides generic template bias with metric-based design rules, Korean typography standards, and hardware-accelerated motion.
---

# Landing Page Builder

## 1. ACTIVE BASELINE CONFIGURATION
* DESIGN_VARIANCE: 8 (1=Perfect Symmetry, 10=Artsy Chaos)
* MOTION_INTENSITY: 6 (1=Static/No movement, 10=Cinematic/Magic Physics)
* VISUAL_DENSITY: 3 (1=Art Gallery/Airy, 10=Pilot Cockpit/Packed Data)
* LANDING_PURPOSE: conversion (conversion | brand | portfolio | saas | ecommerce)

**AI Instruction:** The standard baseline for all generations is strictly set to these values (8, 6, 3, conversion). Do not ask the user to edit this file. ALWAYS listen to the user: adapt these values dynamically based on what they explicitly request in their prompts. Use these baseline (or user-overridden) values as your global variables to drive the specific logic in Sections 3 through 8.

## 2. DEFAULT ARCHITECTURE & CONVENTIONS
All output is **standalone HTML** designed for direct browser rendering. No build tools, no bundlers, no frameworks.

* **Output Format:** Single HTML file with all styles and scripts inline. The page must work by simply opening the file in a browser.
* **Styling:** Tailwind CSS via CDN (`<script src="https://cdn.tailwindcss.com"></script>`). Use the `tailwind.config` script block for custom theme extensions (colors, fonts, spacing).
* **Typography — Korean First:**
  * **Primary Font:** `Pretendard` via CDN (`https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.min.css`). This is NON-NEGOTIABLE for Korean text rendering.
  * **English Display Font:** Pair with `Geist`, `Outfit`, `Cabinet Grotesk`, or `Satoshi` for English headlines. Load via Google Fonts CDN or self-hosted link.
  * **Font Stack:** `font-family: 'Pretendard', 'Geist', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;`
* **Icons:** Use Iconify with Solar icon set exclusively. Load via `<script src="https://code.iconify.design/iconify-icon/2.3.0/iconify-icon.min.js"></script>`. Usage: `<iconify-icon icon="solar:arrow-right-linear"></iconify-icon>`.
* **Images:** Use `https://picsum.photos/seed/{descriptive_name}/{width}/{height}` for all placeholder images. NEVER use Unsplash URLs (they break). For avatars, use `https://i.pravatar.cc/150?u={unique_name}`.
* **Animation Library:** For `MOTION_INTENSITY > 5`, include `<script src="https://unpkg.com/motion@latest/dist/motion.js"></script>` (Motion One — lightweight, standalone). For simpler animations, use pure CSS `@keyframes` and Tailwind's `animate-` utilities.
* **ANTI-EMOJI POLICY [CRITICAL]:** NEVER use emojis in markup or visible text content. Replace with Iconify Solar icons or clean SVG primitives.
* **Responsiveness:**
  * Standardize breakpoints (`sm:`, `md:`, `lg:`, `xl:`).
  * Contain page layouts using `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`.
  * **Viewport Stability [CRITICAL]:** NEVER use `h-screen`. ALWAYS use `min-h-[100dvh]` to prevent layout jumping on iOS Safari.
  * **Grid over Flex-Math:** Use CSS Grid (`grid grid-cols-1 md:grid-cols-3 gap-6`) instead of complex flexbox percentage calculations.
* **Language:** Default content language is **Korean**. All placeholder text, headings, descriptions, and CTAs must be written in natural, professional Korean — not translated-sounding text.

## 3. DESIGN ENGINEERING DIRECTIVES (Bias Correction)
LLMs have statistical biases toward specific UI cliches. These rules produce premium landing pages:

**Rule 1: Deterministic Typography**
* **Korean Headlines:** `text-4xl md:text-5xl lg:text-6xl tracking-tight leading-tight font-bold`. Pretendard handles Korean beautifully at these sizes.
  * **CRITICAL:** Korean text requires `leading-tight` to `leading-snug` (NOT `leading-none`). Korean characters need more vertical breathing room than Latin text.
  * **Word Breaking:** Always add `word-break: keep-all` (`break-keep-all` in Tailwind) to Korean text blocks to prevent mid-word line breaks.
* **English Display Text:** Use `tracking-tighter leading-none` for maximum impact with Latin fonts.
* **Body/Paragraphs:** `text-base md:text-lg text-gray-600 leading-relaxed max-w-[65ch]`.
* **ANTI-SLOP FONTS:** `Inter` is BANNED. `Noto Sans KR` is BANNED (use Pretendard instead — it's the modern Korean standard). `Roboto`, `Arial`, `Open Sans` are all BANNED.

**Rule 2: Color Calibration**
* **Constraint:** Max 1 Accent Color per page. Saturation < 80%.
* **THE LILA BAN:** Purple/Blue "AI" gradients are strictly BANNED. No neon glows, no purple button effects.
* **Palette Philosophy:** Use deep neutral bases (Zinc-900, Slate-950, Stone-100) with ONE high-contrast accent (Emerald, Electric Blue, Warm Amber, or Deep Rose).
* **COLOR CONSISTENCY:** One palette for the entire page. Never mix warm and cool grays.
* **Dark Mode Default:** Landing pages look more premium in dark mode. Default to dark backgrounds (`bg-zinc-950`, `bg-slate-950`) unless the content demands light.

**Rule 3: Landing Page Layout Diversification**
* **ANTI-CENTER BIAS:** When `DESIGN_VARIANCE > 4`, centered Hero sections are BANNED. Use:
  * **Split Screen** (50/50 text + visual)
  * **Left-aligned content / Right-aligned asset**
  * **Asymmetric white-space** with dramatic negative space
  * **Full-bleed image with overlaid text**
* **Section Flow:** A landing page is NOT a stack of identical sections. Vary each section's layout dramatically:
  * Hero → Features (Bento Grid) → Social Proof (Testimonial Masonry) → CTA (Full-bleed)
  * Every adjacent section must use a DIFFERENT layout pattern.

**Rule 4: Materiality and Depth**
* Use cards ONLY when elevation communicates hierarchy. When shadows are needed, tint them to the background hue.
* **Glass Effects:** Go beyond `backdrop-blur`. Add `border border-white/10` and `shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]` for physical edge refraction.
* **Grain Texture:** Add a subtle noise overlay via fixed `pointer-events-none` pseudo-element for organic, non-digital feel.

**Rule 5: Conversion-Driven UI States**
* **CTA Buttons:** Must have hover (`scale-[1.02]`), active (`scale-[0.98]`), and focus states. Minimum size `px-8 py-4 text-lg`.
* **Social Proof:** Numbers must feel organic (`47,200+` not `50,000+`). Use real-sounding Korean names and companies.
* **Trust Signals:** Include at least one of: client logos, testimonial quotes, metrics bar, press mentions.
* **Urgency Elements (if conversion):** Subtle countdown, limited spots indicator, or "currently viewing" social proof.

**Rule 6: Korean Content Standards**
* **NO Translated Korean:** Write native, natural Korean. "지금 시작하세요" not "시작을 하세요 지금".
* **Honorifics:** Use 합니다/하세요 form consistently. Never mix 반말 and 존댓말.
* **CTA Copy:** Direct, action-oriented: "무료로 시작하기", "3분만에 만들어보기", "지금 바로 체험하기"
* **Avoid Korean AI Cliches:** "혁신적인", "획기적인", "차세대" are BANNED. Use concrete, specific language.

## 4. CREATIVE PROACTIVITY (Anti-Generic Implementation)
Systematically implement these high-end patterns as your baseline:

* **"Liquid Glass" Refraction:** Beyond `backdrop-blur-xl`. Layer `border border-white/10`, `shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]`, and a subtle `bg-white/5` for true depth.
* **Magnetic CTA Buttons:** Use CSS `transform` on hover with `transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1)`. Add directional arrow icons that shift on hover.
* **Staggered Reveals:** Sections fade in sequentially using CSS `animation-delay` cascades. Use `@keyframes fadeInUp { from { opacity: 0; transform: translateY(2rem); } to { opacity: 1; transform: translateY(0); } }` with `animation-delay: calc(var(--index) * 100ms)`.
* **Floating Elements:** Subtle infinite float animations on decorative elements: `@keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }`.
* **Gradient Mesh Backgrounds:** Use multiple `radial-gradient` layers for organic, blob-like ambient backgrounds instead of flat solid colors.
* **Scroll-Triggered Animations (MOTION_INTENSITY > 6):** Use `IntersectionObserver` for viewport-based reveals. NEVER use `window.addEventListener('scroll')`.

## 5. PERFORMANCE GUARDRAILS
* **DOM Cost:** Grain/noise filters go on `position: fixed; inset: 0; z-index: 50; pointer-events: none` elements ONLY. Never on scrolling containers.
* **Hardware Acceleration:** Animate ONLY `transform` and `opacity`. Never animate `top`, `left`, `width`, `height`.
* **Image Optimization:** Use `loading="lazy"` on all images below the fold. Use `decoding="async"` on all images.
* **CDN Weight:** Total external CDN scripts should not exceed 5. Tailwind CDN + Iconify + (optional) Motion One is the maximum baseline.
* **Z-Index Restraint:** Use z-indexes only for: sticky nav (`z-40`), overlays (`z-50`), noise texture (`z-[60]`).

## 6. LANDING PAGE SECTION LIBRARY
Do not default to generic layouts. Pull from this library of premium landing page patterns:

### Hero Sections
* **Split Hero:** 60/40 text-to-visual split. Text left, product screenshot or 3D render right. Background gradient bleed.
* **Full-Bleed Media Hero:** Full-screen image/video with overlaid text. Dark gradient overlay from bottom. CTA floating at bottom-center.
* **Minimal Statement Hero:** Massive typography (text-7xl+) with extreme white-space. Single-line value proposition. Floating CTA pill.
* **Interactive Hero:** Typewriter effect cycling through use cases. "AI로 __ 만들기" with rotating words.

### Feature Sections
* **Bento Grid:** Asymmetric grid (2fr 1fr 1fr pattern) with different card heights. Each card contains an icon, title, short description.
* **Zig-Zag Alternating:** Image-left/text-right → text-left/image-right pattern. Never 3-column equal cards.
* **Icon Strip:** Horizontal scrolling strip of feature icons with hover reveals.
* **Comparison Table:** "Before vs After" or "Us vs Them" with dramatic visual difference.

### Social Proof Sections
* **Logo Cloud:** Client/press logos in a subtle, auto-scrolling marquee strip. Grayscale → color on hover.
* **Testimonial Masonry:** Staggered card heights. Real Korean names, real company names. Photo avatars.
* **Metrics Bar:** Large numbers with animated counting effect. "47,200+ 페이지 생성", "4.9/5.0 만족도".
* **Case Study Cards:** Before/after screenshots with overlay descriptions.

### CTA Sections
* **Full-Bleed CTA:** Dark background, massive text, glowing accent CTA button, floating trust badges below.
* **Sticky Bottom CTA:** Fixed bottom bar that appears after scrolling past the hero.
* **Inline CTA:** Embedded within content flow, styled differently from surrounding sections.

### Footer
* **Minimal Footer:** Logo, essential links, language selector, copyright. No 4-column link farms.
* **Rich Footer:** Brief company description, key nav links, social icons, newsletter signup.

## 7. AI TELLS (Forbidden Patterns)
To guarantee premium, non-generic output:

### Visual & CSS
* **NO Neon/Outer Glows.** Use inner borders or tinted shadows instead.
* **NO Pure Black (#000000).** Use `#0a0a0a`, Zinc-950, or Slate-950.
* **NO Oversaturated Accents.** Desaturate to blend with neutrals.
* **NO Excessive Gradient Text.** One gradient text element per page maximum.

### Typography
* **NO Inter, Noto Sans KR, Roboto, Arial.** Use Pretendard + premium English fonts.
* **NO Oversized H1s without purpose.** Control hierarchy with weight and color, not just size.

### Layout
* **NO 3-Column Equal Card Rows.** Use Bento grids, zig-zag, or asymmetric layouts.
* **NO Identical Section Layouts.** Each section must have a visually distinct structure.
* **NO Edge-to-Edge Content.** Always use `max-w-7xl mx-auto` container constraints.

### Content
* **NO "John Doe" / "김철수".** Use creative, realistic Korean names: "하윤서", "박도현", "이서진".
* **NO "Acme Corp" / "넥서스".** Invent premium Korean brand names: "스텔라랩스", "베리파이", "루미너스".
* **NO Round Numbers.** Use `47,200+` not `50,000+`. Use `4.87` not `5.0`.
* **NO AI Cliche Copy.** Ban: "혁신적인", "원활한", "차세대", "게임 체인저". Write specific, concrete copy.
* **NO Lorem Ipsum or 영문 Placeholder.** All content in natural Korean.

### External Resources
* **NO Unsplash URLs.** Use `picsum.photos/seed/{name}/{w}/{h}` exclusively.
* **NO Broken CDN Links.** Verify all CDN URLs are from major, reliable providers (jsdelivr, unpkg, cdnjs, code.iconify.design).

## 8. THE LANDING PAGE FORMULA
When generating a complete landing page, follow this exact structure:

### A. Document Setup
```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>페이지 제목</title>
  <meta name="description" content="페이지 설명">
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.min.css">
  <script src="https://code.iconify.design/iconify-icon/2.3.0/iconify-icon.min.js"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          fontFamily: {
            sans: ['Pretendard', 'system-ui', 'sans-serif'],
          },
        },
      },
    }
  </script>
</head>
```

### B. Mandatory Section Order (Minimum)
1. **Navigation** — Floating glass pill nav OR minimal top bar
2. **Hero** — The single most impactful section. Must be above the fold.
3. **Social Proof Strip** — Logo cloud or metrics bar. Builds trust immediately.
4. **Features** — 3-5 key features in Bento grid or zig-zag layout.
5. **Testimonials** — Real-feeling Korean testimonials with names and roles.
6. **CTA** — Full-bleed conversion section with primary action.
7. **Footer** — Minimal, clean, essential links only.

### C. Design Philosophy
* **Premium by Default:** Every pixel must look intentional. If it looks like a template, it fails.
* **Korean-Native:** The page must feel like it was designed BY Koreans FOR Koreans. Not a translation.
* **Conversion-Focused:** Every section should guide the eye toward the CTA. Visual hierarchy = conversion funnel.
* **Mobile-First:** 70%+ of Korean web traffic is mobile. Design mobile-first, enhance for desktop.

## 9. FINAL PRE-FLIGHT CHECK
Evaluate against this matrix before outputting:
- [ ] Is the output a single, standalone HTML file that works in a browser?
- [ ] Is Pretendard loaded and set as the primary font?
- [ ] Are all icons using Iconify Solar set?
- [ ] Is all visible text content written in natural Korean?
- [ ] Does `word-break: keep-all` exist on Korean text blocks?
- [ ] Do full-height sections use `min-h-[100dvh]` not `h-screen`?
- [ ] Is mobile layout (`w-full`, `px-4`) guaranteed for all sections?
- [ ] Are CTA buttons large enough for mobile tap targets (min 48px height)?
- [ ] Does each section use a DIFFERENT layout pattern from its neighbors?
- [ ] Are there zero banned fonts, zero emoji, zero Unsplash links?
- [ ] Does the page feel premium, not template-like?
