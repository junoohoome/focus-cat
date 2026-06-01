# Settings Page Enhancement Design

## Overview

Enhance the Settings page with 5 new features: sidebar settings entry, long break with auto-start, daily goal, data management (export/import/clear), and auto-launch with minimize to tray. Restructure the settings page into organized groups.

## Requirements

1. **Sidebar entry**: Gear icon at bottom of sidebar, links to `/settings`
2. **Long break**: Every 4 pomodoros trigger a long break (configurable duration, default 15 min)
3. **Auto-start next pomodoro**: Toggle to automatically start next focus session after break
4. **Daily goal**: Configurable pomodoro count target (default 8), with progress display and congratulations notification
5. **Data management**: Export all data to JSON, import from JSON, clear all records
6. **Auto-launch**: Boot on system startup + minimize to tray (using `tauri-plugin-autostart`)

## New Config Fields

### Database (`user_config` table)

Add columns via `ALTER TABLE ADD COLUMN` in `init_db` for backward compatibility:

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `long_break_duration` | INTEGER | 15 | Long break duration in minutes |
| `auto_start` | INTEGER | 0 | Auto-start next pomodoro after break |
| `daily_goal` | INTEGER | 8 | Daily pomodoro count target |
| `auto_launch` | INTEGER | 0 | Launch on system startup |

### Rust Struct (`db.rs`)

Extend `UserConfig` with:
```rust
pub long_break_duration: i32,
pub auto_start: bool,
pub daily_goal: i32,
pub auto_launch: bool,
```

### TypeScript Interface (`types/index.ts`)

Extend `UserConfig` with:
```typescript
longBreakDuration: number;
autoStart: boolean;
dailyGoal: number;
autoLaunch: boolean;
```

## Sidebar Entry (App.tsx)

Add a spacer (`flex: 1`) between navigation items and a settings button at the bottom:

```
┌──────────┐
│  🏠 主页  │
│  📋 任务  │
│  🐱 猫咪  │
│  📊 统计  │
│          │  ← flex: 1 spacer
│  ⚙️ 设置  │  ← bottom-aligned gear icon
└──────────┘
```

## Settings Page Layout (Settings.tsx)

Reorganize into grouped cards:

| Group | Settings |
|-------|----------|
| **计时器** | Focus duration, Break duration, Long break duration, Auto-start toggle |
| **目标** | Daily pomodoro goal (number input) |
| **通知** | Enable notifications, Enable sound |
| **外观** | Theme (light/dark/auto) |
| **系统** | Auto-launch + minimize to tray |
| **数据** | Export records, Import records, Clear all data |
| **关于** | Version info |
| **测试模式** | Test mode toggle + clear (dev only, bottom) |

## Long Break Logic

### State (`timerStore`)

Add `completedPomodorosInSession: number` (default 0) to track consecutive focus sessions since last long break.

### Flow

1. Focus session completes → increment `completedPomodorosInSession`
2. Check: `completedPomodorosInSession >= 4`?
   - **Yes**: Next break = long break, duration = `config.longBreakDuration` (default 15 min). After long break, reset `completedPomodorosInSession = 0`
   - **No**: Normal break, duration = `config.breakDuration` (default 5 min)
3. Record all breaks (both normal and long) via `record_pomodoro` with type `"break"`

## Auto-Start Logic

After break countdown ends:
- If `config.autoStart` is `true` → automatically begin next focus session
- If `false` → enter idle state, wait for user to manually start

## Daily Goal

- Config field: `dailyGoal` (default 8)
- Display progress on Timer page: "今日 X / 目标 Y"
- When today's count reaches goal → show congratulations notification

## Data Management

### Export

- Button: "导出数据"
- Rust command: `export_data` → reads `pomodoro_records`, `tasks`, `user_config` → serializes to JSON
- Frontend: Uses `@tauri-apps/plugin-dialog` `save()` to pick save location
- Export format:
```json
{
  "version": 1,
  "exportedAt": "2026-06-01T12:00:00Z",
  "pomodoroRecords": [...],
  "tasks": [...],
  "userConfig": {...}
}
```

### Import

- Button: "导入数据"
- Frontend: Uses `@tauri-apps/plugin-dialog` `open()` to pick JSON file
- Confirmation dialog: "导入将覆盖现有数据，是否继续？"
- Rust command: `import_data` → parses JSON → wraps in transaction → replaces all tables
- After import: refresh all stores

### Clear

- Existing `clear_pomodoro_records` command, moved into data management group

## Auto-Launch + Minimize to Tray

### Dependencies

- `tauri-plugin-autostart` in Cargo.toml
- `@tauri-apps/plugin-autostart` in package.json
- `@tauri-apps/plugin-dialog` for export/import file dialogs

### Behavior

- Setting toggle: "开机启动"
- When enabled: register auto-start via plugin + on app launch, hide main window (tray icon only)
- When disabled: unregister auto-start + on app launch, show main window normally
- `lib.rs`: On startup, read `auto_launch` from DB → if enabled, hide window

### Implementation

- Register `tauri-plugin-autostart` in `lib.rs` with `MacosLauncher::LaunchAgent`
- Toggle auto-start via `autostart.enable()` / `autostart.disable()`
- Window visibility: use `window.hide()` when `auto_launch` is true on startup

## Files to Modify

| File | Change |
|------|--------|
| `src-tauri/Cargo.toml` | Add `tauri-plugin-autostart`, `tauri-plugin-dialog` |
| `src-tauri/tauri.conf.json` | Add dialog plugin permissions |
| `src-tauri/src/lib.rs` | Register plugins, startup window visibility |
| `src-tauri/src/db.rs` | Extend `UserConfig`, `ALTER TABLE` in `init_db` |
| `src-tauri/src/commands.rs` | Extend `update_user_config`, add `export_data`, `import_data` |
| `src/types/index.ts` | Extend `UserConfig` interface |
| `src/stores/userStore.ts` | Add export/import methods |
| `src/stores/timerStore.ts` | Long break counter, auto-start logic |
| `src/pages/Timer.tsx` | Daily goal progress display |
| `src/pages/Settings.tsx` | Restructure with groups, add new settings |
| `src/App.tsx` | Sidebar settings entry |
