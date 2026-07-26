#!/usr/bin/env node
/**
 * 이슈 #9 감사 스크립트.
 *
 * issue-start / issue-end / issue-merge 의 마크다운에서 "사용자가 정해야 하는 지점"을 찾아,
 * 그 근처에 AskUserQuestion 사용 지시가 있는지 본다. 없으면 누락으로 센다.
 *
 * 사용자 결정 지점의 표시: 묻는다 / 묻고 / 물어 / 확인받 / 승인받 처럼
 * 사람에게 답을 받아야 끝나는 서술.
 * 자기 점검(출력을 확인한다)이나 "묻지 않는다" 같은 부정형은 대상이 아니다.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const SKILLS = ['issue-start', 'issue-end', 'issue-merge'];
const ROOT = '.claude/skills';
const WINDOW = 12; // 지시가 같은 문단 안에 있다고 볼 범위 (앞뒤 줄 수)

/** 사람에게 답을 받아야 하는 서술 */
const DECISION = /(묻는다|묻고|물어본다|물어야|확인받|확인을 받|승인받|승인을 받)/;
/** 결정처럼 보이지만 아닌 것 */
const NOT_DECISION = /(묻지 않는다|물어보지 않는다|묻지 말|승인받지 않는다|미리 승인)/;

function mdFiles(skill) {
  const out = [];
  const skillMd = join(ROOT, skill, 'SKILL.md');
  if (existsSync(skillMd)) out.push(skillMd);
  const refDir = join(ROOT, skill, 'references');
  if (existsSync(refDir)) {
    for (const f of readdirSync(refDir).sort()) {
      if (f.endsWith('.md')) out.push(join(refDir, f));
    }
  }
  return out;
}

const misses = [];
let total = 0;

for (const skill of SKILLS) {
  for (const file of mdFiles(skill)) {
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (!DECISION.test(line)) return;
      if (NOT_DECISION.test(line)) return;
      // 보고 형식 보일러플레이트는 각 스킬에 공통으로 들어 있는 설명문이라 제외한다.
      if (line.includes('AskUserQuestion 을 쓴다') || line.includes('AskUserQuestion 으로 고를 수 있게')) return;
      total += 1;
      const from = Math.max(0, i - WINDOW);
      const to = Math.min(lines.length, i + WINDOW + 1);
      const near = lines.slice(from, to).join('\n');
      if (!near.includes('AskUserQuestion')) {
        misses.push({ file, line: i + 1, text: line.trim() });
      }
    });
  }
}

console.log('# AskUserQuestion 지시 감사 — issue-start / issue-end / issue-merge\n');
console.log(`결정 지점        ${total}`);
console.log(`지시 있음        ${total - misses.length}`);
console.log(`지시 누락        ${misses.length}\n`);

if (misses.length) {
  console.log('## 누락 목록\n');
  for (const m of misses) {
    console.log(`${m.file}:${m.line}`);
    console.log(`  ${m.text}\n`);
  }
}

console.log(`MISSING=${misses.length}`);
process.exit(misses.length ? 1 : 0);
