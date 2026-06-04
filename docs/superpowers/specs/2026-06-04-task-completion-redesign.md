# 任务完成机制 + 次数制改造设计

日期: 2026-06-04

## 概述

将任务完成机制从"时间达标自动完成"改为"纯手动完成"，将今日统计和每日目标从小时制改为专注次数制，并统一时间显示格式为 `1h25min` 风格。

## 一、任务操作交互

### 操作映射

| 操作 | 交互方式 | 备注 |
|------|---------|------|
| 完成任务 | 点击左侧圆形 checkbox | 标记为已完成，移入已完成列表 |
| 选为当前任务 | 右侧 ▶ 播放按钮 | 选为当前专注任务 |
| 取消选择 | 已选任务右侧显示 ■ 按钮，点击取消 | toggle 逻辑 |
| 编辑任务 | 点击任务行文字 | 展开编辑面板（不变） |
| 删除任务 | 右键菜单 | 不变 |

### ▶/■ 按钮状态

- 未选中且非当前任务：显示 ▶ 按钮
- 已选为当前任务：显示 ■ 按钮（或高亮填充），点击取消选择
- 已完成任务：不显示按钮

### Checkbox 交互

- 点击 checkbox → 弹出确认（与当前"标记完成"一致）
- 任务完成后 checkbox 变为 ✓ 填充状态

## 二、完成逻辑变更

### 核心规则

1. **任务完成仅手动**：用户点击 checkbox 或右键"标记完成"
2. **放弃专注不记录**：中途放弃的专注会话不写入 `pomodoro_records`，不累加到 `completed_minutes`
3. **完成的专注才累加**：只有完整走完的专注会话才记录并累加到任务的 `completed_minutes`
4. **删除自动完成判定**：移除 `completedMinutes >= Math.round(durationTarget * 60)` 的自动完成逻辑

### 数据流（完成后）

```
用户完成专注
  → record_pomodoro (写入 pomodoro_records + 累加 completed_minutes)
  → add_food (罐头 +1)
  → 刷新统计

用户手动完成任务
  → completeTask (标记 completed = true)
  → 移入已完成列表
```

### 数据流（放弃后）

```
用户放弃专注
  → timerState → idle
  → 不写入 pomodoro_records
  → 不更新 completed_minutes
  → 不刷新统计
```

## 三、时间显示格式

### 格式规则

| 分钟数 | 显示 |
|--------|------|
| 5 | `5min` |
| 25 | `25min` |
| 60 | `1h` |
| 85 | `1h25min` |
| 150 | `2h30min` |

### 显示位置

- 任务列表：`25min / 1h30min`（已专注 / 预估）
- 当前任务卡片：同上
- 已完成任务：仅显示总专注时间 `1h25min`

### 实现函数

```typescript
function formatDuration(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours === 0) return `${mins}min`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h${mins}min`;
}
```

## 四、今日统计 + 每日目标

### 变更

| 项目 | 现状 | 改为 |
|------|------|------|
| 今日概览主指标 | `1.5h` | `3次` |
| 每日目标单位 | 小时 (f64)，默认 2.0 | 次数 (i32)，默认 4 |
| 每日目标进度 | `1.5h / 2h` | `2 / 4 次` |
| Settings 输入 | 小时选择器 (0.5h 步进) | 次数选择器 (1-12) |

### 数据库字段 `daily_goal`

- 类型从 f64 语义改为整数语义
- 实际 SQLite 字段类型不变（REAL），但含义变为次数
- 默认值从 2.0 改为 4
- Settings 页面：数字选择器，范围 1-12

### Stats 页面

- 今日/本周/本月主指标改为专注次数
- 小时数保留为辅助信息（次要显示）

## 五、删除的代码

### GlobalTimer.tsx

- 删除 `handleStopWithProgress` 函数
- 删除 `isStopping` 变量
- 删除放弃监听逻辑（running/paused → idle 的 subscribe 回调中的放弃分支）
- 简化 `handleComplete`：保留 `incrementTaskProgress` 调用（用于同步前端 store），但该函数内部移除 `completed` 自动判定

### taskStore.ts

- `incrementTaskProgress`：移除 `completed` 计算，只做 `completedMinutes` 累加

### commands.rs (Rust)

- `record_pomodoro`：移除 `completed = CASE WHEN ... THEN 1 ELSE completed END`
- 保留 `completed_minutes = completed_minutes + ?`

## 六、影响文件清单

| 文件 | 改动类型 | 具体内容 |
|------|---------|---------|
| `src/components/GlobalTimer.tsx` | 大改 | 删除放弃逻辑，简化完成逻辑 |
| `src/stores/taskStore.ts` | 中改 | 简化 `incrementTaskProgress` |
| `src-tauri/src/commands.rs` | 小改 | `record_pomodoro` 去掉自动完成 SQL |
| `src/pages/Tasks.tsx` | 大改 | checkbox=完成，加 ▶/■ 按钮，新时间格式 |
| `src/pages/Timer.tsx` | 中改 | 今日统计改次数，每日目标改次数 |
| `src/pages/Settings.tsx` | 小改 | 每日目标从小时改为次数 |
| `src/pages/Stats.tsx` | 中改 | 主指标改为次数 |
| `src-tauri/src/db.rs` | 小改 | `daily_goal` 默认值改为 4 |

## 七、不做的事

- 不改 `pomodoro_records` 表结构
- 不改 `tasks` 表结构
- 不改猫咪养成系统
- 不改番茄钟计时器核心逻辑（timerStore）
- 不改数据导入/导出逻辑
