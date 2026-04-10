#!/usr/bin/env bash
# memory-promote.sh — Promote entities to cross-project (_global) scope
# Rules:
#   - Lessons: always candidates (universal learnings)
#   - Patterns: promote if seen in 2+ projects
#   - Technologies: already _global by default
#   - Decisions: stay project-local unless tagged

export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

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

[[ "$GRAPH_MEMORY_ENABLED" != "true" ]] && exit 0
[[ ! -f "$GRAPH_DB_PATH" ]] && exit 0

source "$SCRIPT_DIR/memory-helpers.sh" 2>/dev/null || exit 0

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

PROMOTED=0

echo "[memory-promote] Scanning for cross-project promotion candidates..." >&2

# ============================================================
# 1. LESSONS → _global (if not already there)
# ============================================================

LESSONS=$(_sql "SELECT id, name, summary, project FROM entities
               WHERE type = 'Lesson' AND project != '_global'
               AND decay_score > 0.3;")

while IFS=$'\t' read -r lid lname lsummary lproject; do
  [[ -z "$lid" ]] && continue

  # Check if already exists in _global
  existing=$(_sql "SELECT id FROM entities
                   WHERE type = 'Lesson' AND name = '${lname//\'/\'\'}' AND project = '_global'
                   LIMIT 1;")

  if [[ -z "$existing" ]]; then
    vault_path="_global/lessons/${lname}.md"
    global_id=$(memory_upsert_entity "Lesson" "$lname" "_global" "$lsummary (from: $lproject)" "$vault_path")

    if [[ -n "$global_id" ]]; then
      # Create cross-project link
      _sql "INSERT OR IGNORE INTO cross_project_links (source_project, target_project, entity_id, link_type)
            VALUES ('$lproject', '_global', $global_id, 'SHARED_LESSON');"

      _vault_put "$vault_path" "# Lesson: $lname

- **Type**: Lesson (Global)
- **Origin**: $lproject
- **Promoted**: $(date '+%Y-%m-%d')

## Summary
$lsummary

## Source Project
[[$lproject]]
"
      PROMOTED=$((PROMOTED + 1))
      echo "  Lesson: $lname ($lproject → _global)" >&2
    fi
  fi
done <<< "$LESSONS"

# ============================================================
# 2. PATTERNS → _global (if seen in 2+ projects)
# ============================================================

# Find pattern names that appear in multiple projects
MULTI_PATTERNS=$(_sql "SELECT name, COUNT(DISTINCT project) as pcount, GROUP_CONCAT(DISTINCT project) as projects
                       FROM entities
                       WHERE type = 'Pattern' AND project != '_global'
                       GROUP BY name
                       HAVING pcount >= 2;")

while IFS=$'\t' read -r pname pcount pprojects; do
  [[ -z "$pname" ]] && continue

  existing=$(_sql "SELECT id FROM entities
                   WHERE type = 'Pattern' AND name = '${pname//\'/\'\'}' AND project = '_global'
                   LIMIT 1;")

  if [[ -z "$existing" ]]; then
    # Get summary from the most recent instance
    psummary=$(_sql "SELECT summary FROM entities
                     WHERE type = 'Pattern' AND name = '${pname//\'/\'\'}'
                     ORDER BY updated_at DESC LIMIT 1;")

    vault_path="_global/patterns/${pname}.md"
    global_id=$(memory_upsert_entity "Pattern" "$pname" "_global" "$psummary (seen in: $pprojects)" "$vault_path")

    if [[ -n "$global_id" ]]; then
      for proj in $(echo "$pprojects" | tr ',' ' '); do
        _sql "INSERT OR IGNORE INTO cross_project_links (source_project, target_project, entity_id, link_type)
              VALUES ('$proj', '_global', $global_id, 'SHARED_PATTERN');"
      done

      _vault_put "$vault_path" "# Pattern: $pname

- **Type**: Pattern (Global)
- **Seen in**: $pprojects ($pcount projects)
- **Promoted**: $(date '+%Y-%m-%d')

## Summary
$psummary

## Projects
$(echo "$pprojects" | tr ',' '\n' | sed 's/^/- [[/')
"
      PROMOTED=$((PROMOTED + 1))
      echo "  Pattern: $pname (seen in $pcount projects → _global)" >&2
    fi
  fi
done <<< "$MULTI_PATTERNS"

# ============================================================
# 3. SUMMARY
# ============================================================

GLOBAL_COUNT=$(_sql "SELECT COUNT(*) FROM entities WHERE project = '_global';")
LINK_COUNT=$(_sql "SELECT COUNT(*) FROM cross_project_links;")

echo "[memory-promote] Promoted $PROMOTED new entities. Global: $GLOBAL_COUNT entities, $LINK_COUNT cross-links." >&2
