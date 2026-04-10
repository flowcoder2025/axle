#!/usr/bin/env bash
# memory-query.sh — RRF Fusion search engine for Graph RAG Memory
# Combines SQLite graph traversal + Obsidian text search with intent-based weights
# Usage: bash memory-query.sh <query> [project] [intent]
# Output: JSON array of ranked entities

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

[[ "$GRAPH_MEMORY_ENABLED" != "true" ]] && echo "[]" && exit 0
[[ ! -f "$GRAPH_DB_PATH" ]] && echo "[]" && exit 0

source "$SCRIPT_DIR/memory-helpers.sh" 2>/dev/null || { echo "[]"; exit 0; }

# --- Arguments ---
QUERY="${1:-}"
PROJECT="${2:-$VAULT_PROJECT_NAME}"
INTENT="${3:-GENERAL}"

[[ -z "$QUERY" ]] && echo "[]" && exit 0

# --- Temp files for scoring (avoids bash 3.2 associative array limitation) ---
SCORE_DIR=$(mktemp -d 2>/dev/null || mktemp -d -t 'memquery')
trap "rm -rf '$SCORE_DIR'" EXIT

GRAPH_FILE="$SCORE_DIR/graph.tsv"    # entity_id \t score
SEARCH_FILE="$SCORE_DIR/search.tsv"
RECENCY_FILE="$SCORE_DIR/recency.tsv"
FINAL_FILE="$SCORE_DIR/final.tsv"

touch "$GRAPH_FILE" "$SEARCH_FILE" "$RECENCY_FILE" "$FINAL_FILE"

RRF_K=60

# Intent weights
case "$INTENT" in
  NEW_FEATURE|feat)  W_GRAPH="0.4"; W_SEARCH="0.3"; W_RECENCY="0.3" ;;
  BUG_FIX|fix)       W_GRAPH="0.6"; W_SEARCH="0.2"; W_RECENCY="0.2" ;;
  REFACTOR|refactor)  W_GRAPH="0.5"; W_SEARCH="0.3"; W_RECENCY="0.2" ;;
  EXPLORATION|*)      W_GRAPH="0.3"; W_SEARCH="0.4"; W_RECENCY="0.3" ;;
esac

# ============================================================
# CHANNEL 1: SQLite Graph Query
# ============================================================

run_graph_search() {
  local rank=1

  # Split query into keywords, find seed entities
  for kw in $QUERY; do
    [[ -z "$kw" || ${#kw} -lt 2 ]] && continue
    local kw_escaped="${kw//\'/\'\'}"

    # Direct name/summary match
    local seed_ids
    seed_ids=$(_sql "SELECT id FROM entities
                     WHERE (name LIKE '%${kw_escaped}%' OR summary LIKE '%${kw_escaped}%')
                     AND (project = '$PROJECT' OR project = '_global')
                     ORDER BY decay_score DESC LIMIT 5;")

    # Alias match
    local alias_ids
    alias_ids=$(_sql "SELECT e.id FROM entity_aliases a
                      JOIN entities e ON e.id = a.entity_id
                      WHERE a.alias LIKE '%${kw_escaped}%'
                      AND (e.project = '$PROJECT' OR e.project = '_global')
                      LIMIT 5;")

    local all_seeds
    all_seeds=$(printf '%s\n%s' "$seed_ids" "$alias_ids" | sort -un | grep -v '^$')

    while IFS= read -r sid; do
      [[ -z "$sid" ]] && continue
      # Seed score
      local score
      score=$(awk "BEGIN{printf \"%.6f\", 1.0/($RRF_K+$rank)}")
      echo -e "${sid}\t${score}" >> "$GRAPH_FILE"
      rank=$((rank + 1))

      # 1-hop neighbors
      local neighbors
      neighbors=$(_sql "SELECT e.id, e.decay_score * r.weight * 0.7 as nscore
                        FROM relations r
                        JOIN entities e ON (CASE WHEN r.source_id=$sid THEN r.target_id ELSE r.source_id END) = e.id
                        WHERE (r.source_id = $sid OR r.target_id = $sid)
                        AND e.id != $sid
                        AND (e.project = '$PROJECT' OR e.project = '_global')
                        ORDER BY nscore DESC LIMIT 8;")

      while IFS=$'\t' read -r nid nscore; do
        [[ -z "$nid" ]] && continue
        local rrf
        rrf=$(awk "BEGIN{printf \"%.6f\", $nscore/($RRF_K+$rank)}")
        echo -e "${nid}\t${rrf}" >> "$GRAPH_FILE"
        rank=$((rank + 1))
      done <<< "$neighbors"
    done <<< "$all_seeds"
  done
}

# ============================================================
# CHANNEL 2: Obsidian Text Search
# ============================================================

run_text_search() {
  [[ "$VAULT_ENABLED" != "true" || -z "$VAULT_API_KEY" ]] && return 0

  local encoded_query
  encoded_query=$(printf '%s' "$QUERY" | jq -sRr @uri 2>/dev/null || printf '%s' "$QUERY" | sed 's/ /%20/g')

  local results
  results=$(curl -s -k --max-time 5 \
    "${VAULT_URL}/search/simple/?query=${encoded_query}" \
    -H "Authorization: Bearer ${VAULT_API_KEY}" \
    -X POST 2>/dev/null)

  [[ -z "$results" || "$results" == "[]" ]] && return 0

  local rank=1
  local filenames
  filenames=$(echo "$results" | jq -r '.[].filename // empty' 2>/dev/null | head -15)

  while IFS= read -r filename; do
    [[ -z "$filename" ]] && continue
    local eid
    eid=$(_sql "SELECT id FROM entities
                WHERE vault_path LIKE '%${filename//\'/\'\'}%'
                AND (project = '$PROJECT' OR project = '_global')
                LIMIT 1;")
    if [[ -n "$eid" ]]; then
      local score
      score=$(awk "BEGIN{printf \"%.6f\", 1.0/($RRF_K+$rank)}")
      echo -e "${eid}\t${score}" >> "$SEARCH_FILE"
    fi
    rank=$((rank + 1))
  done <<< "$filenames"
}

# ============================================================
# CHANNEL 3: Recency Boost
# ============================================================

run_recency_boost() {
  local rank=1
  local recent
  recent=$(_sql "SELECT id, decay_score FROM entities
                 WHERE (project = '$PROJECT' OR project = '_global')
                 AND last_accessed > datetime('now', '-3 days')
                 ORDER BY last_accessed DESC LIMIT 15;")

  while IFS=$'\t' read -r rid rdecay; do
    [[ -z "$rid" ]] && continue
    local score
    score=$(awk "BEGIN{printf \"%.6f\", $rdecay/($RRF_K+$rank)}")
    echo -e "${rid}\t${score}" >> "$RECENCY_FILE"
    rank=$((rank + 1))
  done <<< "$recent"
}

# ============================================================
# RRF FUSION
# ============================================================

fuse_scores() {
  # Aggregate scores per entity from each channel, then weighted sum
  {
    # Graph scores × W_GRAPH
    awk -F'\t' -v w="$W_GRAPH" '{scores[$1]+=$2*w} END{for(id in scores) print id"\t"scores[id]}' "$GRAPH_FILE"
    # Search scores × W_SEARCH
    awk -F'\t' -v w="$W_SEARCH" '{scores[$1]+=$2*w} END{for(id in scores) print id"\t"scores[id]}' "$SEARCH_FILE"
    # Recency scores × W_RECENCY
    awk -F'\t' -v w="$W_RECENCY" '{scores[$1]+=$2*w} END{for(id in scores) print id"\t"scores[id]}' "$RECENCY_FILE"
  } | awk -F'\t' '{scores[$1]+=$2} END{for(id in scores) printf "%s\t%.6f\n", id, scores[id]}' \
    | sort -t$'\t' -k2 -rn \
    | head -8 > "$FINAL_FILE"
}

# ============================================================
# EXECUTE
# ============================================================

run_graph_search
run_text_search
run_recency_boost
fuse_scores

# ============================================================
# OUTPUT JSON
# ============================================================

RESULT_COUNT=$(wc -l < "$FINAL_FILE" | tr -d ' ')

if [[ "$RESULT_COUNT" -eq 0 ]]; then
  echo "[]"
  exit 0
fi

echo "["
first=true
while IFS=$'\t' read -r eid score; do
  [[ -z "$eid" ]] && continue

  entity_info=$(_sql "SELECT type, name, project, summary, vault_path, decay_score FROM entities WHERE id = $eid;")
  [[ -z "$entity_info" ]] && continue

  IFS=$'\t' read -r e_type e_name e_project e_summary e_vault e_decay <<< "$entity_info"

  # Record access
  memory_record_access "$eid" "$QUERY" 2>/dev/null

  [[ "$first" == "true" ]] && first=false || echo ","
  e_summary="${e_summary//\"/\\\"}"
  e_name="${e_name//\"/\\\"}"
  printf '  {"id":%s,"type":"%s","name":"%s","project":"%s","summary":"%s","vault_path":"%s","score":"%s","decay":"%s"}' \
    "$eid" "$e_type" "$e_name" "$e_project" "$e_summary" "${e_vault:-}" "$score" "$e_decay"
done < "$FINAL_FILE"
echo ""
echo "]"
