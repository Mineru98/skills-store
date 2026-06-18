---
name: irasutoya-search
description: Search and preview Irasutoya illustrations with the installed `irasutoya` command-line tool. Use this skill whenever the user wants to find, recommend, preview, randomly pull up, or get the page/image URL of an Irasutoya (いらすとや) image — from a topic, scene, Korean/Japanese/English phrase, visual description, emotion, character, object, or action — even if they don't say "Irasutoya" by name but clearly want a free, cute illustration for a slide, 발표자료, blog, doc, or chat. Also use it to optimize vague requests into fast Japanese keyword candidates and to return page/image URLs. Do NOT use it to generate brand-new AI art (e.g. DALL·E, Midjourney), draw charts or diagrams, design logos or icons, cut out/edit existing images, or recommend other stock-image sites — it only searches Irasutoya's existing catalog.
---

# irasutoya-search

## Overview

Use the installed `irasutoya` command-line tool to find Irasutoya illustrations. The skill drives the CLI that is already installed on the system — it does not run, build, or modify any Ruby source. Optimize vague or natural-language requests into short Japanese search candidates before reporting results.

## Command Choice

- Use `irasutoya random` when the user wants an arbitrary Irasutoya image.
- Use `irasutoya search "query"` when the user gives a topic, keyword, or phrase.
- Use `irasutoya help` or `irasutoya help COMMAND` when the user asks what is available.

Expected commands:

```sh
irasutoya random
irasutoya search "cat"
irasutoya help search
```

The `search` command returns up to 3 matching images. Each result prints:

- `Page URL`
- `Title`
- `Description`
- one or more `Image URL` lines
- an inline image preview when the terminal supports it

## Fast Search Workflow

1. Parse the request into visual facets:
   - subject: person, animal, object, role, age, gender
   - action/pose: observing, wondering, eating, running, pointing
   - emotion/expression: curious, doubtful, happy, surprised, worried
   - props/context: magnifying glass, question mark, school, office
2. Generate 2-4 concise query candidates. Prefer Japanese nouns and short noun phrases because Irasutoya titles/descriptions are Japanese.
3. Search candidates in parallel when possible. Avoid launching many broad searches; stop once a strong match appears.
4. Score results before reporting. Prefer results whose title or description matches at least two facets.
5. Return the best result first, with any close alternative only if it captures a different interpretation.

Pass condition: the first search batch should produce a 4-5 point result in the top two results for at least one candidate query. If it does not, run one refinement batch using the failure rules below.

## Query Rubric

Score each candidate result from 0-5:

- +2 subject match: correct character/object type, such as `男の子`.
- +1 action/pose match: the visible activity matches, such as `観察`.
- +1 emotion/expression match: the description/title implies the requested feeling, such as `不思議そう`, `疑問`, or `はてな`.
- +1 prop/context match: important visual prop or setting appears, such as `虫眼鏡`.
- +1 single-scene match: one concrete illustration, not a sheet of variations, when the user asked for one image.
- -1 if the result is too generic, multi-image, or only one small sub-image matches.
- -1 if the title includes `いろいろな`, `表情`, or `パーツ別` and the user asked for one concrete scene.

Cap the score at 5. Use a result scoring 4-5 as the primary answer. Use a 3 only when no better result appears and explain the limitation briefly.

## Query Strategy

- Do not rely on long Korean natural-language strings as the only search. Try the user's wording once only if it is likely indexed, then optimize.
- Convert Korean descriptions into Japanese visual keywords:
  - curious/wondering: `不思議`, `疑問`, `はてな`
  - boy: `男の子`
  - girl: `女の子`
  - child: `子供`
  - observe/look closely: `観察`, `見る`
  - magnifying glass: `虫眼鏡`
  - question/question mark: `質問`, `疑問`, `はてな`
  - angry: `怒る`, `怒った`
  - crying: `泣く`, `泣いている`
  - troubled/stuck: `困った`, `悩む`
  - office worker: `会社員`, `サラリーマン`
  - computer: `パソコン`
  - doctor/lab coat: `医者`, `白衣`
- Prefer 2-term Japanese queries such as `不思議 男の子`, `疑問 男の子`, `虫眼鏡 男の子`.
- If a request includes a visible prop or action, search that prop/action plus subject before searching abstract emotions.
- If the first good result is a multi-image expression sheet, keep searching for a single-image scene when the user asked for a scene or full illustration.
- Try both dictionary-like and title-like forms for emotions/actions when the first form is weak:
  - `怒る 女の子` can beat `怒った 女の子` for a single angry girl.
  - `困った 会社員` can beat `困る 会社員` for an office worker at a computer.
  - `泣いている 赤ちゃん` can surface the exact crying baby image, but check the second result when the first adds extra context.
- For occupational or role terms, try Irasutoya-style synonyms in the refinement batch, such as `会社員` and `サラリーマン`.
- Preserve the user's original intent in the final wording, not necessarily the original query text.

## Failure Rules

Run exactly one refinement batch before reporting a partial match:

- If there are no results, switch word form or synonym: `困る` -> `困った`, `会社員` -> `サラリーマン`.
- If results are expression sheets or grouped parts, add a concrete prop/action or try a more scene-like phrase.
- If broad role + prop searches return only grouped images, demote them and search a visual proxy such as `白衣 マスク`.
- If the exact desired result appears as the second result, select it over a broader first result and mention the selected title.

## Checking Candidate Queries (metadata only)

When comparing several candidate queries or checking whether the rubric holds, the inline image preview can flood the terminal. Suppress it by piping the CLI output through `grep` so only the metadata lines remain:

```sh
for q in "不思議 男の子" "虫眼鏡 男の子"; do
  echo "=== $q ==="
  irasutoya search "$q" | grep -E "Page URL|Title|Description|Image URL"
done
```

Use at least these smoke cases:

- curious boy wondering: expect `不思議 男の子` or `虫眼鏡 男の子` to find a 5-point result.
- angry girl: expect `怒る 女の子` to beat `怒った 女の子` because the latter returns expression sheets.
- office worker troubled at a computer: expect `困った 会社員` to beat `困る 会社員` and `パソコン 困った`.
- crying baby: expect `泣いている 赤ちゃん` to include the exact simple crying baby image, even if it is not first.

The rubric is acceptable when at least three of four smoke cases find a 4-5 point result within the first refinement batch. If a case fails, add only the missing query synonym or failure rule; do not add broad generic search advice.

## Running the CLI

The skill always uses the globally installed `irasutoya` executable:

```sh
irasutoya random
irasutoya search "query"
```

Quote multi-word queries. If the `irasutoya` command is not found, install it with `gem install irasutoya-cli` (requires Ruby `>= 3.1`); the gem ships the `irasutoya`, `terminal_image`, and `thor` dependencies it needs.

## Terminal Preview Behavior

Inline previews depend on `terminal_image`. If the terminal does not support inline images, the CLI still prints the page/image URLs and warns:

```text
warn: This terminal is not able to show images inline
warn: Please use iTerm2 or terminal installed libsixel.
```

Treat that warning as non-fatal. Return the printed URLs to the user when image rendering is unavailable.

## Output Guidance

- Quote multi-word queries in shell commands.
- Report title, page URL, image URL, and a short reason why it matches.
- If the CLI prints multiple `Image URL` lines for one page, identify the specific image that best matches instead of treating all images as equal.
- Do not scrape extra content unless the user asks for more than the CLI output.
