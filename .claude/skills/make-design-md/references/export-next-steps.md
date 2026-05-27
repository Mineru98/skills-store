# Export Next Steps

Use this after `DESIGN.md` passes validation.

## Ask the User

Always ask how to export after validation. Make the choice easy:

```text
검증이 끝났습니다. 다음 추출 방식을 선택해주세요.
1. Tailwind - 웹/앱 개발에서 Tailwind 기반 CSS 작업에 사용합니다. React, Next.js, React Native, Tauri 등 Tailwind를 쓰는 환경이면 추천합니다.
2. DTCG - Figma나 디자인 툴로 토큰을 넘겨 작업할 때 추천합니다.

추천: <Tailwind 또는 DTCG> - <현재 프로젝트 근거>
번호로 답해도 됩니다: 1 또는 2
```

Recognize:

- `1`, `tailwind`, `Tailwind`, `테일윈드`, `테일윈드로`, `웹`, `개발` as Tailwind.
- `2`, `dtcg`, `DTCG`, `figma`, `Figma`, `피그마`, `디자인툴`, `디자인 토큰` as DTCG.

## Project Detection

Recommend Tailwind when you find any of:

- `tailwind.config.*`
- `postcss.config.*` with Tailwind
- package dependencies or dev dependencies including `tailwindcss`, `@tailwindcss/*`
- React, Next.js, React Native, Tauri, Vite, Remix, Astro, SvelteKit, or similar frontend stacks
- UI code directories such as `app/`, `pages/`, `src/components/`, `src/app/`

Recommend DTCG when you find any of:

- Figma or design-token workflow references
- `tokens.json`, `*.tokens.json`, Style Dictionary config
- no visible implementation stack
- user intent is design-tool handoff rather than coding

If evidence is mixed, explain the tradeoff and still recommend one.

## Commands

Tailwind:

```bash
npx --yes @google/design.md export --format tailwind DESIGN.md > design.tailwind.json
```

DTCG:

```bash
npx --yes @google/design.md export --format dtcg DESIGN.md > design.tokens.json
```

## Tailwind Follow-Up

When the user chooses Tailwind:

1. Export `design.tailwind.json`.
2. Inspect package manager and framework files.
3. Inspect local skills by reading `.codex/skills/*/SKILL.md` and relevant user/global skills when needed.
4. Recommend a skill combination for a sample page.
5. Provide an example prompt.

Example prompt shape:

```text
Use $frontend-design with $playwright-cli and $design-md-validator.
Build a sample page that demonstrates the generated DESIGN.md visual system using the Tailwind export at <path>.
Use the current project framework conventions, wire the Tailwind tokens into the theme, create representative sections/components, then run visual verification screenshots.
```

Adapt the prompt to the actual project framework and available skills.
