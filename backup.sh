#!/usr/bin/env bash
set -euo pipefail

# สร้างชื่อไฟล์ UTC และโฟลเดอร์สำรองข้างชุดติดตั้ง
stamp="$(date -u +%Y%m%d-%H%M%S)"
container_file="/tmp/it-ledger-${stamp}.dump"
backup_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/backups"
backup_file="${backup_dir}/it-ledger-${stamp}.dump"
mkdir -p "$backup_dir"

# pg_dump ทำงานใน container; docker compose cp นำไฟล์ออกมาเก็บบน host
docker compose exec -T db pg_dump -U ledger_app -d it_ledger -F c -f "$container_file"
docker compose cp "db:${container_file}" "$backup_file"
docker compose exec -T db rm -f "$container_file"
printf 'Backup created: %s\n' "$backup_file"
