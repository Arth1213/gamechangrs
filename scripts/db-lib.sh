#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TRACKING_TABLE="public.codex_schema_migrations"

fail() {
  echo "Error: $*" >&2
  exit 1
}

print_usage_target() {
  cat <<'EOF'
Targets:
  main-app   Main Game-Changrs app Supabase database
  analytics  Bay Area U15 analytics/local-ops database
EOF
}

find_psql() {
  if command -v psql >/dev/null 2>&1; then
    command -v psql
    return 0
  fi

  local candidates="
/opt/homebrew/Cellar/libpq/18.3/bin/psql
/opt/homebrew/bin/psql
/usr/local/bin/psql
"
  local candidate
  for candidate in $candidates; do
    if [ -x "$candidate" ]; then
      echo "$candidate"
      return 0
    fi
  done

  fail "psql not found. Install PostgreSQL client tools or expose psql on PATH."
}

strip_quotes() {
  local value="$1"
  value="${value#\"}"
  value="${value%\"}"
  value="${value#\'}"
  value="${value%\'}"
  echo "$value"
}

read_env_value() {
  local env_file="$1"
  local key="$2"

  if [ ! -f "$env_file" ]; then
    return 0
  fi

  local line
  line="$(grep -E "^${key}=" "$env_file" | tail -n 1 || true)"
  if [ -z "$line" ]; then
    return 0
  fi

  strip_quotes "${line#*=}"
}

resolve_target_config() {
  local target="${1:-}"
  case "$target" in
    main-app)
      TARGET_KEY="main-app"
      TARGET_LABEL="Main app Supabase"
      MANIFEST_PATH="$REPO_ROOT/migration-manifests/main_app_supabase_migrations_2026_05_04.txt"
      ;;
    analytics)
      TARGET_KEY="analytics"
      TARGET_LABEL="Analytics/local-ops"
      MANIFEST_PATH="$REPO_ROOT/migration-manifests/analytics_local_ops_owned_by_azgebbtasywunltdhdby_2026_05_04.txt"
      ;;
    *)
      echo "Unknown target: ${target:-<empty>}" >&2
      print_usage_target >&2
      exit 1
      ;;
  esac

  [ -f "$MANIFEST_PATH" ] || fail "Manifest not found: $MANIFEST_PATH"
}

resolve_db_url() {
  local target="$1"

  if [ "$target" = "main-app" ]; then
    DB_URL="${MAIN_APP_DATABASE_URL:-${SUPABASE_DB_URL_MAIN_APP:-${APP_DATABASE_URL:-}}}"
    DB_URL_SOURCE="env:MAIN_APP_DATABASE_URL"
    [ -n "$DB_URL" ] || fail "Set MAIN_APP_DATABASE_URL for the main app database."
    return 0
  fi

  DB_URL="${ANALYTICS_DATABASE_URL:-${BAY_AREA_U15_DATABASE_URL:-}}"
  DB_URL_SOURCE="env:ANALYTICS_DATABASE_URL"
  if [ -n "$DB_URL" ]; then
    return 0
  fi

  local analytics_env="$REPO_ROOT/bay-area-u15/.env"
  DB_URL="$(read_env_value "$analytics_env" "DATABASE_URL")"
  if [ -n "$DB_URL" ]; then
    DB_URL_SOURCE="$analytics_env:DATABASE_URL"
    return 0
  fi

  fail "Set ANALYTICS_DATABASE_URL or populate bay-area-u15/.env DATABASE_URL."
}

load_manifest() {
  MANIFEST_FILES=()
  MANIFEST_VERSIONS=()

  while IFS= read -r line || [ -n "$line" ]; do
    line="$(printf '%s' "$line" | sed 's/[[:space:]]*$//')"
    [ -n "$line" ] || continue
    case "$line" in
      \#*) continue ;;
    esac

    local abs_path="$REPO_ROOT/$line"
    [ -f "$abs_path" ] || fail "Manifest entry missing on disk: $line"
    MANIFEST_FILES+=("$line")
    MANIFEST_VERSIONS+=("$(basename "$line" | cut -d_ -f1)")
  done < "$MANIFEST_PATH"
}

in_array() {
  local needle="$1"
  shift
  local item
  for item in "$@"; do
    if [ "$item" = "$needle" ]; then
      return 0
    fi
  done
  return 1
}

sql_escape_literal() {
  printf "%s" "$1" | sed "s/'/''/g"
}

file_checksum() {
  local file_path="$1"
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$file_path" | awk '{print $1}'
    return 0
  fi
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$file_path" | awk '{print $1}'
    return 0
  fi
  fail "No SHA256 tool found."
}

psql_query() {
  local sql="$1"
  "$PSQL_BIN" "$DB_URL" -v ON_ERROR_STOP=1 -Atqc "$sql"
}

tracking_table_exists() {
  psql_query "select case when to_regclass('${TRACKING_TABLE}') is not null then 'yes' else 'no' end;" 2>/dev/null
}

ensure_tracking_table() {
  "$PSQL_BIN" "$DB_URL" -v ON_ERROR_STOP=1 <<EOF
CREATE TABLE IF NOT EXISTS ${TRACKING_TABLE} (
  target text NOT NULL,
  version text NOT NULL,
  filename text NOT NULL,
  checksum_sha256 text,
  applied_at timestamptz NOT NULL DEFAULT now(),
  applied_by text NOT NULL DEFAULT current_user,
  notes text,
  PRIMARY KEY (target, version)
);
EOF
}

load_applied_versions() {
  APPLIED_VERSIONS=()

  if [ "$(tracking_table_exists)" != "yes" ]; then
    return 0
  fi

  while IFS= read -r version || [ -n "$version" ]; do
    [ -n "$version" ] || continue
    APPLIED_VERSIONS+=("$version")
  done <<EOF
$(psql_query "select version from ${TRACKING_TABLE} where target = '$(sql_escape_literal "$TARGET_KEY")' order by version;")
EOF
}

print_status_summary() {
  local tracking_state="missing"
  if [ "$(tracking_table_exists)" = "yes" ]; then
    tracking_state="present"
  fi

  local last_tracked="none"
  if [ "${#APPLIED_VERSIONS[@]}" -gt 0 ]; then
    last_tracked="${APPLIED_VERSIONS[${#APPLIED_VERSIONS[@]}-1]}"
  fi

  local pending_count=0
  local manifest_version
  for manifest_version in "${MANIFEST_VERSIONS[@]}"; do
    if ! in_array "$manifest_version" "${APPLIED_VERSIONS[@]}"; then
      pending_count=$((pending_count + 1))
    fi
  done

  echo "Target: $TARGET_LABEL ($TARGET_KEY)"
  echo "Manifest: $MANIFEST_PATH"
  echo "DB URL source: $DB_URL_SOURCE"
  echo "Tracking table: $TRACKING_TABLE ($tracking_state)"
  echo "Tracked versions: ${#APPLIED_VERSIONS[@]}"
  echo "Last tracked version: $last_tracked"
  echo "Pending manifest entries: $pending_count"
}

list_pending_entries() {
  local manifest_file manifest_version
  for idx in "${!MANIFEST_FILES[@]}"; do
    manifest_file="${MANIFEST_FILES[$idx]}"
    manifest_version="${MANIFEST_VERSIONS[$idx]}"
    if ! in_array "$manifest_version" "${APPLIED_VERSIONS[@]}"; then
      echo "$manifest_version $manifest_file"
    fi
  done
}
