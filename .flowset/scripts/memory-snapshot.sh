#!/usr/bin/env bash
# memory-snapshot.sh — Save knowledge snapshot before context compaction
# Called from PreCompact hook
# Ensures entities from the current conversation are persisted before context is lost

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
: "${VAULT_PROJECT_NAME:=$PROJECT_NAME}"

[[ "$GRAPH_MEMORY_ENABLED" != "true" ]] && exit 0
[[ ! -f "$GRAPH_DB_PATH" ]] && exit 0

source "$SCRIPT_DIR/memory-helpers.sh" 2>/dev/null || exit 0

# Read hook input
INPUT=$(cat 2>/dev/null || true)

echo "[memory-snapshot] PreCompact: saving knowledge snapshot..." >&2

# ============================================================
# 1. Run extraction on current context (same as Stop hook)
# ============================================================

echo "$INPUT" | bash "$SCRIPT_DIR/memory-extract.sh" 2>/dev/null || true

# ============================================================
# 2. Save compact session state to Obsidian
# ============================================================

if [[ "$VAULT_ENABLED" == "true" && -n "$VAULT_API_KEY" && -n "$VAULT_PROJECT_NAME" ]]; then
  TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
  BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
  LAST_COMMIT=$(git log -1 --pretty=format:"%h %s" 2>/dev/null || echo "none")

  # Count entities created/accessed this session
  SESSION_ENTITIES=$(_sql "SELECT COUNT(*) FROM entities
                           WHERE project = '$VAULT_PROJECT_NAME'
                           AND updated_at > datetime('now', '-2 hours');")
  SESSION_RELATIONS=$(_sql "SELECT COUNT(*) FROM relations
                            WHERE created_at > datetime('now', '-2 hours');")

  # Recent entity summary
  RECENT_ENTITIES=$(_sql "SELECT type, name FROM entities
                          WHERE (project = '$VAULT_PROJECT_NAME' OR project = '_global')
                          AND updated_at > datetime('now', '-2 hours')
                          ORDER BY updated_at DESC LIMIT 10;")

  ENTITY_LIST=""
  while IFS=$'\t' read -r etype ename; do
    [[ -z "$etype" ]] && continue
    ENTITY_LIST="${ENTITY_LIST}
- [${etype}] ${ename}"
  done <<< "$RECENT_ENTITIES"

  SNAPSHOT_PATH="${VAULT_PROJECT_NAME}/sessions/snapshot-$(date '+%Y%m%d-%H%M').md"
  encoded=$(printf '%s' "$SNAPSHOT_PATH" | jq -sRr @uri 2>/dev/null || printf '%s' "$SNAPSHOT_PATH" | sed 's| |%20|g; s|/|%2F|g')

  curl -s -k --max-time 5 \
    "${VAULT_URL}/vault/${encoded}" \
    -X PUT \
    -H "Authorization: Bearer ${VAULT_API_KEY}" \
    -H "Content-Type: text/markdown; charset=utf-8" \
    --data-binary "# PreCompact Snapshot — $TIMESTAMP

- **Branch**: $BRANCH
- **Last Commit**: $LAST_COMMIT
- **Entities (this session)**: $SESSION_ENTITIES new/updated
- **Relations (this session)**: $SESSION_RELATIONS new

## Recent Entities
$ENTITY_LIST

## Context
Compaction triggered — this snapshot preserves session state for continuity.
" > /dev/null 2>&1

  echo "[memory-snapshot] Snapshot saved to vault: $SNAPSHOT_PATH" >&2
fi

# ============================================================
# 3. Run cross-project promotion (lightweight, only for Lessons)
# ============================================================

bash "$SCRIPT_DIR/memory-promote.sh" 2>/dev/null || true

echo "[memory-snapshot] Done." >&2
