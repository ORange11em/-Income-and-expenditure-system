$ErrorActionPreference = 'Stop'
# ตั้งชื่อไฟล์ตามเวลา UTC เพื่อไม่ให้ backup รอบก่อนถูกเขียนทับ
$stamp = [DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss')
$containerFile = "/tmp/it-ledger-$stamp.dump"
$backupDir = Join-Path $PSScriptRoot 'backups'
$backupFile = Join-Path $backupDir "it-ledger-$stamp.dump"

New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
# สร้าง custom-format dump ใน container แล้วคัดลอกกลับมาไว้ใน backups บน host
docker compose exec -T db pg_dump -U ledger_app -d it_ledger -F c -f $containerFile
if ($LASTEXITCODE -ne 0) { throw 'Database backup failed.' }
docker compose cp "db:$containerFile" $backupFile
if ($LASTEXITCODE -ne 0) { throw 'Copying the database backup failed.' }
docker compose exec -T db rm -f $containerFile
if ($LASTEXITCODE -ne 0) { Write-Warning 'Temporary backup remains in the database container.' }
Write-Output "Backup created: $backupFile"
