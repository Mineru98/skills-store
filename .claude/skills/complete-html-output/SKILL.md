---
name: complete-html-output
description: Overrides default LLM truncation behavior. Enforces complete HTML generation with zero placeholder patterns. Every landing page must be delivered as a complete, production-ready file. No shortcuts, no skeletons, no "add more as needed" patterns.
---

# Complete HTML Output

## Baseline

Treat every landing page generation as production-critical. A partial output is a broken output. If the user asks for a landing page, deliver the COMPLETE landing page — every section, every animation, every responsive breakpoint. No exceptions.

## Banned Output Patterns

The following patterns are hard failures. Never produce them:

**In code blocks:**
- `<!-- ... -->`
- `<!-- rest of sections -->`
- `<!-- similar to above -->`
- `<!-- add more sections as needed -->`
- `<!-- TODO -->`
- `// ...`
- Bare `...` standing in for omitted HTML

**In prose:**
- "Let me know if you want me to continue"
- "I can add more sections if needed"
- "For brevity, I'll show just the hero section"
- "The rest follows the same pattern"
- "Similarly for the remaining sections"
- "I'll leave that for you to customize"

**Structural shortcuts:**
- Outputting only the Hero when a full page was requested
- Showing the first and last section while skipping the middle
- Replacing repeated sections with one example and a description
- Describing what HTML should contain instead of writing it
- Generating a skeleton/wireframe when a complete page was requested

## Execution Process

1. **Scope** — Read the full request. Count how many sections/components are expected. A "landing page" means: nav + hero + social proof + features + testimonials + CTA + footer at minimum (7 sections). Lock the count.
2. **Build** — Generate every section completely with full responsive classes, animations, real Korean content, and proper Iconify icons.
3. **Cross-check** — Before output, verify: Does the HTML file have an opening `<!DOCTYPE html>` and closing `</html>`? Are all 7+ sections present? Is every section fully populated with real content?

## Handling Long Outputs

When a landing page approaches the token limit:

- Do NOT compress remaining sections to fit.
- Do NOT skip to the footer.
- Write at full quality up to a clean breakpoint (end of a complete `</section>` tag).
- End with:

```
[PAUSED — X of Y sections complete. Send "continue" to resume from: next section name]
```

On "continue", pick up with the next `<section>` exactly where you stopped. No recap, no re-outputting the `<head>`, no repetition.

## Landing Page Completeness Standards

A complete landing page MUST include:

### Required Elements
- `<!DOCTYPE html>` with `<html lang="ko">`
- Complete `<head>` with meta tags, Tailwind CDN, Pretendard font, Iconify, tailwind.config
- Navigation (floating glass or minimal bar)
- Hero section (above the fold, single most impactful section)
- At least one trust/social proof element
- Feature presentation (3-5 features minimum)
- Testimonials or case studies
- Primary CTA section
- Footer with essential links
- Scroll animation JavaScript (`IntersectionObserver` setup)
- Complete `</html>` closing

### Required Quality
- Every section has real Korean content (no placeholder text)
- Every section has full responsive classes (`sm:`, `md:`, `lg:`)
- Every interactive element has hover/active states
- Every image has `loading="lazy"`, `alt` text, and valid `src`
- Every icon uses `<iconify-icon icon="solar:..."></iconify-icon>`

## Quick Check

Before finalizing any response, verify:
- No banned patterns from the list above appear anywhere
- The HTML file is complete from `<!DOCTYPE html>` to `</html>`
- All requested sections are present and fully populated
- Every code block contains actual runnable HTML, not descriptions
- Nothing was shortened, summarized, or omitted to save space
- All visible text content is in natural Korean
