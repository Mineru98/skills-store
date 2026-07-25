find . -name ".DS_Store" -type f -delete
if [ -f .gitignore ]; then
    for item in ".omc" ".DS_Store" "node_modules" ".sisyphus"; do
        grep -qxF "$item" .gitignore || echo "$item" >> .gitignore
    done
else
    cat > .gitignore << 'EOF'
.omc
.DS_Store
node_modules
.sisyphus
EOF
fi

mkdir -p .claude/skills
mkdir -p .codex/skills

git clone https://github.com/Mineru98/skills-store ./tmp/skills-store

cp -R ./tmp/skills-store/.claude/rules/frontend .claude/rules

[ ! -e ~/.claude/skills/playwright-cli ] && cp -R ./tmp/skills-store/.claude/skills/playwright-cli ~/.claude/skills/playwright-cli
[ ! -e ~/.codex/skills/playwright-cli ] && cp -R ./tmp/skills-store/.codex/skills/playwright-cli ~/.codex/skills/playwright-cli

[ ! -e ~/.claude/skills/frontend-design ] && cp -R ./tmp/skills-store/.claude/skills/frontend-design ~/.claude/skills/frontend-design
[ ! -e ~/.codex/skills/frontend-design ] && cp -R ./tmp/skills-store/.codex/skills/frontend-design ~/.codex/skills/frontend-design

[ ! -e ~/.claude/commands/commit.md ] && mkdir -p .claude/commands && cp ./tmp/skills-store/.claude/commands/commit.md .claude/commands/commit.md
[ ! -e ~/.codex/skills/commit ] && cp -R ./tmp/skills-store/.codex/skills/commit .codex/skills/commit

[ ! -e ~/.claude/commands/kill-process.md ] && mkdir -p .claude/commands && cp ./tmp/skills-store/.claude/commands/kill-process.md .claude/commands/kill-process.md
[ ! -e ~/.codex/skills/kill-process ] && cp -R ./tmp/skills-store/.codex/skills/kill-process .codex/skills/kill-process
[ ! -e AGENTS.md ] && cp tmp/skills-store/.codex/AGENTS.md AGENTS.md

rm -rf ./tmp