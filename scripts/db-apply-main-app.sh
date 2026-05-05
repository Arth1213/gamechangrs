#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./db-lib.sh
source "$SCRIPT_DIR/db-lib.sh"

BASELINE_ONLY="no"
DRY_RUN="no"

while [ "$#" -gt 0 ]; do
  case "$1" in
    --baseline-existing)
      BASELINE_ONLY="yes"
      ;;
    --dry-run)
      DRY_RUN="yes"
      ;;
    *)
      echo "Usage: $(basename "$0") [--baseline-existing] [--dry-run]" >&2
      exit 1
      ;;
  esac
  shift
done

PSQL_BIN="$(find_psql)"
resolve_target_config "main-app"
resolve_db_url "main-app"
load_manifest
load_applied_versions

print_status_summary
echo

pending_lines="$(list_pending_entries || true)"
if [ -z "$pending_lines" ]; then
  echo "Nothing to do."
  exit 0
fi

if [ "$DRY_RUN" = "yes" ]; then
  echo "Dry run only. Pending entries:"
  printf '%s\n' "$pending_lines" | sed 's/^/  /'
  exit 0
fi

ensure_tracking_table
load_applied_versions

if [ "$BASELINE_ONLY" = "yes" ]; then
  echo "Baselining existing manifest entries without executing SQL..."
  for idx in "${!MANIFEST_FILES[@]}"; do
    version="${MANIFEST_VERSIONS[$idx]}"
    manifest_file="${MANIFEST_FILES[$idx]}"
    if in_array "$version" "${APPLIED_VERSIONS[@]}"; then
      continue
    fi

    checksum="$(file_checksum "$REPO_ROOT/$manifest_file")"
    escaped_file="$(sql_escape_literal "$manifest_file")"
    escaped_checksum="$(sql_escape_literal "$checksum")"
    "$PSQL_BIN" "$DB_URL" -v ON_ERROR_STOP=1 <<EOF
INSERT INTO ${TRACKING_TABLE} (target, version, filename, checksum_sha256, notes)
VALUES ('main-app', '${version}', '${escaped_file}', '${escaped_checksum}', 'Baseline inserted by $(basename "$0")')
ON CONFLICT (target, version) DO NOTHING;
EOF
    echo "Baselined $version"
  done
  exit 0
fi

echo "Applying pending main-app migrations..."
for idx in "${!MANIFEST_FILES[@]}"; do
  version="${MANIFEST_VERSIONS[$idx]}"
  manifest_file="${MANIFEST_FILES[$idx]}"
  if in_array "$version" "${APPLIED_VERSIONS[@]}"; then
    continue
  fi

  abs_file="$REPO_ROOT/$manifest_file"
  checksum="$(file_checksum "$abs_file")"
  escaped_file="$(sql_escape_literal "$manifest_file")"
  escaped_checksum="$(sql_escape_literal "$checksum")"

  echo "Applying $version -> $manifest_file"
  "$PSQL_BIN" "$DB_URL" -v ON_ERROR_STOP=1 <<EOF
BEGIN;
\i $abs_file
INSERT INTO ${TRACKING_TABLE} (target, version, filename, checksum_sha256, notes)
VALUES ('main-app', '${version}', '${escaped_file}', '${escaped_checksum}', 'Applied by $(basename "$0")')
ON CONFLICT (target, version) DO NOTHING;
COMMIT;
EOF
done
