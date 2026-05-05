#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./db-lib.sh
source "$SCRIPT_DIR/db-lib.sh"

TARGET="${1:-}"
[ -n "$TARGET" ] || {
  echo "Usage: $(basename "$0") <target>" >&2
  print_usage_target >&2
  exit 1
}

PSQL_BIN="$(find_psql)"
resolve_target_config "$TARGET"
resolve_db_url "$TARGET"
load_manifest
load_applied_versions

print_status_summary

echo
echo "Manifest entries:"
for idx in "${!MANIFEST_FILES[@]}"; do
  printf '  %s %s\n' "${MANIFEST_VERSIONS[$idx]}" "${MANIFEST_FILES[$idx]}"
done

echo
echo "Pending entries:"
pending_lines="$(list_pending_entries || true)"
if [ -n "$pending_lines" ]; then
  printf '%s\n' "$pending_lines" | sed 's/^/  /'
else
  echo "  none"
fi

if [ "$(tracking_table_exists)" != "yes" ]; then
  echo
  echo "Note: tracking table is missing. Use --baseline-existing with the apply script once the live database already matches the manifest."
fi
