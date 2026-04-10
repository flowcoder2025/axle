#!/usr/bin/env bash
# memory-retrieve.sh — Retrieve relevant graph memory at session start
# Called from session-start-vault.sh (SessionStart hook)
# Detects project, WI, intent → queries graph → reads vault pages → returns context
# Output: additionalContext string (not JSON — appended to existing vault context)

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

source "$SCRIPT_DIR/memory-helpers.sh" 2>/dev/null || exit 0

# ============================================================
# 1. DETECT CONTEXT
# ============================================================

# Current branch and WI
CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "")
CURRENT_WI=""
INTENT="GENERAL"

if [[ "$CURRENT_BRANCH" =~ (WI-[0-9]{3,4})-([a-z]+) ]]; then
  CURRENT_WI="${BASH_REMATCH[1]}-${BASH_REMATCH[2]}"
  WI_TYPE="${BASH_REMATCH[2]}"

  # Detect intent from WI type
  case "$WI_TYPE" in
    feat) INTENT="NEW_FEATURE" ;;
    fix)  INTENT="BUG_FIX" ;;
    refactor) INTENT="REFACTOR" ;;
    *) INTENT="GENERAL" ;;
  esac
fi

# If on main/no WI, check fix_plan for next WI
if [[ -z "$CURRENT_WI" ]] && [[ -f ".flowset/fix_plan.md" ]]; then
  NEXT_WI=$(grep -E '^\- \[ \]' ".flowset/fix_plan.md" | head -1 | grep -oE 'WI-[0-9]{3,4}-[a-z]+' || true)
  if [[ -n "$NEXT_WI" ]]; then
    CURRENT_WI="$NEXT_WI"
    if [[ "$NEXT_WI" =~ -([a-z]+)$ ]]; then
      case "${BASH_REMATCH[1]}" in
        feat) INTENT="NEW_FEATURE" ;;
        fix)  INTENT="BUG_FIX" ;;
        refactor) INTENT="REFACTOR" ;;
      esac
    fi
  fi
fi

# Build query from WI name + branch context
QUERY=""
[[ -n "$CURRENT_WI" ]] && QUERY="$CURRENT_WI"
[[ -n "$CURRENT_BRANCH" && "$CURRENT_BRANCH" != "main" ]] && QUERY="$QUERY $CURRENT_BRANCH"

# Fallback: use project name
[[ -z "$QUERY" ]] && QUERY="$VAULT_PROJECT_NAME" && INTENT="EXPLORATION"

# ============================================================
# 2. QUERY GRAPH MEMORY
# ============================================================

RESULTS=$(bash "$SCRIPT_DIR/memory-query.sh" "$QUERY" "$VAULT_PROJECT_NAME" "$INTENT" 2>/dev/null)

# Parse results
RESULT_COUNT=$(echo "$RESULTS" | jq 'length' 2>/dev/null || echo "0")

[[ "$RESULT_COUNT" == "0" ]] && exit 0

# ============================================================
# 3. READ VAULT PAGES FOR TOP RESULTS
# ============================================================

CONTEXT=""
LOADED=0
MAX_LOAD=5

while IFS= read -r entry; do
  [[ -z "$entry" || "$entry" == "null" ]] && continue
  [[ $LOADED -ge $MAX_LOAD ]] && break

  local e_type e_name e_vault e_summary e_score
  e_type=$(echo "$entry" | jq -r '.type // ""' 2>/dev/null)
  e_name=$(echo "$entry" | jq -r '.name // ""' 2>/dev/null)
  e_vault=$(echo "$entry" | jq -r '.vault_path // ""' 2>/dev/null)
  e_summary=$(echo "$entry" | jq -r '.summary // ""' 2>/dev/null)
  e_score=$(echo "$entry" | jq -r '.score // "0"' 2>/dev/null)

  # Try to read vault page content
  VAULT_CONTENT=""
  if [[ -n "$e_vault" && "$VAULT_ENABLED" == "true" && -n "$VAULT_API_KEY" ]]; then
    local encoded_path
    encoded_path=$(printf '%s' "$e_vault" | jq -sRr @uri 2>/dev/null || printf '%s' "$e_vault" | sed 's| |%20|g; s|/|%2F|g')
    VAULT_CONTENT=$(curl -s -k --max-time 3 \
      "${VAULT_URL}/vault/${encoded_path}" \
      -H "Authorization: Bearer ${VAULT_API_KEY}" 2>/dev/null | head -30)

    # Skip if vault returned error
    if echo "$VAULT_CONTENT" | grep -q '"errorCode"' 2>/dev/null; then
      VAULT_CONTENT=""
    fi
  fi

  # Build context entry
  if [[ -n "$VAULT_CONTENT" ]]; then
    CONTEXT+="
--- [${e_type}] ${e_name} (score: ${e_score}) ---
${VAULT_CONTENT}
"
  elif [[ -n "$e_summary" ]]; then
    CONTEXT+="
--- [${e_type}] ${e_name} (score: ${e_score}) ---
${e_summary}
"
  fi

  LOADED=$((LOADED + 1))
done <<< "$(echo "$RESULTS" | jq -c '.[]' 2>/dev/null)"

# ============================================================
# 4. ADD GRAPH STATISTICS
# ============================================================

STATS=$(_sql "SELECT type, COUNT(*) FROM entities
              WHERE project = '$VAULT_PROJECT_NAME' OR project = '_global'
              GROUP BY type ORDER BY COUNT(*) DESC;" 2>/dev/null)

if [[ -n "$STATS" ]]; then
  CONTEXT+="
--- [Graph Memory Stats] ---
"
  while IFS=$'\t' read -r stype scount; do
    CONTEXT+="${stype}: ${scount} entities
"
  done <<< "$STATS"
fi

# ============================================================
# 5. OUTPUT
# ============================================================

if [[ -n "$CONTEXT" ]]; then
  echo ""
  echo "[GRAPH MEMORY — Project: ${VAULT_PROJECT_NAME} | Intent: ${INTENT} | Query: ${QUERY} | Results: ${RESULT_COUNT}]"
  echo "$CONTEXT"
fi
