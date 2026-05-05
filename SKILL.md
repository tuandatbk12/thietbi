# EVNHANOI Dashboard — Project Skill

## Project Overview
Single-file HTML dashboard for EVN Hanoi power grid asset management.
- **Main file**: `index.html` (monolithic, ~11,000 lines)
- **Separate files**: `app.js` (7,574 lines), `styles.css` (2,986 lines) — keep in sync with inline versions
- **Database**: Supabase — tables `TongHopThietBi`, `CongTacThiNghiem`, `evn_user_profiles`
- **Auth**: Supabase Auth with roles `admin` / `user`

## Architecture

### Data Flow
```
Supabase → loadStatsFromSupabase() → _chipAllData[]
  ↓ filter via lytFddReset / _lfApply / lytChipToggle
  ↓ _chipFiltered[]
  ↓ _recomputeStatsWithFilter() → DOM stat cards
  ↓ renderChipsSection() / renderChartsSection() / renderTimelineSection()
```

### Key Global Variables
| Variable | Purpose |
|---|---|
| `_chipAllData` | All rows from Supabase (TongHopThietBi) |
| `_chipFiltered` | Filtered subset — NEVER set directly, use `_lfApply()` |
| `_selectedChips` | Set of active device type chips |
| `_lf` | Live filter state `{tram,cap,type,year,opyr,search}` |
| `_tnRawData` / `_tnAllData` | TNĐK (CongTacThiNghiem) data |
| `layout` | Array of section items with `{type, uid, props}` |
| `_bcFDoi/_bcFTram/_bcFYear/_bcFMonth/_bcFType` | KL-tháng filter state |

### Key Functions
| Function | Purpose |
|---|---|
| `lytFddReset(uid)` | Reset ALL filters, reload if empty |
| `_lfApply()` | Apply `_lf` filter → updates `_chipFiltered` |
| `lytChipToggle(type)` | Toggle device-type chip filter |
| `_recomputeStatsWithFilter()` | Recompute all stat cards from `_chipFiltered` |
| `lytBuildScopedNganSets(rows, sourceRows)` | Build ngăn sets by type |
| `lytNormalizeNganLoai(v)` | Normalize Loai_ngan_lo → canonical type string |
| `lytIsMBARow(r)` | Check if row is an MBA device |
| `_buildTramNganGroups(tramName, tRows, allNgans)` | Build grouped ngăn detail for panel |
| `lytStatsCardClick(label, color)` | Open detail panel for a stat card |
| `_lytShowDetailPanel(title, color, totalLine, items)` | Render slide-in detail panel |
| `bcRenderPage(conf, title)` | Render KL-month/year/overdue page |
| `_bcRenderByMonth(conf)` | Build KL-tháng HTML (filter-linked) |

## Voltage Level Colors (CANONICAL)
```javascript
const LYT_CAP_COLORS = {
  '2': '#1565c0',   // 220kV — blue
  '1': '#18ffff',   // 110kV — cyan
  '3': '#00e676',   // 35kV  — green
  '4': '#e040fb',   // 22kV  — magenta
  '9': '#00e676',   // 10kV  — green
  '6': '#00e676',   // 6kV   — green
  '0': '#18ffff',   // TT    — cyan
};
```

## Panel Detail Format
All stat card panels use `_lytShowDetailPanel(title, color, totalLine, items)` where:
```javascript
items = [
  { text: 'Tên nhóm', sub: 'badge text', color: '#hex', detail: ['line1', 'line2'] }
  // or isGroup item:
  { isGroup: true, text: 'GROUP HEADER', color: '#hex' }
]
```
- Items with `detail` array show `+` toggle button
- Click `+` → expands sub-items (hidden by default)
- Text color: `rgba(240,248,255,.97)` (near-white)
- Detail sub-item color: `rgba(235,248,255,.9)`

## Ngăn Classification Logic
```javascript
// lytNormalizeNganLoai returns:
'Ngăn ĐZ' | 'Ngăn XT' | 'Ngăn MBA' | 'Ngăn LL' |
'Ngăn TBN' | 'NgănTD' | 'Ngăn Kháng'

// Special cases:
// TD: Loai_ngan_lo='NgănTD' OR Phan_loai_thiet_bi='MBATD' → active TD
// TBN: Loai_ngan_lo='Ngăn TBN' but no TBN devices → 'chưa khai thác' (not counted)
```

## KL Tháng (Monthly Report)
- **Data source**: `_tnRawData` or `_tnAllData` (CongTacThiNghiem table)
- **Filters**: `_bcFDoi`, `_bcFTram`, `_bcFYear`, `_bcFMonth`, `_bcFType`
- **Applied via**: `const data = rawData.filter(...)` at top of `_bcRenderByMonth`
- **Cascade**: Selecting `Đội` → resets `Trạm` filter; `_bcFTram` must be in filtered list
- **PDF table**: Rows grouped by device type matching PDF template columns T1→T12
- **Year in title**: Uses `_bcFYear || new Date().getFullYear()`

## Common Bug Patterns

### Filter Reset Shows "Không có dữ liệu"
**Cause**: `_chipAllData` is empty after filter clear  
**Fix**: `lytFddReset()` checks `if (!_chipAllData.length)` → calls `loadStatsFromSupabase()`

### Panel Items Show Muted/Grey Text
**Fix**: Use `color:rgba(240,248,255,.97)` for item text, `rgba(235,248,255,.9)` for detail

### Chip Toggle Doesn't Update Timeline/Stats
**Fix**: `lytChipToggle` must call BOTH `renderTimelineSection()` AND `_recomputeStatsWithFilter()`

### KL Tháng Filter Not Linked to Chart/Table
**Fix**: Both chart and PDF table must use `data` (filtered) not `rawData`

## When Making Changes
1. **Run syntax check**: `node --check` on extracted JS
2. **Never break**: `lytBuildScopedNganSets`, `lytNormalizeNganLoai`, `lytIsMBARow`
3. **Always call** `renderTimelineSection()` after filter changes
4. **Panel text**: use rgba near-white, not `var(--text-secondary)` (too dark)
5. **After adding new features**: verify `_recomputeStatsWithFilter()` handles new fields

## File Sync Note
The project has `index.html` (monolithic) + `app.js` + `styles.css` separately.
When editing inline `index.html`, also update the separate files to keep them in sync.
