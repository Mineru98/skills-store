---
name: landing-page-upgrader
description: Upgrades existing HTML/CSS landing pages to premium Korean landing page quality. Audits generic AI design patterns and applies targeted improvements across typography, color, layout, motion, content, and accessibility.
---

# Landing Page Upgrader

## How This Works

When applied to an existing landing page, follow this sequence:

1. **Scan** — Read the HTML/CSS. Identify the styling method, current design patterns, font stack, color palette, and layout structure.
2. **Diagnose** — Run through the audit below. Document every generic pattern, weak point, and missing element.
3. **Fix** — Apply targeted upgrades. Do not rewrite from scratch. Improve what's there while maintaining the existing structure.

## Design Audit for Landing Pages

### Typography

- **Browser default fonts, Inter, or Noto Sans KR.** Replace with Pretendard (Korean standard) + premium English display font (Geist, Outfit, Cabinet Grotesk, Satoshi).
- **Headlines lack presence.** Korean headlines need `text-4xl md:text-6xl tracking-tight leading-tight font-bold`. Tighten letter-spacing for impact.
- **Missing `word-break: keep-all` on Korean text.** Korean words break mid-character without this. Add to all Korean text blocks.
- **Body text too wide.** Constrain to ~65 characters max width. Increase `line-height` for Korean readability.
- **Only Regular and Bold weights.** Introduce Medium (500) and SemiBold (600) for hierarchy depth.
- **Numbers in proportional font.** Use `font-variant-numeric: tabular-nums` or monospace for metrics and pricing.
- **Orphaned words.** Fix with `text-wrap: balance` on headings.

### Color and Surfaces

- **Pure `#000000` background.** Replace with `#0a0a0a`, `#09090b` (zinc-950), or tinted dark.
- **Oversaturated accent colors.** Keep saturation below 80%. Desaturate to blend elegantly with neutrals.
- **Multiple accent colors competing.** Pick ONE. Remove the rest.
- **Purple/blue "AI gradient" aesthetic.** The most common AI design fingerprint. Replace with neutral bases + single considered accent.
- **Generic `box-shadow`.** Tint shadows to background hue. Dark blue shadow on blue background, not `rgba(0,0,0,0.3)`.
- **Flat design with zero texture.** Add subtle noise overlay, mesh gradient background, or micro-patterns.
- **Random dark section in a light page.** Maintain consistent background tone. Use shade variations, not dramatic jumps.
- **Empty flat sections.** Add background imagery (blurred, masked), ambient gradients, or pattern overlays.

### Layout (Landing Page Specific)

- **Everything centered and symmetrical.** Break symmetry with offset margins, mixed aspect ratios, split-screen layouts.
- **Three equal card columns for features.** The most generic AI layout. Replace with Bento grid, zig-zag alternating, or horizontal scroll.
- **Every section uses the same layout.** Adjacent sections MUST use different patterns. Hero (split) → Features (bento) → Testimonials (masonry) → CTA (full-bleed).
- **Using `height: 100vh`.** Replace with `min-height: 100dvh` for iOS Safari compatibility.
- **No max-width container.** Add `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`.
- **Missing whitespace.** Double the section padding. `py-20 md:py-32` minimum for landing page sections.
- **Cards of forced equal height.** Allow variable heights or use masonry.
- **No overlap or depth.** Use negative margins, z-index layering, or overlapping elements for visual depth.
- **CTA buttons not prominent enough.** CTAs need `px-8 py-4 text-lg` minimum. Must be the most visually dominant element.

### Interactivity and States

- **No hover states on buttons.** Add `hover:scale-[1.02]`, background shift, or translate effect with smooth transition.
- **No active/pressed feedback.** Add `active:scale-[0.98]` for tactile click feel.
- **Instant transitions.** Add `transition-all duration-300 ease-out` to all interactive elements.
- **No scroll animations.** Add fade-up reveals using CSS `@keyframes` + `IntersectionObserver`.
- **No loading states for interactive elements.** Add skeleton shimmer or loading indicators.
- **Static logo strips.** Convert to auto-scrolling CSS marquee for trust logos.
- **Dead `href="#"` links.** Remove or visually disable them.
- **No smooth scroll.** Add `scroll-behavior: smooth` to `html`.

### Korean Content Quality

- **Translated-sounding Korean.** Rewrite in native, natural Korean. "지금 시작하세요" not "시작을 하세요 지금".
- **Mixed honorific levels.** Stick to one: 합니다/하세요 consistently.
- **AI copywriting cliches.** Remove: "혁신적인", "원활한", "차세대", "게임 체인저", "한 차원 높은". Use concrete language.
- **Generic placeholder names.** Replace "김철수", "이영희" with realistic modern names: "하윤서", "박도현", "이서진".
- **Fake round metrics.** Replace `50,000+` with `47,200+`. Replace `5.0/5.0` with `4.87/5.0`.
- **English placeholder text.** All visible content must be in Korean.
- **Lorem Ipsum.** Replace with real Korean draft copy immediately.

### Component Patterns (Landing Page)

- **Generic hero with centered text over solid color.** Split screen, full-bleed media, or asymmetric statement layout.
- **3-card feature row.** Replace with Bento grid, zig-zag alternating, or horizontal scroll strip.
- **Carousel testimonials with dots.** Replace with masonry wall, embedded social-style cards, or single rotating quote with large portrait.
- **Pricing table with 3 identical towers.** Highlight recommended tier with color, scale, and emphasis.
- **Footer link farm with 4+ columns.** Simplify to essential nav, legal links, social icons.
- **Accordion FAQ.** Replace with side-by-side list, searchable help, or expandable inline sections.
- **CTA that blends into surrounding content.** CTAs need dramatic visual contrast — different background, larger padding, floating treatment.

### Icons and Images

- **Lucide or Feather icons.** Replace with Iconify Solar icon set for consistency.
- **Broken Unsplash URLs.** Replace with `picsum.photos/seed/{name}/{w}/{h}` for landscapes, `i.pravatar.cc/150?u={name}` for avatars.
- **Missing favicon.** Add a branded favicon.
- **Inconsistent icon stroke widths.** Standardize all icons to one weight (Solar set handles this automatically).
- **Generic stock "team" photos.** Use consistent illustration style or high-quality contextual photography.

### Code Quality

- **Div soup.** Use semantic HTML: `<nav>`, `<main>`, `<section>`, `<article>`, `<footer>`.
- **Missing meta tags.** Add `<title>`, `<meta name="description">`, `<meta property="og:image">`, `<meta name="viewport">`.
- **No `lang="ko"` on `<html>`.** Add it for accessibility and SEO.
- **Images without `loading="lazy"`.** Add lazy loading to all below-fold images.
- **No `alt` text on images.** Add descriptive Korean alt text.
- **Arbitrary z-index values.** Establish: nav (40), overlay (50), decorative (60).

## Upgrade Techniques

### Typography Upgrades
- **Animated text reveals.** Characters or words fade/slide in sequentially on scroll.
- **Gradient text accent.** ONE key headline with subtle gradient fill (max one per page).
- **Variable weight on hover.** Text weight shifts subtly when interactive elements are hovered.

### Layout Upgrades
- **Broken grid / asymmetry.** Elements that deliberately offset from the column structure.
- **Parallax depth.** Background images scroll at different speeds from content.
- **Sticky scroll stacking.** Sections stick and layer over each other during scroll.
- **Full-bleed section transitions.** Sections bleed into each other with gradient or diagonal transitions.

### Motion Upgrades
- **Staggered entry cascades.** Elements enter with `animation-delay: calc(var(--index) * 80ms)`.
- **Spring-based hover.** `transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1)` on interactive elements.
- **Scroll-driven progress.** Progress bars or SVG line drawings tied to scroll position.
- **Marquee logos.** Client logos in an infinite CSS marquee animation.

### Surface Upgrades
- **True glassmorphism.** `backdrop-blur-xl` + `border border-white/10` + inner shadow.
- **Mesh gradient backgrounds.** Multiple `radial-gradient` layers for organic ambient feel.
- **Noise texture overlay.** Fixed `pointer-events-none` element with subtle grain.
- **Tinted shadows.** Shadows that carry the background hue instead of generic black.

## Fix Priority

Apply in this order for maximum visual impact, minimum risk:

1. **Font swap to Pretendard** — instant premium feel for Korean content
2. **Color palette cleanup** — remove AI purple, desaturate accents
3. **Korean content rewrite** — natural copy, real names, organic numbers
4. **Hover and active states** — make the interface feel alive
5. **Layout diversification** — break the same-section repetition
6. **Section animation** — staggered reveals, scroll triggers
7. **Polish spacing and typography** — the premium final touch

## Rules

- Do not break existing page structure. Improve incrementally.
- Output must remain a single standalone HTML file.
- Before adding any CDN dependency, verify the URL is correct and from a major provider.
- Keep changes focused and reviewable. Targeted improvements over total rewrites.
- All content modifications must maintain natural Korean language quality.
