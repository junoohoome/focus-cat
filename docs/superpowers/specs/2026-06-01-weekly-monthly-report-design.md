# Weekly and Monthly Report Design

## Overview

Add weekly and monthly report features to the Pomodoro Cat app's existing Stats page. Reports provide a comprehensive summary of focus sessions, task investment, completion status, and streak data for the current week and month.

## Requirements

- **Location**: Embedded in existing Stats page via Tab switching
- **Time range**: Fixed current period (this week Mon-Sun, this month 1st-last day)
- **Content**: Focus count/duration, per-task investment details, task completion overview, streak days
- **No time-of-day distribution**

## Approach

Extend the existing `get_stats` Rust command to return weekly and monthly report data alongside existing stats. One `invoke` call returns all data; Tab switching is purely frontend behavior with no additional requests.

## Data Layer (Rust Backend)

### Extended `Stats` Struct

```rust
Stats {
    // === Existing fields (unchanged) ===
    today_count: u32,
    today_minutes: u32,
    week_count: u32,
    week_minutes: u32,
    total_count: u32,
    total_minutes: u32,
    daily_data: Vec<DailyStats>,

    // === New: Weekly report ===
    week_start_date: String,       // Monday of current week (YYYY-MM-DD)
    week_end_date: String,         // Sunday of current week (YYYY-MM-DD)
    week_streak_days: u32,         // Consecutive focus days counting back from today
    week_completed_tasks: u32,     // Tasks completed this week
    week_incomplete_tasks: u32,    // Tasks in progress this week
    week_task_breakdown: Vec<TaskReportItem>,
    week_daily_data: Vec<DailyStats>,

    // === New: Monthly report ===
    month_start_date: String,      // 1st of current month (YYYY-MM-DD)
    month_end_date: String,        // Last day of current month (YYYY-MM-DD)
    month_count: u32,              // Focus pomodoros this month
    month_minutes: u32,            // Focus minutes this month
    month_streak_days: u32,        // Consecutive focus days counting back from today
    month_completed_tasks: u32,
    month_incomplete_tasks: u32,
    month_task_breakdown: Vec<TaskReportItem>,
    month_daily_data: Vec<DailyStats>,
}
```

### New `TaskReportItem` Struct

```rust
TaskReportItem {
    task_id: i64,
    task_name: String,
    pomodoro_count: u32,
    focus_minutes: u32,
    is_completed: bool,
}
```

### Streak Days Logic

Calculate consecutive focus days by checking each day from today backwards. Stop when a day has no focus records. The streak value is the same for both weekly and monthly reports (it is a global current streak, not period-scoped).

### SQL Queries (added to `get_stats`)

1. **Streak days** — Query all distinct dates with focus records, check consecutive days from today backwards
2. **Weekly task breakdown** — `JOIN pomodoro_records + tasks WHERE date >= week_start AND date <= week_end AND type = 'focus' GROUP BY task_id`
3. **Weekly completed/incomplete tasks** — Count tasks with activity this week by completion status
4. **Weekly daily data** — `GROUP BY date` for the week range
5. **Monthly summary** — `COUNT/SUM WHERE date >= month_start AND date <= month_end AND type = 'focus'`
6. **Monthly task breakdown** — Same as weekly but with month date range
7. **Monthly completed/incomplete tasks** — Same logic, month range
8. **Monthly daily data** — `GROUP BY date` for the month range

## Frontend (Stats Page)

### Tab Bar

Add a 3-tab switcher at the top of Stats page:

| Tab | Content |
|-----|---------|
| **Overview** | Existing today/week summary + 7-day chart + totals (unchanged) |
| **Weekly Report** | Current week comprehensive report |
| **Monthly Report** | Current month comprehensive report |

### Report Layout (Weekly / Monthly)

From top to bottom:

**1. Period title + date range**
- Weekly: "本周报告 · M/D - M/D"
- Monthly: "本月报告 · M/1 - M/D"

**2. Summary cards (single row)**
- Focus pomodoros count | Focus duration (hours) | Streak days

**3. Task completion overview**
- "已完成 X 个任务 / 进行中 X 个任务"
- Compact progress indicator or numeric display

**4. Daily bar chart**
- Weekly: 7-day chart (reuse existing chart style)
- Monthly: Full month days chart (up to 31 bars)

**5. Task investment breakdown (list)**
- One row per task: task name | pomodoro count | duration | completion badge
- Sorted by pomodoro count descending

### Data Flow

```
Stats.tsx mounts
  → fetchStats() → invoke("get_stats") → returns extended Stats
  → Tab selection determines which fields to render
  → No additional requests on Tab switch
```

## TypeScript Types (`src/types/index.ts`)

```typescript
interface TaskReportItem {
  taskId: number;
  taskName: string;
  pomodoroCount: number;
  focusMinutes: number;
  isCompleted: boolean;
}

// Stats interface extended with all new fields (camelCase via serde)
```

## Files to Modify

| File | Change |
|------|--------|
| `src-tauri/src/commands.rs` | Extend `get_stats` with new SQL queries |
| `src-tauri/src/db.rs` | Add `TaskReportItem` struct |
| `src/types/index.ts` | Add `TaskReportItem`, extend `Stats` interface |
| `src/pages/Stats.tsx` | Add Tab switcher + weekly/monthly report sections |

`src/stores/userStore.ts` requires no changes — the `Stats` type update propagates automatically.
