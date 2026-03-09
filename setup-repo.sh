#!/bin/bash
set -e
REPO="ulfdahlstrand/flower"

# Labels and issue templates are managed by the PM Agent on startup.
# The PM Agent reads the canonical list from docs/agents/pm.md and creates
# anything missing incrementally — this script only scaffolds the file structure.

# ── Folder structure + files ──────────────────────────────────────────────────

echo "📁 Creating repository structure..."

TMPDIR=$(mktemp -d)
cd $TMPDIR
git clone https://github.com/$REPO.git .

# Issue templates, labels, and docs are created by the PM Agent on first startup.
# See docs/agents/pm.md for the canonical content.

# tasks/ placeholder
mkdir -p tasks
cat > tasks/.gitkeep << 'DOC'
# This folder contains per-task JSON state files named {issue-id}.json
# They are created and updated by agents during task execution.
DOC

# product/brief.md
mkdir -p product
cat > product/brief.md << 'DOC'
# Product Brief

> The PM Agent reads this file to initialize a project. Fill this in before starting.

## Product Name


## Problem Statement
<!-- What problem are we solving and for whom? -->

## Goals
<!-- What does success look like? -->

## Non-Goals
<!-- What are we explicitly not doing? -->

## Target Users


## Key Features (high level)
1. 
2. 
3. 

## Constraints
<!-- Technical, time, budget, or other constraints -->

## Open Questions
<!-- Things that need to be resolved before or during development -->
DOC

# .gitignore — exclude flower runtime data from version control
cat >> .gitignore << 'EOF'

# Flower orchestrator runtime data (sessions, queue)
.flower/
EOF

# Commit and push
git add .
git commit -m "chore: initialize agent development flow structure"
git push origin main

echo "✅ Repository structure created and pushed"
echo ""
echo "🎉 Setup complete! Your repo is ready at https://github.com/$REPO"
echo ""
echo "Next steps:"
echo "  1. Fill in product/brief.md with your project details"
echo "  2. Run the PM agent to create your first Epic"
EOF
