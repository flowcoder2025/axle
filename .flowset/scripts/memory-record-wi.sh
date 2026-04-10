#!/usr/bin/env bash
# memory-record-wi.sh — Record WI completion as graph entity
# Called from TaskCompleted hook
# Input: stdin (hook JSON with task_subject, task_description)

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
[[ -z "$VAULT_PROJECT_NAME" ]] && exit 0

# --- Load helpers ---
source "$SCRIPT_DIR/memory-helpers.sh" 2>/dev/null || exit 0

# --- Vault write ---
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

# --- Parse input ---
INPUT=$(cat 2>/dev/null || true)

TASK_SUBJECT=$(echo "$INPUT" | jq -r '.task_subject // ""' 2>/dev/null || echo "")
TASK_DESC=$(echo "$INPUT" | jq -r '.task_description // ""' 2>/dev/null || echo "")

# Extract WI pattern
WI_NAME=""
if [[ "$TASK_SUBJECT" =~ (WI-[0-9]{3,4}-[a-z]+) ]]; then
  WI_NAME="${BASH_REMATCH[1]}"
fi

# No WI → not a FlowSet task, skip
[[ -z "$WI_NAME" ]] && exit 0

TIMESTAMP=$(date '+%Y-%m-%d %H:%M')

# --- Get changed files from last commit ---
CHANGED_FILES=$(git diff --name-only HEAD~1 HEAD 2>/dev/null || true)
FILE_COUNT=$(echo "$CHANGED_FILES" | grep -c '[^[:space:]]' 2>/dev/null || echo "0")
LAST_COMMIT_MSG=$(git log -1 --pretty=format:"%s" 2>/dev/null || true)

# --- Extract WI type ---
WI_TYPE=""
if [[ "$WI_NAME" =~ -([a-z]+)$ ]]; then
  WI_TYPE="${BASH_REMATCH[1]}"
fi

# --- Create WI entity ---
VAULT_PATH="${VAULT_PROJECT_NAME}/wis/${WI_NAME}.md"

WI_SUMMARY="$TASK_SUBJECT"
[[ -n "$TASK_DESC" ]] && WI_SUMMARY="$TASK_SUBJECT — $TASK_DESC"

WI_ID=$(memory_upsert_entity "WI" "$WI_NAME" "$VAULT_PROJECT_NAME" "$WI_SUMMARY" "$VAULT_PATH" "{\"type\":\"$WI_TYPE\",\"files_modified\":$FILE_COUNT}")

[[ -z "$WI_ID" ]] && exit 0

echo "[memory-record-wi] Recorded WI entity: $WI_NAME (id=$WI_ID, files=$FILE_COUNT)" >&2

# --- Create MODIFIES relations for changed files ---
RELATIONS_CREATED=0
while IFS= read -r filepath; do
  [[ -z "$filepath" ]] && continue
  case "$filepath" in
    .git/*|node_modules/*|.next/*|dist/*|build/*|*.lock|package-lock.json) continue ;;
  esac

  # Ensure file entity exists
  local file_id
  file_id=$(memory_find_entity "$filepath" "$VAULT_PROJECT_NAME" "File" | head -1 | cut -f1)
  if [[ -z "$file_id" ]]; then
    file_id=$(memory_upsert_entity "File" "$filepath" "$VAULT_PROJECT_NAME" "Modified by $WI_NAME" "" "")
  fi

  if [[ -n "$file_id" ]]; then
    memory_add_relation "$WI_ID" "$file_id" "MODIFIES" "$LAST_COMMIT_MSG"
    RELATIONS_CREATED=$((RELATIONS_CREATED + 1))
  fi
done <<< "$CHANGED_FILES"

# --- Write Obsidian WI page ---
FILE_LINKS=""
while IFS= read -r filepath; do
  [[ -z "$filepath" ]] && continue
  case "$filepath" in
    .git/*|node_modules/*|.next/*|dist/*|build/*|*.lock|package-lock.json) continue ;;
  esac
  local file_slug
  file_slug=$(echo "$filepath" | sed 's|/|-|g; s|\.|-|g')
  FILE_LINKS="${FILE_LINKS}
- [[${file_slug}|${filepath}]]"
done <<< "$CHANGED_FILES"

_vault_put "$VAULT_PATH" "# $WI_NAME

- **Type**: WI ($WI_TYPE)
- **Project**: $VAULT_PROJECT_NAME
- **Completed**: $TIMESTAMP
- **Files Modified**: $FILE_COUNT

## Summary
$WI_SUMMARY

## Commit
\`$LAST_COMMIT_MSG\`

## Modified Files
$FILE_LINKS

## History
- $TIMESTAMP: Completed
"

echo "[memory-record-wi] Created $RELATIONS_CREATED MODIFIES relations." >&2
