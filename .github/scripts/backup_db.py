#!/usr/bin/env python3
"""V88: Backup các bảng business sang CSV."""
import os, sys, urllib.request, urllib.parse, json, csv
from datetime import datetime, timezone

SB_URL = os.environ['SUPABASE_URL'].rstrip('/')
SB_KEY = os.environ['SUPABASE_KEY']

# Chỉ backup các bảng business (KHÔNG dump auth.*, KHÔNG password)
TABLES = [
    'bbtn_records',
    'bbtn_alerts',
    'CongTacThiNghiem',
    'TongHopThietBi',
    'nas_health_log',
]

PAGE_SIZE = 1000

def fetch_all(table):
    """Fetch all rows từ bảng, paginate qua Range header."""
    rows = []
    offset = 0
    while True:
        url = f"{SB_URL}/rest/v1/{urllib.parse.quote(table)}?select=*&limit={PAGE_SIZE}&offset={offset}"
        req = urllib.request.Request(url, headers={
            'apikey': SB_KEY,
            'Authorization': f'Bearer {SB_KEY}',
            'Accept': 'application/json',
        })
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                batch = json.load(resp)
        except urllib.error.HTTPError as e:
            print(f"  ❌ HTTP {e.code}: {e.read().decode()[:200]}")
            return rows
        if not batch:
            break
        rows.extend(batch)
        if len(batch) < PAGE_SIZE:
            break
        offset += PAGE_SIZE
        print(f"  ... {len(rows)} rows fetched")
    return rows

def write_csv(table, rows, out_dir):
    """Ghi CSV. Nếu không có rows, tạo file trống có header chưa biết."""
    safe_name = table.replace('/', '_')
    path = os.path.join(out_dir, f"{safe_name}.csv")
    if not rows:
        open(path, 'w', encoding='utf-8').write('')
        return 0
    # Lấy tất cả keys (union)
    keys = set()
    for r in rows: keys.update(r.keys())
    keys = sorted(keys)
    with open(path, 'w', encoding='utf-8', newline='') as f:
        w = csv.DictWriter(f, fieldnames=keys, extrasaction='ignore')
        w.writeheader()
        for r in rows:
            # Convert dict/list to JSON string
            row_clean = {}
            for k, v in r.items():
                if isinstance(v, (dict, list)):
                    row_clean[k] = json.dumps(v, ensure_ascii=False)
                else:
                    row_clean[k] = v
            w.writerow(row_clean)
    return len(rows)

def main():
    date_str = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    out_dir = os.path.join('backups', date_str)
    os.makedirs(out_dir, exist_ok=True)
    print(f"📦 Backup → {out_dir}")
    summary = [f"Backup snapshot: {datetime.now(timezone.utc).isoformat()}"]
    total = 0
    for t in TABLES:
        print(f"  → {t}")
        rows = fetch_all(t)
        n = write_csv(t, rows, out_dir)
        summary.append(f"  {t}: {n} rows")
        total += n
        print(f"    ✓ {n} rows")
    summary.append(f"\nTotal: {total} rows across {len(TABLES)} tables")
    with open(os.path.join(out_dir, '_SUMMARY.txt'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(summary))
    print(f"\n✅ Done. Total: {total} rows")

if __name__ == '__main__':
    main()
