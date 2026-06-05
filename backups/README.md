# DB Backups (Auto)

Tự động backup hàng tuần (Chủ nhật 2h sáng VN) bởi GitHub Actions.
Workflow: .github/workflows/backup-db.yml
Script: .github/scripts/backup_db.py
Tables: bbtn_records, bbtn_alerts, CongTacThiNghiem, TongHopThietBi, nas_health_log
Cron: 0 19 * * 6 (Thứ 7 19:00 UTC = CN 2h sáng VN)
Giữ tối đa 12 backups gần nhất.

Backup KHÔNG chứa auth.* (user, password) - chỉ data business.
