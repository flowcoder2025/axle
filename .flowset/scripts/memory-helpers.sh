#!/usr/bin/env bash
# memory-helpers.sh — Graph RAG Memory System core helpers
# SQLite CRUD, entity resolution, graph traversal, decay
# Source this file from other memory-*.sh scripts

export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8

# --- Configuration ---
: "${GRAPH_MEMORY_ENABLED:=false}"
: "${GRAPH_DB_PATH:=$HOME/.flowset/graph.db}"
: "${VAULT_PROJECT_NAME:=}"

# --- Guard ---
_memory_enabled() {
  [[ "${GRAPH_MEMORY_ENABLED}" == "true" ]] && [[ -f "$GRAPH_DB_PATH" ]]
}

# --- SQLite helper ---
_sql() {
  sqlite3 -separator $'\t' "$GRAPH_DB_PATH" "$1" 2>/dev/null
}

_sql_json() {
  sqlite3 -json "$GRAPH_DB_PATH" "$1" 2>/dev/null
}

# ============================================================
# ENTITY OPERATIONS
# ============================================================

# Upsert an entity (insert or update if exists)
# $1: type (File|Decision|Pattern|Bug|Lesson|WI|Technology|Constraint)
# $2: name (canonical name)
# $3: project
# $4: summary (optional)
# $5: vault_path (optional)
# $6: metadata JSON (optional)
# Returns: entity id
memory_upsert_entity() {
  _memory_enabled || return 0
  local type="${1:?type required}"
  local name="${2:?name required}"
  local project="${3:?project required}"
  local summary="${4:-}"
  local vault_path="${5:-}"
  local metadata="${6:-}"

  # Escape single quotes for SQL
  summary="${summary//\'/\'\'}"
  name="${name//\'/\'\'}"
  vault_path="${vault_path//\'/\'\'}"
  metadata="${metadata//\'/\'\'}"

  _sql "INSERT INTO entities (type, name, project, summary, vault_path, metadata, updated_at)
        VALUES ('$type', '$name', '$project', '$summary', '$vault_path', '$metadata', datetime('now'))
        ON CONFLICT(type, name, project)
        DO UPDATE SET
          summary = CASE WHEN '$summary' != '' THEN '$summary' ELSE summary END,
          vault_path = CASE WHEN '$vault_path' != '' THEN '$vault_path' ELSE vault_path END,
          metadata = CASE WHEN '$metadata' != '' THEN '$metadata' ELSE metadata END,
          updated_at = datetime('now')
        RETURNING id;" | head -1
}

# Find entity by exact name or alias
# $1: name (or alias)
# $2: project (optional, empty = all projects)
# $3: type (optional filter)
# Returns: tab-separated id, type, name, project
memory_find_entity() {
  _memory_enabled || return 0
  local name="${1:?name required}"
  local project="${2:-}"
  local type="${3:-}"

  name="${name//\'/\'\'}"

  local where="WHERE (e.name = '$name' OR a.alias = '$name')"
  [[ -n "$project" ]] && where="$where AND e.project = '$project'"
  [[ -n "$type" ]] && where="$where AND e.type = '$type'"

  _sql "SELECT DISTINCT e.id, e.type, e.name, e.project
        FROM entities e
        LEFT JOIN entity_aliases a ON a.entity_id = e.id
        $where
        LIMIT 5;"
}

# Get entity by ID
# $1: entity id
memory_get_entity() {
  _memory_enabled || return 0
  local id="${1:?id required}"
  _sql "SELECT id, type, name, project, summary, vault_path, decay_score, access_count
        FROM entities WHERE id = $id;"
}

# ============================================================
# RELATIONSHIP OPERATIONS
# ============================================================

# Add a relationship (idempotent — reinforces weight on duplicate)
# $1: source entity id
# $2: target entity id
# $3: rel_type (MODIFIES|DEPENDS_ON|DECIDED|CAUSED_BY|FIXED_BY|LEARNED_FROM|BLOCKED_BY|USES)
# $4: evidence (optional)
memory_add_relation() {
  _memory_enabled || return 0
  local source_id="${1:?source_id required}"
  local target_id="${2:?target_id required}"
  local rel_type="${3:?rel_type required}"
  local evidence="${4:-}"

  evidence="${evidence//\'/\'\'}"

  _sql "INSERT INTO relations (source_id, target_id, rel_type, evidence)
        VALUES ($source_id, $target_id, '$rel_type', '$evidence')
        ON CONFLICT(source_id, target_id, rel_type)
        DO UPDATE SET
          weight = weight + 0.1,
          evidence = CASE WHEN '$evidence' != '' THEN '$evidence' ELSE evidence END,
          updated_at = datetime('now');"
}

# Query 1-hop neighbors of an entity
# $1: entity id
# $2: direction (out|in|both) default: both
# Returns: tab-separated target_id, type, name, rel_type, weight, decay_score
memory_query_neighbors() {
  _memory_enabled || return 0
  local entity_id="${1:?entity_id required}"
  local direction="${2:-both}"

  local query=""
  case "$direction" in
    out)
      query="SELECT e.id, e.type, e.name, r.rel_type, r.weight, e.decay_score
             FROM relations r JOIN entities e ON e.id = r.target_id
             WHERE r.source_id = $entity_id ORDER BY e.decay_score DESC;"
      ;;
    in)
      query="SELECT e.id, e.type, e.name, r.rel_type, r.weight, e.decay_score
             FROM relations r JOIN entities e ON e.id = r.source_id
             WHERE r.target_id = $entity_id ORDER BY e.decay_score DESC;"
      ;;
    both)
      query="SELECT e.id, e.type, e.name, r.rel_type, r.weight, e.decay_score
             FROM relations r JOIN entities e ON e.id = r.target_id
             WHERE r.source_id = $entity_id
             UNION
             SELECT e.id, e.type, e.name, r.rel_type, r.weight, e.decay_score
             FROM relations r JOIN entities e ON e.id = r.source_id
             WHERE r.target_id = $entity_id
             ORDER BY 6 DESC;"
      ;;
  esac

  _sql "$query"
}

# Multi-hop graph traversal (2 hops max)
# $1: entity id
# $2: max_hops (default: 2)
# Returns: tab-separated id, type, name, hop_distance, score
memory_query_graph() {
  _memory_enabled || return 0
  local entity_id="${1:?entity_id required}"
  local max_hops="${2:-2}"

  _sql "WITH RECURSIVE graph_walk(id, type, name, hop, score, visited) AS (
          -- Seed: the starting entity
          SELECT e.id, e.type, e.name, 0, e.decay_score, CAST(e.id AS TEXT)
          FROM entities e WHERE e.id = $entity_id

          UNION ALL

          -- Walk outbound edges
          SELECT e2.id, e2.type, e2.name, gw.hop + 1,
                 e2.decay_score * r.weight * 0.7,
                 gw.visited || ',' || CAST(e2.id AS TEXT)
          FROM graph_walk gw
          JOIN relations r ON r.source_id = gw.id
          JOIN entities e2 ON e2.id = r.target_id
          WHERE gw.hop < $max_hops
            AND INSTR(gw.visited, CAST(e2.id AS TEXT)) = 0

          UNION ALL

          -- Walk inbound edges
          SELECT e2.id, e2.type, e2.name, gw.hop + 1,
                 e2.decay_score * r.weight * 0.7,
                 gw.visited || ',' || CAST(e2.id AS TEXT)
          FROM graph_walk gw
          JOIN relations r ON r.target_id = gw.id
          JOIN entities e2 ON e2.id = r.source_id
          WHERE gw.hop < $max_hops
            AND INSTR(gw.visited, CAST(e2.id AS TEXT)) = 0
        )
        SELECT id, type, name, hop, MAX(score) as score
        FROM graph_walk
        WHERE hop > 0
        GROUP BY id
        ORDER BY score DESC
        LIMIT 20;"
}

# ============================================================
# ALIAS OPERATIONS
# ============================================================

# Add an alias for an entity
# $1: entity id
# $2: alias string
memory_add_alias() {
  _memory_enabled || return 0
  local entity_id="${1:?entity_id required}"
  local alias="${2:?alias required}"
  alias="${alias//\'/\'\'}"

  _sql "INSERT OR IGNORE INTO entity_aliases (entity_id, alias) VALUES ($entity_id, '$alias');"
}

# ============================================================
# ACCESS TRACKING & DECAY
# ============================================================

# Record an entity access (for decay calculation)
# $1: entity id
# $2: query context (optional)
memory_record_access() {
  _memory_enabled || return 0
  local entity_id="${1:?entity_id required}"
  local query="${2:-}"
  query="${query//\'/\'\'}"

  _sql "UPDATE entities SET
          access_count = access_count + 1,
          last_accessed = datetime('now')
        WHERE id = $entity_id;"

  _sql "INSERT INTO retrieval_log (entity_id, query) VALUES ($entity_id, '$query');"
}

# Update decay scores for all entities
# Call this at session/loop start
memory_update_decay() {
  _memory_enabled || return 0

  _sql "UPDATE entities SET decay_score =
        -- base_decay: 0.95^days
        POWER(0.95, JULIANDAY('now') - JULIANDAY(updated_at))
        -- access_boost: min(1.5, 1.0 + 0.1 * recent_accesses)
        * MIN(1.5, 1.0 + 0.1 * (
            SELECT COUNT(*) FROM retrieval_log rl
            WHERE rl.entity_id = entities.id
            AND rl.timestamp > datetime('now', '-7 days')
          ))
        -- link_boost: 1.2 if linked to recently accessed entity
        * CASE WHEN EXISTS (
            SELECT 1 FROM relations r
            JOIN entities e2 ON (e2.id = r.target_id OR e2.id = r.source_id)
            WHERE (r.source_id = entities.id OR r.target_id = entities.id)
            AND e2.id != entities.id
            AND e2.last_accessed > datetime('now', '-1 day')
          ) THEN 1.2 ELSE 1.0 END
        WHERE decay_score > 0.01;"
}

# Archive stale entities (decay < threshold, low access)
# Returns: count of archived entities
memory_archive_stale() {
  _memory_enabled || return 0
  local threshold="${1:-0.05}"
  local min_access="${2:-2}"

  local count
  count=$(_sql "SELECT COUNT(*) FROM entities
                WHERE decay_score < $threshold AND access_count < $min_access;")

  if [[ "$count" -gt 0 ]]; then
    # Get vault paths before deletion (for Obsidian cleanup)
    _sql "SELECT vault_path FROM entities
          WHERE decay_score < $threshold AND access_count < $min_access
          AND vault_path IS NOT NULL AND vault_path != '';"

    _sql "DELETE FROM entities
          WHERE decay_score < $threshold AND access_count < $min_access;"
  fi

  echo "$count"
}

# ============================================================
# QUERY HELPERS
# ============================================================

# Get top entities by decay score for a project
# $1: project
# $2: limit (default: 10)
# $3: type filter (optional)
memory_top_entities() {
  _memory_enabled || return 0
  local project="${1:?project required}"
  local limit="${2:-10}"
  local type="${3:-}"

  local where="WHERE (project = '$project' OR project = '_global')"
  [[ -n "$type" ]] && where="$where AND type = '$type'"

  _sql "SELECT id, type, name, summary, decay_score, vault_path
        FROM entities $where
        ORDER BY decay_score DESC
        LIMIT $limit;"
}

# Count entities by type for a project
memory_stats() {
  _memory_enabled || return 0
  local project="${1:-}"

  local where=""
  [[ -n "$project" ]] && where="WHERE project = '$project'"

  _sql "SELECT type, COUNT(*) as count FROM entities $where GROUP BY type ORDER BY count DESC;"
}

# Search entities by keyword in name or summary
# $1: keyword
# $2: project (optional)
# $3: limit (default: 10)
memory_search() {
  _memory_enabled || return 0
  local keyword="${1:?keyword required}"
  local project="${2:-}"
  local limit="${3:-10}"

  keyword="${keyword//\'/\'\'}"

  local where="WHERE (name LIKE '%$keyword%' OR summary LIKE '%$keyword%')"
  [[ -n "$project" ]] && where="$where AND (project = '$project' OR project = '_global')"

  _sql "SELECT id, type, name, project, summary, decay_score, vault_path
        FROM entities $where
        ORDER BY decay_score DESC
        LIMIT $limit;"
}
