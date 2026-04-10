#!/usr/bin/env bash
# memory-extract.sh — Extract entities and relationships from session data
# Called from stop-rag-check.sh after each session turn
# Input: stdin (hook JSON) + git state + session text
# Output: entities written to SQLite + Obsidian vault

export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# --- Load config ---
if [[ -f "$SCRIPT_DIR/../../.flowsetrc" ]]; then
  source "$SCRIPT_DIR/../../.flowsetrc"
elif [[ -f ".flowsetrc" ]]; then
  source ".flowsetrc"
fi

: "${GRAPH_MEMORY_ENABLED:=false}"
: "${GRAPH_DB_PATH:=$HOME/.flowset/graph.db}"
: "${VAULT_ENABLED:=false}"
: "${VAULT_URL:=https://localhost:27124}"
: "${VAULT_API_KEY:=}"
: "${VAULT_PROJECT_NAME:=$PROJECT_NAME}"

[[ "$GRAPH_MEMORY_ENABLED" != "true" ]] && exit 0
[[ ! -f "$GRAPH_DB_PATH" ]] && exit 0
[[ -z "$VAULT_PROJECT_NAME" ]] && VAULT_PROJECT_NAME="${PROJECT_NAME:-unknown}"

# --- Load helpers ---
source "$SCRIPT_DIR/memory-helpers.sh" 2>/dev/null || exit 0

# Vault write helper (inline, independent of vault-helpers.sh sourcing context)
_vault_put() {
  [[ "$VAULT_ENABLED" != "true" || -z "$VAULT_API_KEY" ]] && return 0
  local path="$1" content="$2"
  local encoded
  encoded=$(printf '%s' "$path" | jq -sRr @uri 2>/dev/null || printf '%s' "$path" | sed 's| |%20|g; s|/|%2F|g')
  curl -s -k --max-time 5 \
    "${VAULT_URL}/vault/${encoded}" \
    -X PUT \
    -H "Authorization: Bearer ${VAULT_API_KEY}" \
    -H "Content-Type: text/markdown; charset=utf-8" \
    --data-binary "$content" > /dev/null 2>&1
}

# ============================================================
# INPUT COLLECTION
# ============================================================

# Read hook input from stdin (if available)
INPUT=$(cat 2>/dev/null || true)

# Extract summary from hook input
SUMMARY=$(echo "$INPUT" | jq -r '.last_assistant_message // ""' 2>/dev/null | head -c 2000 || true)
[[ -z "$SUMMARY" ]] && SUMMARY=$(echo "$INPUT" | jq -r '.summary // ""' 2>/dev/null | head -c 2000 || true)

# Get git state
CHANGED_FILES=$(git diff --name-only HEAD~1 HEAD 2>/dev/null || git diff --name-only 2>/dev/null || true)
CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
LAST_COMMIT_MSG=$(git log -1 --pretty=format:"%s" 2>/dev/null || true)

# Detect WI from branch or commit
CURRENT_WI=""
if [[ "$CURRENT_BRANCH" =~ (WI-[0-9]{3,4}-[a-z]+) ]]; then
  CURRENT_WI="${BASH_REMATCH[1]}"
elif [[ "$LAST_COMMIT_MSG" =~ (WI-[0-9]{3,4}-[a-z]+) ]]; then
  CURRENT_WI="${BASH_REMATCH[1]}"
fi

TIMESTAMP=$(date '+%Y-%m-%d %H:%M')
EXTRACTED_COUNT=0

# ============================================================
# FILE ENTITY EXTRACTION
# ============================================================

extract_files() {
  [[ -z "$CHANGED_FILES" ]] && return 0

  while IFS= read -r filepath; do
    [[ -z "$filepath" ]] && continue
    # Skip non-source files
    case "$filepath" in
      .git/*|node_modules/*|.next/*|dist/*|build/*|*.lock|package-lock.json) continue ;;
    esac

    local file_type=""
    case "$filepath" in
      *.ts|*.tsx|*.js|*.jsx) file_type="TypeScript/JavaScript" ;;
      *.py) file_type="Python" ;;
      *.rs) file_type="Rust" ;;
      *.go) file_type="Go" ;;
      *.md) file_type="Documentation" ;;
      *.sql) file_type="SQL" ;;
      *.sh) file_type="Shell" ;;
      *.css|*.scss) file_type="Stylesheet" ;;
      *.json|*.yaml|*.yml|*.toml) file_type="Config" ;;
      *) file_type="Other" ;;
    esac

    local summary_text="$file_type file modified in $CURRENT_BRANCH"
    local vault_path="${VAULT_PROJECT_NAME}/entities/files/$(echo "$filepath" | sed 's|/|-|g; s|\.|-|g').md"

    local entity_id
    entity_id=$(memory_upsert_entity "File" "$filepath" "$VAULT_PROJECT_NAME" "$summary_text" "$vault_path" "{\"file_type\":\"$file_type\"}")

    if [[ -n "$entity_id" ]]; then
      EXTRACTED_COUNT=$((EXTRACTED_COUNT + 1))

      # Write vault page
      _vault_put "$vault_path" "# $filepath

- **Type**: File
- **File Type**: $file_type
- **Project**: $VAULT_PROJECT_NAME
- **Last Modified**: $TIMESTAMP

## Relationships
$([ -n "$CURRENT_WI" ] && echo "- Modified by: [[$CURRENT_WI]]")

## History
- $TIMESTAMP: Modified in branch \`$CURRENT_BRANCH\`
"

      # Create MODIFIES relation if WI is known
      if [[ -n "$CURRENT_WI" ]]; then
        local wi_id
        wi_id=$(memory_find_entity "$CURRENT_WI" "$VAULT_PROJECT_NAME" "WI" | head -1 | cut -f1)
        if [[ -n "$wi_id" ]]; then
          memory_add_relation "$wi_id" "$entity_id" "MODIFIES" "$LAST_COMMIT_MSG"
        fi
      fi
    fi
  done <<< "$CHANGED_FILES"
}

# ============================================================
# DECISION ENTITY EXTRACTION
# ============================================================

extract_decisions() {
  [[ -z "$SUMMARY" ]] && return 0

  # Pattern: "decided to|chose|selected|went with|opted for"
  local decisions
  decisions=$(echo "$SUMMARY" | grep -oiE '(decided to|chose|selected|went with|opted for|결정했|선택했|채택했)[^.!?]{5,80}[.!?]' 2>/dev/null || true)

  [[ -z "$decisions" ]] && return 0

  while IFS= read -r decision_text; do
    [[ -z "$decision_text" ]] && continue

    # Clean and create a name from the decision
    local decision_name
    decision_name=$(echo "$decision_text" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//' | head -c 60)
    local slug
    slug=$(echo "$decision_name" | sed 's/[^a-zA-Z0-9가-힣 ]//g; s/ /-/g' | head -c 40)
    [[ -z "$slug" ]] && continue

    local vault_path="${VAULT_PROJECT_NAME}/entities/decisions/${slug}.md"

    local entity_id
    entity_id=$(memory_upsert_entity "Decision" "$slug" "$VAULT_PROJECT_NAME" "$decision_text" "$vault_path")

    if [[ -n "$entity_id" ]]; then
      EXTRACTED_COUNT=$((EXTRACTED_COUNT + 1))

      _vault_put "$vault_path" "# Decision: $decision_name

- **Type**: Decision
- **Project**: $VAULT_PROJECT_NAME
- **Date**: $TIMESTAMP
- **Branch**: $CURRENT_BRANCH

## Rationale
$decision_text

## Relationships
$([ -n "$CURRENT_WI" ] && echo "- Context: [[$CURRENT_WI]]")

## History
- $TIMESTAMP: Recorded from session
"
    fi
  done <<< "$decisions"
}

# ============================================================
# BUG ENTITY EXTRACTION
# ============================================================

extract_bugs() {
  [[ -z "$SUMMARY" ]] && return 0

  # Pattern: "bug|root cause|error|failure|fixed|수정|버그|에러|원인"
  local bug_texts
  bug_texts=$(echo "$SUMMARY" | grep -oiE '(bug|root cause|error was|failure in|fixed .{5,60}|수정했|버그|에러 원인)[^.!?]{5,100}[.!?]' 2>/dev/null || true)

  [[ -z "$bug_texts" ]] && return 0

  while IFS= read -r bug_text; do
    [[ -z "$bug_text" ]] && continue

    local bug_name
    bug_name=$(echo "$bug_text" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//' | head -c 60)
    local slug
    slug=$(echo "$bug_name" | sed 's/[^a-zA-Z0-9가-힣 ]//g; s/ /-/g' | head -c 40)
    [[ -z "$slug" ]] && continue

    local vault_path="${VAULT_PROJECT_NAME}/bugs/${slug}.md"

    local entity_id
    entity_id=$(memory_upsert_entity "Bug" "$slug" "$VAULT_PROJECT_NAME" "$bug_text" "$vault_path")

    if [[ -n "$entity_id" ]]; then
      EXTRACTED_COUNT=$((EXTRACTED_COUNT + 1))

      _vault_put "$vault_path" "# Bug: $bug_name

- **Type**: Bug
- **Project**: $VAULT_PROJECT_NAME
- **Date**: $TIMESTAMP

## Description
$bug_text

## Relationships
$([ -n "$CURRENT_WI" ] && echo "- Fixed by: [[$CURRENT_WI]]")

## Affected Files
$(echo "$CHANGED_FILES" | head -5 | sed 's|^|- [[&]]|')

## History
- $TIMESTAMP: Recorded from session
"

      # Create FIXED_BY relation
      if [[ -n "$CURRENT_WI" ]]; then
        local wi_id
        wi_id=$(memory_find_entity "$CURRENT_WI" "$VAULT_PROJECT_NAME" "WI" | head -1 | cut -f1)
        if [[ -n "$wi_id" ]]; then
          memory_add_relation "$entity_id" "$wi_id" "FIXED_BY" "$bug_text"
        fi
      fi

      # Create CAUSED_BY relations to files
      while IFS= read -r filepath; do
        [[ -z "$filepath" ]] && continue
        local file_id
        file_id=$(memory_find_entity "$filepath" "$VAULT_PROJECT_NAME" "File" | head -1 | cut -f1)
        if [[ -n "$file_id" ]]; then
          memory_add_relation "$entity_id" "$file_id" "CAUSED_BY" "$bug_text"
        fi
      done <<< "$(echo "$CHANGED_FILES" | head -5)"
    fi
  done <<< "$bug_texts"
}

# ============================================================
# PATTERN ENTITY EXTRACTION
# ============================================================

extract_patterns() {
  [[ -z "$SUMMARY" ]] && return 0

  # Pattern: "pattern|anti-pattern|always|never should|best practice|패턴|안티패턴"
  local pattern_texts
  pattern_texts=$(echo "$SUMMARY" | grep -oiE '(pattern:|anti-pattern:|always .{5,60}|never should .{5,60}|best practice .{5,60}|패턴:|안티패턴:)[^.!?]{5,100}[.!?]' 2>/dev/null || true)

  [[ -z "$pattern_texts" ]] && return 0

  while IFS= read -r pattern_text; do
    [[ -z "$pattern_text" ]] && continue

    local pattern_name
    pattern_name=$(echo "$pattern_text" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//' | head -c 60)
    local slug
    slug=$(echo "$pattern_name" | sed 's/[^a-zA-Z0-9가-힣 ]//g; s/ /-/g' | head -c 40)
    [[ -z "$slug" ]] && continue

    local is_anti="false"
    echo "$pattern_text" | grep -qiE 'anti-pattern|안티패턴|never should' && is_anti="true"

    local vault_path="${VAULT_PROJECT_NAME}/patterns/${slug}.md"

    local entity_id
    entity_id=$(memory_upsert_entity "Pattern" "$slug" "$VAULT_PROJECT_NAME" "$pattern_text" "$vault_path" "{\"is_anti\":$is_anti}")

    if [[ -n "$entity_id" ]]; then
      EXTRACTED_COUNT=$((EXTRACTED_COUNT + 1))

      local pattern_type="Good Pattern"
      [[ "$is_anti" == "true" ]] && pattern_type="Anti-Pattern"

      _vault_put "$vault_path" "# $pattern_type: $pattern_name

- **Type**: Pattern
- **Category**: $pattern_type
- **Project**: $VAULT_PROJECT_NAME
- **Date**: $TIMESTAMP

## Description
$pattern_text

## History
- $TIMESTAMP: Discovered in session
"
    fi
  done <<< "$pattern_texts"
}

# ============================================================
# LESSON EXTRACTION (from guardrails.md new entries)
# ============================================================

extract_lessons_from_guardrails() {
  [[ ! -f ".flowset/guardrails.md" ]] && return 0

  # Check if guardrails was recently modified (within last 5 minutes)
  local guard_mtime now age
  now=$(date +%s)
  if stat --version &>/dev/null 2>&1; then
    guard_mtime=$(stat -c %Y ".flowset/guardrails.md" 2>/dev/null || echo 0)
  else
    guard_mtime=$(stat -f %m ".flowset/guardrails.md" 2>/dev/null || echo 0)
  fi
  age=$(( now - guard_mtime ))
  [[ $age -gt 300 ]] && return 0  # Skip if not modified in last 5 min

  # Extract last 3 lines as potential new lessons
  local new_entries
  new_entries=$(tail -3 ".flowset/guardrails.md" | grep -E '^-' 2>/dev/null || true)

  [[ -z "$new_entries" ]] && return 0

  while IFS= read -r entry; do
    [[ -z "$entry" ]] && continue
    entry="${entry#- }"  # Remove leading "- "

    local slug
    slug=$(echo "$entry" | sed 's/[^a-zA-Z0-9가-힣 ]//g; s/ /-/g' | head -c 40)
    [[ -z "$slug" ]] && continue

    local vault_path="${VAULT_PROJECT_NAME}/lessons/${slug}.md"

    local entity_id
    entity_id=$(memory_upsert_entity "Lesson" "$slug" "$VAULT_PROJECT_NAME" "$entry" "$vault_path")

    if [[ -n "$entity_id" ]]; then
      EXTRACTED_COUNT=$((EXTRACTED_COUNT + 1))

      _vault_put "$vault_path" "# Lesson: $entry

- **Type**: Lesson
- **Project**: $VAULT_PROJECT_NAME
- **Source**: guardrails.md
- **Date**: $TIMESTAMP

## What Happened
$entry

## Relationships
$([ -n "$CURRENT_WI" ] && echo "- Learned from: [[$CURRENT_WI]]")

## History
- $TIMESTAMP: Added to guardrails
"

      # LEARNED_FROM relation to current WI
      if [[ -n "$CURRENT_WI" ]]; then
        local wi_id
        wi_id=$(memory_find_entity "$CURRENT_WI" "$VAULT_PROJECT_NAME" "WI" | head -1 | cut -f1)
        if [[ -n "$wi_id" ]]; then
          memory_add_relation "$entity_id" "$wi_id" "LEARNED_FROM" "$entry"
        fi
      fi
    fi
  done <<< "$new_entries"
}

# ============================================================
# TECHNOLOGY EXTRACTION (dictionary-based)
# ============================================================

extract_technologies() {
  [[ -z "$SUMMARY" ]] && return 0

  # Built-in tech dictionary (extensible via ~/.flowset/tech-dictionary.txt)
  local TECH_LIST="Next.js|React|Vue|Angular|Svelte|TypeScript|JavaScript|Python|Rust|Go|Java|Prisma|Drizzle|SQLite|PostgreSQL|MySQL|MongoDB|Redis|Neo4j|Docker|Kubernetes|Nginx|Playwright|Jest|Vitest|Tailwind|FastAPI|Express|Fastify|BullMQ|Supabase|Firebase|Vercel|AWS|GCP|OCI"

  if [[ -f "$HOME/.flowset/tech-dictionary.txt" ]]; then
    local custom_tech
    custom_tech=$(tr '\n' '|' < "$HOME/.flowset/tech-dictionary.txt" | sed 's/|$//')
    [[ -n "$custom_tech" ]] && TECH_LIST="${TECH_LIST}|${custom_tech}"
  fi

  local found_techs
  found_techs=$(echo "$SUMMARY" | grep -oiE "($TECH_LIST)" 2>/dev/null | sort -u || true)

  [[ -z "$found_techs" ]] && return 0

  while IFS= read -r tech; do
    [[ -z "$tech" ]] && continue

    # Normalize casing
    local tech_canonical="$tech"
    local vault_path="_global/technologies/$(echo "$tech" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g').md"

    local entity_id
    entity_id=$(memory_upsert_entity "Technology" "$tech_canonical" "_global" "" "$vault_path")

    if [[ -n "$entity_id" ]]; then
      # Create USES relation from project
      local project_id
      project_id=$(memory_find_entity "$VAULT_PROJECT_NAME" "$VAULT_PROJECT_NAME" "Project" | head -1 | cut -f1)
      if [[ -z "$project_id" ]]; then
        project_id=$(memory_upsert_entity "Project" "$VAULT_PROJECT_NAME" "$VAULT_PROJECT_NAME" "FlowSet project" "")
      fi
      [[ -n "$project_id" ]] && memory_add_relation "$project_id" "$entity_id" "USES" ""

      # Write vault page (only if new — check existing)
      _vault_put "$vault_path" "# $tech_canonical

- **Type**: Technology
- **Scope**: Global (cross-project)
- **Last Referenced**: $TIMESTAMP

## Projects Using This
- [[$VAULT_PROJECT_NAME]]
"
    fi
  done <<< "$found_techs"
}

# ============================================================
# MAIN EXTRACTION PIPELINE
# ============================================================

echo "[memory-extract] Starting extraction for project=$VAULT_PROJECT_NAME branch=$CURRENT_BRANCH wi=$CURRENT_WI" >&2

extract_files
extract_decisions
extract_bugs
extract_patterns
extract_lessons_from_guardrails
extract_technologies

echo "[memory-extract] Extracted $EXTRACTED_COUNT entities." >&2
