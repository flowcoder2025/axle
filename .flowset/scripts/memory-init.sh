#!/usr/bin/env bash
# memory-init.sh — Initialize Graph RAG Memory System
# Creates SQLite schema and Obsidian vault directory structure
# Called from flowset.sh preflight() or manually via /wi:init

export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8

set -euo pipefail

# --- Load config ---
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
: "${VAULT_PROJECT_NAME:=}"
: "${PROJECT_NAME:=}"

# Use PROJECT_NAME if VAULT_PROJECT_NAME is empty
: "${VAULT_PROJECT_NAME:=$PROJECT_NAME}"

# --- Guard ---
if [[ "$GRAPH_MEMORY_ENABLED" != "true" ]]; then
  echo "[memory-init] GRAPH_MEMORY_ENABLED is not true, skipping." >&2
  exit 0
fi

# --- Ensure directory ---
mkdir -p "$(dirname "$GRAPH_DB_PATH")"

# --- Initialize SQLite schema ---
echo "[memory-init] Initializing SQLite graph database at $GRAPH_DB_PATH" >&2

sqlite3 "$GRAPH_DB_PATH" <<'SQL'
-- Enable WAL mode for better concurrency
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

-- Core entity table (nodes)
CREATE TABLE IF NOT EXISTS entities (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    type         TEXT NOT NULL,
    name         TEXT NOT NULL,
    project      TEXT NOT NULL,
    summary      TEXT,
    vault_path   TEXT,
    created_at   TEXT DEFAULT (datetime('now')),
    updated_at   TEXT DEFAULT (datetime('now')),
    access_count INTEGER DEFAULT 0,
    last_accessed TEXT,
    decay_score  REAL DEFAULT 1.0,
    metadata     TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_entity_unique ON entities(type, name, project);
CREATE INDEX IF NOT EXISTS idx_entity_project ON entities(project);
CREATE INDEX IF NOT EXISTS idx_entity_type ON entities(type, project);
CREATE INDEX IF NOT EXISTS idx_entity_decay ON entities(decay_score DESC);

-- Relationships (edges)
CREATE TABLE IF NOT EXISTS relations (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id  INTEGER NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    target_id  INTEGER NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    rel_type   TEXT NOT NULL,
    weight     REAL DEFAULT 1.0,
    evidence   TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_rel_unique ON relations(source_id, target_id, rel_type);
CREATE INDEX IF NOT EXISTS idx_rel_source ON relations(source_id);
CREATE INDEX IF NOT EXISTS idx_rel_target ON relations(target_id);
CREATE INDEX IF NOT EXISTS idx_rel_type ON relations(rel_type);

-- Entity aliases (for resolution)
CREATE TABLE IF NOT EXISTS entity_aliases (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_id INTEGER NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    alias     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_alias_name ON entity_aliases(alias);

-- Retrieval log (access tracking for decay)
CREATE TABLE IF NOT EXISTS retrieval_log (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_id INTEGER NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    query     TEXT,
    context   TEXT,
    timestamp TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_retrieval_entity ON retrieval_log(entity_id);

-- Cross-project knowledge links
CREATE TABLE IF NOT EXISTS cross_project_links (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    source_project TEXT NOT NULL,
    target_project TEXT NOT NULL,
    entity_id      INTEGER NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    link_type      TEXT NOT NULL,
    created_at     TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_cross_project ON cross_project_links(source_project, target_project);
SQL

echo "[memory-init] SQLite schema initialized successfully." >&2

# --- Verify ---
ENTITY_COUNT=$(sqlite3 "$GRAPH_DB_PATH" "SELECT COUNT(*) FROM entities;" 2>/dev/null || echo "0")
REL_COUNT=$(sqlite3 "$GRAPH_DB_PATH" "SELECT COUNT(*) FROM relations;" 2>/dev/null || echo "0")
echo "[memory-init] Current state: $ENTITY_COUNT entities, $REL_COUNT relations" >&2

# --- Initialize Obsidian Vault directories ---
if [[ "$VAULT_ENABLED" == "true" ]] && [[ -n "$VAULT_API_KEY" ]] && [[ -n "$VAULT_PROJECT_NAME" ]]; then
  echo "[memory-init] Creating Obsidian vault directories for project: $VAULT_PROJECT_NAME" >&2

  _vault_ensure_dir() {
    local path="$1"
    local readme_content="$2"
    # Write a minimal README to create the directory
    local status
    status=$(curl -s -k --max-time 5 -o /dev/null -w "%{http_code}" \
      "${VAULT_URL}/vault/${path}/_README.md" \
      -X PUT \
      -H "Authorization: Bearer ${VAULT_API_KEY}" \
      -H "Content-Type: text/markdown" \
      -d "$readme_content" 2>/dev/null)

    if [[ "$status" == "204" || "$status" == "200" ]]; then
      echo "  Created: $path" >&2
    fi
  }

  # Project-specific directories
  _vault_ensure_dir "${VAULT_PROJECT_NAME}/entities/files" "# File Entities\nSource code file references."
  _vault_ensure_dir "${VAULT_PROJECT_NAME}/entities/decisions" "# Decision Entities\nArchitectural decisions with rationale."
  _vault_ensure_dir "${VAULT_PROJECT_NAME}/entities/technologies" "# Technology Entities\nFrameworks, libraries, APIs."
  _vault_ensure_dir "${VAULT_PROJECT_NAME}/patterns" "# Patterns\nCode patterns (good and anti-patterns)."
  _vault_ensure_dir "${VAULT_PROJECT_NAME}/bugs" "# Bugs\nBug reports with root cause and fix."
  _vault_ensure_dir "${VAULT_PROJECT_NAME}/lessons" "# Lessons\nLearnings from failures and corrections."
  _vault_ensure_dir "${VAULT_PROJECT_NAME}/wis" "# Work Items\nWI summaries with linked entities."
  _vault_ensure_dir "${VAULT_PROJECT_NAME}/constraints" "# Constraints\nProject guardrails and limitations."

  # Global directories (cross-project)
  _vault_ensure_dir "_global/technologies" "# Global Technologies\nShared across all projects."
  _vault_ensure_dir "_global/patterns" "# Global Patterns\nPatterns observed in 2+ projects."
  _vault_ensure_dir "_global/lessons" "# Global Lessons\nUniversal learnings."

  echo "[memory-init] Obsidian vault directories created." >&2
else
  if [[ "$VAULT_ENABLED" != "true" ]]; then
    echo "[memory-init] Vault disabled, skipping directory creation." >&2
  elif [[ -z "$VAULT_API_KEY" ]]; then
    echo "[memory-init] No VAULT_API_KEY, skipping directory creation." >&2
  elif [[ -z "$VAULT_PROJECT_NAME" ]]; then
    echo "[memory-init] No VAULT_PROJECT_NAME, skipping directory creation." >&2
  fi
fi

echo "[memory-init] Graph RAG Memory System initialized." >&2
