# Cat Feeding System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the cat level system with a weight-based feeding system where pomodoro completions earn cans that users manually feed to the desktop pet cat.

**Architecture:** New `cat_state` SQLite table stores weight + food inventory. Three new Rust commands handle state retrieval (with lazy metabolism calculation), feeding, and food addition. Frontend bubble system provides personality via state-aware speech bubbles. Cat SVG stays unchanged; weight is displayed numerically.

**Tech Stack:** Rust/rusqlite (backend), React/Zustand/TypeScript (frontend), Tauri IPC

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src-tauri/src/db.rs` | Add `cat_state` table + `CatState` struct |
| Modify | `src-tauri/src/commands.rs` | Add `get_cat_state`, `feed_cat`, `add_food` commands |
| Modify | `src-tauri/src/lib.rs` | Register new commands |
| Modify | `src/types/index.ts` | Remove `CatStage`/`UserData`, add `CatState`/`WeightState` |
| Create | `src/lib/bubbles.ts` | Bubble台词数据 + 选取逻辑 |
| Modify | `src/stores/userStore.ts` | Remove level system, add cat state management |
| Rewrite | `src/pages/Cat.tsx` | Feeding info panel |
| Modify | `src/pages/Timer.tsx` | Fix cat emoji reference to use weight state |
| Modify | `src/components/GlobalTimer.tsx` | Add `add_food` call on pomodoro completion |
| Modify | `src/pet/PetWindow.tsx` | Add feed overlay + timed bubbles |
| Modify | `src/pet/styles.css` | Add feed overlay styles |

---

### Task 1: Add CatState to Database Layer

**Files:**
- Modify: `src-tauri/src/db.rs`

- [ ] **Step 1: Add CatState struct after the ExportData struct (after line 249)**

```rust
// 猫咪状态
#[derive(Debug, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CatState {
    pub weight: f64,
    pub food_inventory: i32,
    pub last_fed_at: String,
    pub last_metabolism_at: String,
}
```

- [ ] **Step 2: Add cat_state table creation in `init_db` function, after the app_state table (after line 74)**

```rust
    // 猫咪状态表
    conn.execute(
        "CREATE TABLE IF NOT EXISTS cat_state (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            weight REAL NOT NULL DEFAULT 2.0,
            food_inventory INTEGER NOT NULL DEFAULT 0,
            last_fed_at TEXT NOT NULL,
            last_metabolism_at TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )",
        [],
    )?;

    // 初始化默认猫咪状态
    conn.execute(
        "INSERT OR IGNORE INTO cat_state (id, weight, food_inventory, last_fed_at, last_metabolism_at)
         VALUES (1, 2.0, 0, datetime('now'), datetime('now'))",
        [],
    )?;
```

- [ ] **Step 3: Verify Rust compiles**

Run: `cd src-tauri && cargo build 2>&1 | tail -5`
Expected: `Finished` without errors

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/db.rs
git commit -m "feat(db): add cat_state table and CatState struct"
```

---

### Task 2: Add Rust Commands for Cat State

**Files:**
- Modify: `src-tauri/src/commands.rs`

- [ ] **Step 1: Add helper function `compute_metabolism` before the `get_cat_state` command**

Add this after the `update_tray_title` function (after line 778):

```rust
// 惰性新陈代谢计算：根据时间差扣除重量
fn compute_metabolism(conn: &rusqlite::Connection) -> Result<CatState, String> {
    let state: CatState = conn.query_row(
        "SELECT weight, food_inventory, last_fed_at, last_metabolism_at FROM cat_state WHERE id = 1",
        [],
        |row| Ok(CatState {
            weight: row.get(0)?,
            food_inventory: row.get(1)?,
            last_fed_at: row.get(2)?,
            last_metabolism_at: row.get(3)?,
        }),
    ).map_err(|e| e.to_string())?;

    // 计算时间差（小时）
    let last_time = chrono::NaiveDateTime::parse_from_str(&state.last_metabolism_at, "%Y-%m-%d %H:%M:%S")
        .map_err(|e| format!("Parse last_metabolism_at error: {}", e))?;
    let now = chrono::Local::now().naive_utc();
    let hours_diff = (now - last_time).num_seconds() as f64 / 3600.0;

    if hours_diff > 0.0 {
        // 每天消耗 0.3kg = 每小时 0.3/24 = 0.0125kg
        let consumption = hours_diff * (0.3 / 24.0);
        let new_weight = (state.weight - consumption).max(1.0);

        conn.execute(
            "UPDATE cat_state SET weight = ?, last_metabolism_at = datetime('now') WHERE id = 1",
            params![new_weight],
        ).map_err(|e| e.to_string())?;

        Ok(CatState {
            weight: new_weight,
            food_inventory: state.food_inventory,
            last_fed_at: state.last_fed_at,
            last_metabolism_at: chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
        })
    } else {
        Ok(state)
    }
}
```

- [ ] **Step 2: Add the three commands after the helper function**

```rust
// 获取猫咪状态
#[tauri::command]
pub fn get_cat_state(app: AppHandle) -> Result<CatState, String> {
    let db_guard = app.state::<DbConnection>();
    let conn = db_guard.0.lock().map_err(|e| format!("Failed to acquire lock: {}", e))?;
    compute_metabolism(&conn)
}

// 喂食猫咪
#[tauri::command]
pub fn feed_cat(app: AppHandle) -> Result<CatState, String> {
    let db_guard = app.state::<DbConnection>();
    let conn = db_guard.0.lock().map_err(|e| format!("Failed to acquire lock: {}", e))?;

    // 先计算新陈代谢
    let current = compute_metabolism(&conn)?;

    if current.food_inventory <= 0 {
        return Err("没有罐头了".to_string());
    }
    if current.weight >= 10.0 {
        return Err("猫咪已经太胖了，不能再喂了".to_string());
    }

    let new_weight = (current.weight + 0.3).min(10.0);
    let new_inventory = current.food_inventory - 1;
    let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();

    conn.execute(
        "UPDATE cat_state SET weight = ?, food_inventory = ?, last_fed_at = ? WHERE id = 1",
        params![new_weight, new_inventory, now],
    ).map_err(|e| e.to_string())?;

    Ok(CatState {
        weight: new_weight,
        food_inventory: new_inventory,
        last_fed_at: now,
        last_metabolism_at: current.last_metabolism_at,
    })
}

// 添加食物（番茄钟完成时调用）
#[tauri::command]
pub fn add_food(app: AppHandle) -> Result<CatState, String> {
    let db_guard = app.state::<DbConnection>();
    let conn = db_guard.0.lock().map_err(|e| format!("Failed to acquire lock: {}", e))?;

    // 先计算新陈代谢
    let current = compute_metabolism(&conn)?;

    conn.execute(
        "UPDATE cat_state SET food_inventory = food_inventory + 1 WHERE id = 1",
        [],
    ).map_err(|e| e.to_string())?;

    Ok(CatState {
        weight: current.weight,
        food_inventory: current.food_inventory + 1,
        last_fed_at: current.last_fed_at,
        last_metabolism_at: current.last_metabolism_at,
    })
}
```

- [ ] **Step 3: Verify Rust compiles**

Run: `cd src-tauri && cargo build 2>&1 | tail -5`
Expected: `Finished` without errors

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/commands.rs
git commit -m "feat(commands): add get_cat_state, feed_cat, add_food commands"
```

---

### Task 3: Register New Commands in lib.rs

**Files:**
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Add the three new commands to `invoke_handler` (after `commands::toggle_pet_window,` on line 233)**

In the `tauri::generate_handler![]` macro, add after `commands::toggle_pet_window,`:

```rust
            // 猫咪喂养
            commands::get_cat_state,
            commands::feed_cat,
            commands::add_food,
```

- [ ] **Step 2: Verify Rust compiles**

Run: `cd src-tauri && cargo build 2>&1 | tail -5`
Expected: `Finished` without errors

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "feat: register cat state commands in invoke handler"
```

---

### Task 4: Update TypeScript Types

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Remove `CatStage` interface (lines 60-66) and `UserData` interface (lines 68-75)**

Delete these interfaces:
```typescript
// 猫咪成长阶段  <-- DELETE lines 60-66
export interface CatStage {
  level: number;
  name: string;
  cansNeeded: number;
  icon: string;
}

// 用户数据（猫咪系统）  <-- DELETE lines 68-75
export interface UserData {
  level: number;
  totalCans: number;
  totalMinutes: number;
  streakDays: number;
  currentTaskId?: number;
}
```

- [ ] **Step 2: Add `CatState` and `WeightState` types where `CatStage` was (line 60)**

```typescript
// 猫咪状态
export interface CatState {
  weight: number;
  foodInventory: number;
  lastFedAt: string;
  lastMetabolismAt: string;
}

// 重量状态标签
export interface WeightState {
  label: string;
  icon: string;
  mood: string;
  color: string;
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npm run build 2>&1 | head -30`
Expected: Errors in `userStore.ts`, `Cat.tsx`, `Timer.tsx` (expected — we fix these in later tasks). The type file itself should be clean.

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(types): replace CatStage/UserData with CatState/WeightState"
```

---

### Task 5: Create Bubble System

**Files:**
- Create: `src/lib/bubbles.ts`

- [ ] **Step 1: Create `src/lib/bubbles.ts` with complete bubble data and selection logic**

```typescript
// 气泡台词分类
interface BubbleLine {
  text: string;
}

interface BubbleCategory {
  id: string;
  trigger: "state_change" | "timer" | "click" | "idle";
  weightRange?: [number, number]; // [min, max) kg
  timeRange?: [number, number];   // [min, max) hours
  lines: BubbleLine[];
  priority: number;
}

const BUBBLES: BubbleCategory[] = [
  // === 状态台词（按重量区间）===
  { id: "thin", trigger: "timer", weightRange: [1.0, 2.0], priority: 10, lines: [
    { text: "好饿...有没有吃的喵..." },
    { text: "感觉轻飘飘的喵..." },
    { text: "主人，我瘦了好多喵..." },
    { text: "肚子在叫喵..." },
  ]},
  { id: "slim", trigger: "timer", weightRange: [2.0, 4.0], priority: 10, lines: [
    { text: "还不错喵~" },
    { text: "今天精神不错喵！" },
    { text: "要不要给我加个餐？" },
    { text: "身体轻盈的感觉喵~" },
  ]},
  { id: "standard", trigger: "timer", weightRange: [4.0, 6.0], priority: 10, lines: [
    { text: "主人最棒了！" },
    { text: "今天也是元气满满的一天喵！" },
    { text: "现在的状态刚刚好喵~" },
    { text: "开开心心每一天喵！" },
    { text: "给你比个心喵~ ❤️" },
  ]},
  { id: "chubby", trigger: "timer", weightRange: [6.0, 8.0], priority: 10, lines: [
    { text: "吃得好饱喵~" },
    { text: "嘿嘿，有点圆润了喵..." },
    { text: "再来一个罐头也没关系吧？" },
    { text: "这个位置好舒服，不想动了喵~" },
  ]},
  { id: "fat", trigger: "timer", weightRange: [8.0, 9.5], priority: 10, lines: [
    { text: "动不了了喵..." },
    { text: "好像...有点胖了喵..." },
    { text: "帮我推一下，翻不过来了喵..." },
    { text: "呼...好累喵..." },
  ]},
  { id: "round", trigger: "timer", weightRange: [9.5, 10.1], priority: 10, lines: [
    { text: "我变成球了喵..." },
    { text: "不要滚我！喵！" },
    { text: "这样也挺好的喵...吧？" },
    { text: "要不要...少吃一点喵？" },
  ]},

  // === 时间情境台词 ===
  { id: "morning", trigger: "timer", timeRange: [6, 9], priority: 5, lines: [
    { text: "早安喵~ 新的一天开始了！" },
    { text: "太阳晒屁股了喵！" },
  ]},
  { id: "forenoon", trigger: "timer", timeRange: [9, 12], priority: 5, lines: [
    { text: "上午工作效率最高喵！" },
    { text: "加油加油喵~" },
  ]},
  { id: "noon", trigger: "timer", timeRange: [12, 14], priority: 5, lines: [
    { text: "该吃午饭了喵~" },
    { text: "午休一下喵，下午更有精神" },
  ]},
  { id: "afternoon", trigger: "timer", timeRange: [14, 18], priority: 5, lines: [
    { text: "下午了喵，坚持住！" },
    { text: "喝口水休息一下吧喵~" },
  ]},
  { id: "evening", trigger: "timer", timeRange: [18, 21], priority: 5, lines: [
    { text: "下班啦喵！辛苦了~" },
    { text: "晚上有什么计划喵？" },
  ]},
  { id: "night", trigger: "timer", timeRange: [21, 24], priority: 5, lines: [
    { text: "该准备睡觉了喵~" },
    { text: "明天还要早起喵！" },
  ]},
  { id: "midnight", trigger: "timer", timeRange: [0, 6], priority: 6, lines: [
    { text: "怎么还不睡喵！熬夜不好的！" },
    { text: "喵...好困...你还不睡吗？" },
  ]},

  // === 点击互动台词 ===
  { id: "click", trigger: "click", priority: 3, lines: [
    { text: "喵？找我什么事？" },
    { text: "摸摸我喵~" },
    { text: "嘿嘿，被发现了喵~" },
    { text: "主人好！喵~" },
    { text: "戳我干嘛喵？" },
    { text: "在呢在呢喵~" },
  ]},

  // === 特殊事件台词 ===
  { id: "feed_success", trigger: "state_change", priority: 20, lines: [
    { text: "谢谢主人喵！好好吃~" },
    { text: "喵呜~ 真香！" },
    { text: "吃饱饱了喵~" },
  ]},
  { id: "got_food", trigger: "state_change", priority: 15, lines: [
    { text: "又有罐头了喵！" },
    { text: "主人好棒！" },
  ]},
  { id: "no_food", trigger: "state_change", priority: 20, lines: [
    { text: "没有罐头了喵...去做个番茄钟吧~" },
  ]},
  { id: "full_weight", trigger: "state_change", priority: 20, lines: [
    { text: "吃不下了喵...我太圆了..." },
  ]},

  // === 空置过久 ===
  { id: "idle_too_long", trigger: "idle", priority: 12, lines: [
    { text: "主人...你还记得我吗？" },
    { text: "好无聊喵...来陪我玩~" },
    { text: "是不是忘记我啦喵？" },
  ]},
];

/**
 * 根据当前状态选取一条气泡台词
 * @param trigger 触发类型
 * @param weight 猫咪当前重量(kg)
 * @param specialId 特殊事件ID (如 "feed_success", "got_food", "no_food", "full_weight")
 */
export function pickBubble(
  trigger: BubbleCategory["trigger"],
  weight: number,
  specialId?: string,
): string {
  const now = new Date();
  const hour = now.getHours();

  // 如果是特殊事件，直接从对应类别选
  if (trigger === "state_change" && specialId) {
    const cat = BUBBLES.find((b) => b.id === specialId);
    if (cat && cat.lines.length > 0) {
      return cat.lines[Math.floor(Math.random() * cat.lines.length)].text;
    }
  }

  // 匹配所有满足条件的类别
  const matched = BUBBLES.filter((b) => {
    if (b.trigger !== trigger) return false;
    if (b.weightRange && (weight < b.weightRange[0] || weight >= b.weightRange[1])) return false;
    if (b.timeRange && (hour < b.timeRange[0] || hour >= b.timeRange[1])) return false;
    return true;
  });

  if (matched.length === 0) {
    // 兜底：从点击台词选
    const fallback = BUBBLES.find((b) => b.id === "click");
    if (fallback && fallback.lines.length > 0) {
      return fallback.lines[Math.floor(Math.random() * fallback.lines.length)].text;
    }
    return "喵~";
  }

  // 按优先级排序，从最高优先级中随机选一条
  matched.sort((a, b) => b.priority - a.priority);
  const top = matched[0];
  return top.lines[Math.floor(Math.random() * top.lines.length)].text;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit src/lib/bubbles.ts 2>&1 | head -10`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/bubbles.ts
git commit -m "feat: add bubble speech system with state/time/click triggers"
```

---

### Task 6: Update UserStore

**Files:**
- Modify: `src/stores/userStore.ts`

- [ ] **Step 1: Replace the entire file content**

The store needs to: remove `CAT_STAGES`/`calculateCatLevel`, remove `userData` field, add `catState` field with `fetchCatState` and `feedCat` actions.

```typescript
import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type { UserConfig, Stats, CatState } from "../types";

interface UserStore {
  // 用户配置
  config: UserConfig | null;
  isLoadingConfig: boolean;

  // 统计数据
  stats: Stats | null;
  isLoadingStats: boolean;

  // 猫咪状态
  catState: CatState | null;

  // 操作
  fetchConfig: () => Promise<void>;
  updateConfig: (updates: Partial<UserConfig>) => Promise<void>;
  fetchStats: () => Promise<void>;
  fetchCatState: () => Promise<void>;
  feedCat: () => Promise<void>;
  exportData: (path: string) => Promise<void>;
  importData: (path: string) => Promise<void>;
  toggleAutoLaunch: (enabled: boolean) => Promise<void>;
  resetConfig: () => Promise<void>;
}

export const useUserStore = create<UserStore>((set, get) => ({
  config: null,
  isLoadingConfig: false,
  stats: null,
  isLoadingStats: false,
  catState: null,

  fetchConfig: async () => {
    set({ isLoadingConfig: true });
    try {
      const config = await invoke<UserConfig>("get_user_config");
      set({ config });
    } finally {
      set({ isLoadingConfig: false });
    }
  },

  updateConfig: async (updates) => {
    await invoke("update_user_config", {
      focusDuration: updates.focusDuration,
      breakDuration: updates.breakDuration,
      enableNotifications: updates.enableNotifications,
      enableSound: updates.enableSound,
      theme: updates.theme,
      longBreakDuration: updates.longBreakDuration,
      autoStart: updates.autoStart,
      dailyGoal: updates.dailyGoal,
      autoLaunch: updates.autoLaunch,
      showDesktopPet: updates.showDesktopPet,
      showDailyGoal: updates.showDailyGoal,
    });
    await get().fetchConfig();
  },

  fetchStats: async () => {
    set({ isLoadingStats: true });
    try {
      const stats = await invoke<Stats>("get_stats");
      set({ stats });
    } finally {
      set({ isLoadingStats: false });
    }
  },

  fetchCatState: async () => {
    try {
      const catState = await invoke<CatState>("get_cat_state");
      set({ catState });
    } catch (e) {
      console.error("fetchCatState failed:", e);
    }
  },

  feedCat: async () => {
    try {
      const catState = await invoke<CatState>("feed_cat");
      set({ catState });
    } catch (e) {
      console.error("feedCat failed:", e);
      throw e;
    }
  },

  exportData: async (path: string) => {
    await invoke("export_data", { path });
  },

  importData: async (path: string) => {
    await invoke("import_data", { path });
    await get().fetchConfig();
    await get().fetchStats();
    await get().fetchCatState();
  },

  toggleAutoLaunch: async (enabled: boolean) => {
    const prevConfig = get().config;
    if (prevConfig) {
      set({ config: { ...prevConfig, autoLaunch: enabled } });
    }
    try {
      await invoke("update_user_config", { autoLaunch: enabled });
      const { enable, disable } = await import("@tauri-apps/plugin-autostart");
      if (enabled) {
        await enable();
      } else {
        await disable();
      }
    } catch {
      if (prevConfig) {
        set({ config: prevConfig });
      }
    }
  },

  resetConfig: async () => {
    const config = await invoke<UserConfig>("reset_user_config");
    set({ config });
  },
}));
```

- [ ] **Step 2: Verify TypeScript compiles (expect errors only in Cat.tsx and Timer.tsx)**

Run: `npx tsc --noEmit 2>&1 | grep -v "Cat.tsx" | grep -v "Timer.tsx" | head -10`
Expected: No errors from userStore.ts

- [ ] **Step 3: Commit**

```bash
git add src/stores/userStore.ts
git commit -m "refactor(userStore): replace level system with cat state management"
```

---

### Task 7: Rewrite Cat Page

**Files:**
- Rewrite: `src/pages/Cat.tsx`

- [ ] **Step 1: Replace entire Cat.tsx with feeding info panel**

```tsx
import { useEffect, useState } from "react";
import { useUserStore } from "../stores/userStore";
import type { WeightState } from "../types";

function getWeightState(weight: number): WeightState {
  if (weight < 2.0) return { label: "骨感", icon: "🦴", mood: "不开心", color: "#FFB6C1" };
  if (weight < 4.0) return { label: "苗条", icon: "🐱", mood: "平静", color: "#98FB98" };
  if (weight < 6.0) return { label: "标准", icon: "😻", mood: "最开心", color: "#4CAF50" };
  if (weight < 8.0) return { label: "微胖", icon: "😺", mood: "满足", color: "#FFA500" };
  if (weight < 9.5) return { label: "胖胖", icon: "🤰", mood: "犯困", color: "#FF6347" };
  return { label: "圆滚滚", icon: "🎱", mood: "懒洋洋", color: "#FF4500" };
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr.replace(" ", "T"));
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "刚刚";
  if (diffMins < 60) return `${diffMins}分钟前`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}小时前`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}天前`;
}

export default function CatPage() {
  const { catState, fetchCatState, feedCat } = useUserStore();
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    fetchCatState();
  }, [fetchCatState]);

  if (!catState) {
    return (
      <div style={{ display: 'flex', height: '50vh', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: 'var(--text-tertiary)', fontSize: '14px' }}>加载中...</span>
      </div>
    );
  }

  const weightState = getWeightState(catState.weight);
  const weightPercent = ((catState.weight - 1) / 9) * 100; // 1-10kg range
  const canFeed = catState.foodInventory > 0 && catState.weight < 10.0;
  const isBest = catState.weight >= 4.0 && catState.weight < 6.0;

  const handleFeed = async () => {
    if (!canFeed) return;
    try {
      await feedCat();
    } catch {
      // Error handled in store
    }
  };

  return (
    <div>
      {/* Cat showcase */}
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <div style={{
          width: '120px',
          height: '120px',
          margin: '0 auto 12px',
          background: 'var(--surface-secondary)',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: isBest ? '2px solid #4CAF50' : '1px solid var(--border-color)',
          boxShadow: isBest ? '0 0 12px rgba(76,175,80,0.15)' : 'none',
        }}>
          <span style={{ fontSize: '64px', lineHeight: '1' }}>🐱</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginBottom: '4px' }}>
          <span style={{ fontSize: '16px' }}>{weightState.icon}</span>
          <span style={{
            fontSize: '15px',
            fontWeight: '600',
            color: weightState.color,
          }}>
            {weightState.label}
          </span>
          {isBest && <span style={{ fontSize: '12px', color: '#4CAF50' }}>⭐</span>}
        </div>
        <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
          心情: {weightState.mood}
        </span>
      </div>

      {/* Weight progress */}
      <div style={{
        background: 'var(--card-bg)',
        borderRadius: 'var(--radius-md)',
        padding: '16px',
        border: '1px solid var(--border-color)',
        marginBottom: '16px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: '500' }}>
            猫咪重量
          </span>
          <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: '600', fontVariantNumeric: 'tabular-nums' }}>
            {catState.weight.toFixed(1)} kg
          </span>
        </div>
        <div className="progress-bar" style={{ marginBottom: '6px' }}>
          <div className="progress-fill" style={{ width: `${weightPercent}%` }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>1 kg</span>
          <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>10 kg</span>
        </div>
      </div>

      {/* Feeding info */}
      <div style={{
        background: 'var(--card-bg)',
        borderRadius: 'var(--radius-md)',
        padding: '16px',
        border: '1px solid var(--border-color)',
        marginBottom: '16px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)' }}>
            喂养信息
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>🥫 罐头库存</span>
            <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: '600', fontVariantNumeric: 'tabular-nums' }}>
              {catState.foodInventory} 个
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>🕐 上次喂食</span>
            <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
              {formatTimeAgo(catState.lastFedAt)}
            </span>
          </div>
        </div>
        <button
          onClick={handleFeed}
          disabled={!canFeed}
          style={{
            width: '100%',
            padding: '10px',
            borderRadius: 'var(--radius-md)',
            border: 'none',
            fontSize: '14px',
            fontWeight: '600',
            cursor: canFeed ? 'pointer' : 'not-allowed',
            background: canFeed ? 'var(--accent-color)' : 'var(--surface-secondary)',
            color: canFeed ? 'white' : 'var(--text-tertiary)',
            transition: 'opacity 0.15s ease',
          }}
        >
          {catState.weight >= 10.0
            ? "吃不下了喵..."
            : catState.foodInventory <= 0
              ? "没有罐头了喵..."
              : `喂食 🥫 ×1`}
        </button>
      </div>

      {/* Feeding guide (collapsible) */}
      <div style={{
        background: 'var(--card-bg)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-color)',
        overflow: 'hidden',
      }}>
        <button
          onClick={() => setShowGuide(!showGuide)}
          style={{
            width: '100%',
            padding: '12px 16px',
            border: 'none',
            background: 'transparent',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: '600',
            color: 'var(--text-secondary)',
          }}
        >
          <span>喂养指南</span>
          <span style={{ fontSize: '12px', transform: showGuide ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
        </button>
        {showGuide && (
          <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginRight: '8px', lineHeight: '1.6' }}>•</span>
              <span style={{ flex: 1, fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                完成一个番茄钟 → 获得 1 个罐头
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginRight: '8px', lineHeight: '1.6' }}>•</span>
              <span style={{ flex: 1, fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                点击桌面猫咪或此页按钮喂食
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginRight: '8px', lineHeight: '1.6' }}>•</span>
              <span style={{ flex: 1, fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                猫咪每天消耗约 0.3kg，需要持续喂养
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginRight: '8px', lineHeight: '1.6' }}>•</span>
              <span style={{ flex: 1, fontSize: '12px', color: '#4CAF50', lineHeight: '1.6', fontWeight: '500' }}>
                ⭐ 保持在 4-6kg 是最佳状态
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles (expect Timer.tsx error only)**

Run: `npx tsc --noEmit 2>&1 | grep -v "Timer.tsx" | head -10`
Expected: No errors from Cat.tsx

- [ ] **Step 3: Commit**

```bash
git add src/pages/Cat.tsx
git commit -m "feat(cat-page): rewrite as feeding info panel with weight display"
```

---

### Task 8: Fix Timer Page Cat Emoji

**Files:**
- Modify: `src/pages/Timer.tsx`

- [ ] **Step 1: Remove `CAT_ICONS` constant (lines 7-13) and update the `catEmoji` line**

Remove:
```typescript
const CAT_ICONS: Record<number, string> = {
  1: "🐱",
  2: "😿",
  3: "😸",
  4: "🙀",
  5: "😾",
};
```

Replace line 52 (`const catEmoji = userData ? CAT_ICONS[userData.level] || CAT_ICONS[1] : CAT_ICONS[1];`) with:

```typescript
const catEmoji = "🐱";
```

- [ ] **Step 2: Update the destructured variables from useUserStore on line 30**

Change:
```typescript
const { config, fetchConfig, userData, stats, fetchStats } = useUserStore();
```

To:
```typescript
const { config, fetchConfig, stats, fetchStats } = useUserStore();
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -10`
Expected: No errors from Timer.tsx (GlobalTimer.tsx may still have issues if it references removed types)

- [ ] **Step 4: Commit**

```bash
git add src/pages/Timer.tsx
git commit -m "fix(timer): replace level-based cat emoji with static emoji"
```

---

### Task 9: Integrate add_food into GlobalTimer

**Files:**
- Modify: `src/components/GlobalTimer.tsx`

- [ ] **Step 1: Add `add_food` call after `record_pomodoro` in the focus completion block**

After line 31 (`}` closing the record_pomodoro catch block), add:

```typescript
      // 添加罐头到库存
      try {
        await invoke("add_food");
      } catch (e) {
        console.error("add_food failed:", e);
      }
```

- [ ] **Step 2: Update the pet notification message on line 63**

Change:
```typescript
try { await emit("pet-notification", { title: '专注完成！', body: msg }); } catch { /* ignore */ }
```

To:
```typescript
try { await emit("pet-notification", { title: '专注完成！获得 1 个罐头 🥫', body: msg }); } catch { /* ignore */ }
```

- [ ] **Step 3: Add fetchCatState call after fetchStats on line 52**

Change:
```typescript
      try { await useUserStore.getState().fetchStats(); } catch { /* ignore */ }
```

To:
```typescript
      try { await useUserStore.getState().fetchStats(); } catch { /* ignore */ }
      try { await useUserStore.getState().fetchCatState(); } catch { /* ignore */ }
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -10`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/components/GlobalTimer.tsx
git commit -m "feat(timer): add food inventory on pomodoro completion"
```

---

### Task 10: Add Feed Overlay and Timed Bubbles to PetWindow

**Files:**
- Modify: `src/pet/PetWindow.tsx`
- Modify: `src/pet/styles.css`

This is the largest task. It adds: click-to-feed overlay, timed random bubbles, idle-too-long detection.

- [ ] **Step 1: Add feed overlay styles to `src/pet/styles.css`**

Append at the end of the file:

```css
/* 喂食浮层 */
.pet-feed-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  background: rgba(255, 248, 240, 0.97);
  border: 2px solid rgba(255, 107, 107, 0.3);
  border-radius: 14px;
  padding: 10px;
  z-index: 10;
  animation: bubbleIn 0.2s ease-out;
  box-shadow: 0 4px 16px rgba(255, 107, 107, 0.15);
}

.pet-feed-weight {
  font-size: 14px;
  font-weight: 700;
  color: #5B352A;
  text-align: center;
  margin-bottom: 4px;
  font-variant-numeric: tabular-nums;
}

.pet-feed-bar {
  height: 4px;
  background: rgba(91, 53, 42, 0.1);
  border-radius: 2px;
  margin-bottom: 6px;
  overflow: hidden;
}

.pet-feed-bar-fill {
  height: 100%;
  background: #F2A65E;
  border-radius: 2px;
  transition: width 0.3s ease;
}

.pet-feed-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 11px;
  color: #666;
}

.pet-feed-btn {
  width: 100%;
  padding: 6px;
  border: none;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s ease;
}

.pet-feed-btn.can-feed {
  background: #FF6B6B;
  color: white;
}

.pet-feed-btn.can-feed:hover {
  opacity: 0.9;
}

.pet-feed-btn.disabled {
  background: rgba(91, 53, 42, 0.08);
  color: #999;
  cursor: not-allowed;
}

/* 气泡台词（简单版） */
.pet-speech {
  background: rgba(255, 248, 240, 0.95);
  border: 2px solid rgba(242, 166, 94, 0.35);
  border-radius: 12px;
  padding: 6px 10px;
  max-width: 140px;
  margin-bottom: 4px;
  box-shadow: 0 4px 12px rgba(242, 166, 94, 0.15);
  animation: bubbleIn 0.3s ease-out;
  font-size: 11px;
  color: #5B352A;
  text-align: center;
  line-height: 1.4;
}
```

- [ ] **Step 2: Rewrite PetWindow.tsx**

```tsx
import { useState, useEffect, useCallback, useRef } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen, emit } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import CatIdle from "./components/CatIdle";
import CatRunning from "./components/CatRunning";
import CatPaused from "./components/CatPaused";
import CatBreak from "./components/CatBreak";
import { pickBubble } from "../lib/bubbles";
import type { CatState } from "../types";
import "./styles.css";

type PetState = "idle" | "running" | "paused" | "break";

interface PetNotification {
  title: string;
  body: string;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export default function PetWindow() {
  const [state, setState] = useState<PetState>("idle");
  const [remaining, setRemaining] = useState(0);
  const [notification, setNotification] = useState<PetNotification | null>(null);
  const [showFeed, setShowFeed] = useState(false);
  const [catState, setCatState] = useState<CatState | null>(null);
  const [speech, setSpeech] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const targetEndTimeRef = useRef<number | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const feedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastInteractionRef = useRef<number>(Date.now());
  const bubbleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchCatState = useCallback(async () => {
    try {
      const result = await invoke<CatState>("get_cat_state");
      setCatState(result);
      return result;
    } catch {
      return null;
    }
  }, []);

  const showSpeech = useCallback((text: string, duration = 5000) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setSpeech(text);
    timerRef.current = setTimeout(() => setSpeech(null), duration);
  }, []);

  // Listen for timer events from main window
  useEffect(() => {
    const unlistenState = listen<{ state: PetState; targetEndTime: number | null }>("timer-state", (event) => {
      setState(event.payload.state);
      targetEndTimeRef.current = event.payload.targetEndTime;
      if (event.payload.targetEndTime) {
        const remaining = Math.max(0, Math.floor((event.payload.targetEndTime - Date.now()) / 1000));
        setRemaining(remaining);
      }
    });

    const unlistenTick = listen<{ remaining: number }>("timer-tick", (event) => {
      setRemaining(event.payload.remaining);
    });

    const unlistenNotification = listen<PetNotification>("pet-notification", (event) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setNotification(event.payload);
      setSpeech(null);
      timerRef.current = setTimeout(() => setNotification(null), 3000);
    });

    return () => {
      unlistenState.then((fn) => fn());
      unlistenTick.then((fn) => fn());
      unlistenNotification.then((fn) => fn());
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Local countdown
  useEffect(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    if (state === "running" && targetEndTimeRef.current) {
      countdownRef.current = setInterval(() => {
        const remaining = Math.max(0, Math.floor((targetEndTimeRef.current! - Date.now()) / 1000));
        setRemaining(remaining);
      }, 1000);
    }
    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    };
  }, [state]);

  // Timed random bubble (every 15-30 minutes)
  useEffect(() => {
    if (bubbleTimerRef.current) clearInterval(bubbleTimerRef.current);

    const schedule = () => {
      const delay = (15 + Math.random() * 15) * 60 * 1000; // 15-30 min
      return setTimeout(async () => {
        const cs = await fetchCatState();
        if (cs) {
          showSpeech(pickBubble("timer", cs.weight), 5000);
        }
      }, delay);
    };

    let timeout: ReturnType<typeof setTimeout>;
    const start = () => {
      timeout = schedule();
    };
    start();

    return () => {
      clearTimeout(timeout);
    };
  }, [fetchCatState, showSpeech]);

  // Click cat → toggle feed overlay
  const handleClick = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    lastInteractionRef.current = Date.now();

    if (showFeed) {
      setShowFeed(false);
      return;
    }

    const cs = await fetchCatState();
    if (cs) {
      setShowFeed(true);
      // Auto-close after 5s
      if (feedTimerRef.current) clearTimeout(feedTimerRef.current);
      feedTimerRef.current = setTimeout(() => setShowFeed(false), 5000);
    }
  }, [showFeed, fetchCatState]);

  // Feed the cat
  const handleFeed = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const result = await invoke<CatState>("feed_cat");
      setCatState(result);
      showSpeech(pickBubble("state_change", result.weight, "feed_success"), 4000);
    } catch (err: unknown) {
      const msg = typeof err === "string" ? err : "喂食失败";
      if (msg.includes("没有罐头")) {
        showSpeech(pickBubble("state_change", catState?.weight ?? 2, "no_food"), 4000);
      } else if (msg.includes("太胖")) {
        showSpeech(pickBubble("state_change", catState?.weight ?? 10, "full_weight"), 4000);
      }
    }
    setShowFeed(false);
  }, [catState, showSpeech]);

  // Close feed overlay on clicking outside
  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setShowFeed(false);
  }, []);

  // Drag
  const handleMouseDown = useCallback(async (e: React.MouseEvent) => {
    if (e.button === 0 && !showFeed) {
      await getCurrentWindow().startDragging();
    }
  }, [showFeed]);

  const handleMouseUp = useCallback(async () => {
    try {
      const position = await getCurrentWindow().innerPosition();
      await emit("pet-dragged", { x: position.x, y: position.y });
    } catch {
      // Ignore
    }
  }, []);

  // Render correct cat component
  const renderCat = () => {
    switch (state) {
      case "running":
        return <CatRunning />;
      case "paused":
        return <CatPaused />;
      case "break":
        return <CatBreak />;
      default:
        return <CatIdle />;
    }
  };

  const showTimer = state !== "idle";

  return (
    <div
      className="pet-container"
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onClick={handleClick}
    >
      {/* Speech bubble */}
      {speech && !notification && !showFeed && (
        <div className="pet-speech">{speech}</div>
      )}

      {/* Notification bubble */}
      {notification && (
        <div className="pet-bubble">
          <div className="pet-bubble-title">{notification.title}</div>
          <div className="pet-bubble-body">{notification.body}</div>
        </div>
      )}

      {/* Feed overlay */}
      {showFeed && catState && (
        <div className="pet-feed-overlay" onClick={handleOverlayClick}>
          <div className="pet-feed-weight">{catState.weight.toFixed(1)} kg</div>
          <div className="pet-feed-bar">
            <div
              className="pet-feed-bar-fill"
              style={{ width: `${((catState.weight - 1) / 9) * 100}%` }}
            />
          </div>
          <div className="pet-feed-info">
            <span>🥫 ×{catState.foodInventory}</span>
            <span>{catState.weight >= 10 ? "MAX" : (10 - catState.weight).toFixed(1) + " kg to max"}</span>
          </div>
          <button
            className={`pet-feed-btn ${catState.foodInventory > 0 && catState.weight < 10 ? "can-feed" : "disabled"}`}
            onClick={handleFeed}
            disabled={catState.foodInventory <= 0 || catState.weight >= 10}
          >
            {catState.weight >= 10
              ? "吃不下了..."
              : catState.foodInventory <= 0
                ? "没有罐头了"
                : "喂食 🥫"}
          </button>
        </div>
      )}

      {renderCat()}
      {showTimer && <span className="pet-timer">{formatTime(remaining)}</span>}
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -10`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/pet/PetWindow.tsx src/pet/styles.css
git commit -m "feat(pet): add feed overlay and timed bubble speech system"
```

---

### Task 11: Final Verification

- [ ] **Step 1: Run full TypeScript check**

Run: `npm run build 2>&1 | tail -20`
Expected: Build succeeds

- [ ] **Step 2: Run Rust build**

Run: `cd src-tauri && cargo build 2>&1 | tail -5`
Expected: `Finished` without errors

- [ ] **Step 3: Run Tauri dev to smoke test**

Run: `npm run tauri dev 2>&1 &`
Expected: App starts, cat page shows weight display, pet window shows cat

Verify:
1. Cat page loads with weight display and feed button
2. Timer page shows 🐱 emoji
3. Pet window shows cat with no errors
4. Click pet cat → feed overlay appears

- [ ] **Step 4: Commit any remaining fixes**

```bash
git add -A
git commit -m "fix: resolve any build or integration issues"
```
