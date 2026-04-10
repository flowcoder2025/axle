#!/usr/bin/env bash
# memory-decay.sh — Update decay scores and archive stale entities
# Called at flowset.sh loop start (once per session) or manually
# Formula: decay = base_decay × access_boost × link_boost

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

# ============================================================
# 1. UPDATE DECAY SCORES
# ============================================================

echo "[memory-decay] Updating decay scores..." >&2

memory_update_decay

TOTAL=$(_sql "SELECT COUNT(*) FROM entities;")
AVG_DECAY=$(_sql "SELECT ROUND(AVG(decay_score), 3) FROM entities;")
echo "[memory-decay] $TOTAL entities, avg decay: $AVG_DECAY" >&2

# ============================================================
# 2. ARCHIVE STALE ENTITIES
# ============================================================

ARCHIVE_THRESHOLD="${1:-0.05}"
MIN_ACCESS="${2:-2}"

# Get candidates for archival
STALE_COUNT=$(_sql "SELECT COUNT(*) FROM entities
                    WHERE decay_score < $ARCHIVE_THRESHOLD
                    AND access_count < $MIN_ACCESS;")

if [[ "$STALE_COUNT" -gt 0 ]]; then
  echo "[memory-decay] Archiving $STALE_COUNT stale entities (decay < $ARCHIVE_THRESHOLD, access < $MIN_ACCESS)" >&2

  # Get vault paths before deletion (for Obsidian cleanup)
  STALE_PATHS=$(_sql "SELECT vault_path FROM entities
                      WHERE decay_score < $ARCHIVE_THRESHOLD
                      AND access_count < $MIN_ACCESS
                      AND vault_path IS NOT NULL AND vault_path != '';")

  # Move to _archive in Obsidian (if vault enabled)
  if [[ "$VAULT_ENABLED" == "true" && -n "$VAULT_API_KEY" ]]; then
    while IFS= read -r vpath; do
      [[ -z "$vpath" ]] && continue

      # Read content before archiving
      encoded=$(printf '%s' "$vpath" | jq -sRr @uri 2>/dev/null || printf '%s' "$vpath" | sed 's| |%20|g; s|/|%2F|g')
      content=$(curl -s -k --max-time 3 \
        "${VAULT_URL}/vault/${encoded}" \
        -H "Authorization: Bearer ${VAULT_API_KEY}" 2>/dev/null)

      # Skip if error or empty
      echo "$content" | grep -q '"errorCode"' 2>/dev/null && continue
      [[ -z "$content" ]] && continue

      # Write to _archive/ with timestamp
      archive_path="_archive/$(date '+%Y%m')/$(basename "$vpath")"
      archive_encoded=$(printf '%s' "$archive_path" | jq -sRr @uri 2>/dev/null || printf '%s' "$archive_path" | sed 's| |%20|g; s|/|%2F|g')
      curl -s -k --max-time 3 \
        "${VAULT_URL}/vault/${archive_encoded}" \
        -X PUT \
        -H "Authorization: Bearer ${VAULT_API_KEY}" \
        -H "Content-Type: text/markdown; charset=utf-8" \
        --data-binary "$content" > /dev/null 2>&1

      # Delete original
      curl -s -k --max-time 3 \
        "${VAULT_URL}/vault/${encoded}" \
        -X DELETE \
        -H "Authorization: Bearer ${VAULT_API_KEY}" > /dev/null 2>&1

    done <<< "$STALE_PATHS"
  fi

  # Delete from SQLite
  _sql "DELETE FROM entities
        WHERE decay_score < $ARCHIVE_THRESHOLD
        AND access_count < $MIN_ACCESS;"

  echo "[memory-decay] Archived $STALE_COUNT entities." >&2
else
  echo "[memory-decay] No stale entities to archive." >&2
fi

# ============================================================
# 3. CLEAN OLD RETRIEVAL LOGS (keep last 30 days)
# ============================================================

OLD_LOGS=$(_sql "SELECT COUNT(*) FROM retrieval_log
                 WHERE timestamp < datetime('now', '-30 days');")

if [[ "$OLD_LOGS" -gt 0 ]]; then
  _sql "DELETE FROM retrieval_log WHERE timestamp < datetime('now', '-30 days');"
  echo "[memory-decay] Cleaned $OLD_LOGS old retrieval logs." >&2
fi

echo "[memory-decay] Done." >&2
