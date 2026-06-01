# 猫咪喂养系统设计文档

> 日期: 2026-06-02
> 状态: 已确认

## 概述

将现有的猫咪等级系统（番茄钟自动升级）替换为喂养系统。用户通过完成番茄钟获得罐头，手动喂给桌面宠物猫咪。猫咪有重量系统（1-10kg），通过新陈代谢随时间消耗重量，需要持续喂养维持。气泡语言系统让猫咪根据状态和时间"说话"。

## 设计决策

| 维度 | 决定 |
|------|------|
| 食物来源 | 番茄钟完成 = 1 个罐头 |
| 喂养方式 | 点击桌面猫咪 → 一键喂食 |
| 重量系统 | 1-10kg，每罐头 +0.3kg，每天消耗约 0.3kg |
| 新陈代谢 | 惰性计算（获取状态时根据时间差扣除），长期不喂变慢但不会死 |
| 猫咪形象 | 不变，始终使用现有 CodexCat SVG |
| 重量展示 | 纯数字 + 进度条 |
| 气泡语言 | 混合触发（状态变化自动 + 点击 + 定时随机 + 空置过久），内容按状态 + 时间分类 |

## 1. 数据模型

### 1.1 新增 `cat_state` 表

```sql
CREATE TABLE IF NOT EXISTS cat_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),  -- 单行表
  weight REAL NOT NULL DEFAULT 2.0,        -- 当前重量 (kg)
  food_inventory INTEGER NOT NULL DEFAULT 0, -- 未喂食的罐头库存
  last_fed_at TEXT NOT NULL,               -- 上次喂食时间 (ISO 8601)
  last_metabolism_at TEXT NOT NULL,        -- 上次新陈代谢计算时间
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

初始化时插入一行默认数据：`weight=2.0, food_inventory=0, last_fed_at=now, last_metabolism_at=now`。

### 1.2 新增 Rust 命令

| 命令 | 参数 | 返回 | 作用 |
|------|------|------|------|
| `get_cat_state` | 无 | `CatState` | 获取猫咪状态（先执行惰性新陈代谢计算） |
| `feed_cat` | 无 | `CatState` | 消耗 1 个库存罐头，`weight += 0.3`，更新 `last_fed_at` |
| `add_food` | 无 | `CatState` | `food_inventory += 1` |

### 1.3 Rust 结构体

```rust
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CatState {
    pub weight: f64,
    pub food_inventory: i32,
    pub last_fed_at: String,
    pub last_metabolism_at: String,
}
```

### 1.4 TypeScript 类型

```typescript
export interface CatState {
  weight: number;
  foodInventory: number;
  lastFedAt: string;
  lastMetabolismAt: string;
}
```

## 2. 惰性新陈代谢计算

每次调用 `get_cat_state` 时执行：

1. 计算 `now - last_metabolism_at` 的小时差
2. 如果时间差 < 0，跳过（时钟回拨保护）
3. 消耗重量 = `小时差 × (0.3 / 24.0)` — 即每天 0.3kg
4. `weight = max(1.0, weight - 消耗重量)`
5. 更新 `last_metabolism_at = now`
6. 返回更新后的状态

`feed_cat` 执行前也先触发新陈代谢计算，确保重量是最新的。

## 3. 重量状态标签

重量不改变猫咪外形，仅用于确定状态标签和气泡内容：

| 重量区间 | 标签 | 图标 | 猫咪心情 | 气泡风格 |
|---------|------|------|---------|---------|
| 1.0 - 2.0 kg | 骨感 | 🦴 | 不开心 | 求喂食、可怜 |
| 2.0 - 4.0 kg | 苗条 | 🐱 | 平静 | 日常闲聊 |
| 4.0 - 6.0 kg | 标准 | 😻 | 最开心 | 活泼撒娇（台词最丰富） |
| 6.0 - 8.0 kg | 微胖 | 😺 | 满足 | 满足慵懒 |
| 8.0 - 9.5 kg | 胖胖 | 🤰 | 犯困 | 懒洋洋 |
| 9.5 - 10.0 kg | 圆滚滚 | 🎱 | 懒洋洋 | 自嘲吐槽 |

TypeScript 函数 `getWeightState(weight: number): WeightState` 返回标签、图标、气泡类别。

## 4. 喂养交互

### 4.1 桌面宠物端

用户点击桌面猫咪时，弹出浮层：

- 显示：猫咪当前重量、重量进度条、库存罐头数、喂食按钮
- 喂食按钮：点击消耗 1 个库存罐头，重量 +0.3kg，库存 -1
- 无库存时：按钮灰显，猫咪说"没有罐头了喵..."
- 达到上限（10kg）时：按钮灰显，猫咪说"吃不下了喵..."
- 浮层 5 秒后自动关闭，或点击外部关闭

### 4.2 主窗口猫咪页面 (`/cat`)

重写为喂养信息面板：

**上半部分：猫咪展示区**
- 现有 CodexCat SVG 大图（不变）
- 重量数值 + 进度条（X.X kg / 10 kg）
- 状态标签（根据重量区间变色）

**下半部分：喂养信息区**
- 库存罐头数
- 上次喂食时间（"2小时前"格式）
- 喂食按钮（有库存时高亮，无库存/满重时灰显）

**底部：折叠的喂养指南**
- 完成番茄钟 → 获得罐头 → 喂给猫咪
- 猫咪每天消耗约 0.3kg
- 4-6kg 是最佳状态

## 5. 气泡语言系统

### 5.1 触发机制

| 触发方式 | 场景 | 频率/条件 |
|---------|------|----------|
| 状态变化自动 | 番茄钟完成、喂食后、重量状态切换 | 即时 |
| 定时自动 | 桌面宠物随机说话 | 每 15-30 分钟 |
| 点击触发 | 用户点击桌面猫咪 | 即时 |
| 空置过久 | 长时间无交互 | 超过 2 小时 |

气泡持续显示 5 秒后自动消失。

**优先级**：状态变化 > 空置过久 > 定时随机

### 5.2 台词库结构

按状态分类，每个状态 3-5 条随机台词：

**🦴 骨感 (1-2kg)**
- "好饿...有没有吃的喵..."
- "感觉轻飘飘的喵..."
- "主人，我瘦了好多喵..."
- "肚子在叫喵..."

**🐱 苗条 (2-4kg)**
- "还不错喵~"
- "今天精神不错喵！"
- "要不要给我加个餐？"
- "身体轻盈的感觉喵~"

**😻 标准 (4-6kg)**
- "主人最棒了！"
- "今天也是元气满满的一天喵！"
- "现在的状态刚刚好喵~"
- "开开心心每一天喵！"
- "给你比个心喵~ ❤️"

**😺 微胖 (6-8kg)**
- "吃得好饱喵~"
- "嘿嘿，有点圆润了喵..."
- "再来一个罐头也没关系吧？"
- "这个位置好舒服，不想动了喵~"

**🤰 胖胖 (8-9.5kg)**
- "动不了了喵..."
- "好像...有点胖了喵..."
- "帮我推一下，翻不过来了喵..."
- "呼...好累喵..."

**🎱 圆滚滚 (9.5-10kg)**
- "我变成球了喵..."
- "不要滚我！喵！"
- "这样也挺好的喵...吧？"
- "要不要...少吃一点喵？"

### 5.3 时间情境台词

| 时间段 | 台词示例 |
|--------|---------|
| 6:00-9:00 | "早安喵~ 新的一天开始了！", "太阳晒屁股了喵！" |
| 9:00-12:00 | "上午工作效率最高喵！", "加油加油喵~" |
| 12:00-14:00 | "该吃午饭了喵~", "午休一下喵，下午更有精神" |
| 14:00-18:00 | "下午了喵，坚持住！", "喝口水休息一下吧喵~" |
| 18:00-21:00 | "下班啦喵！辛苦了~", "晚上有什么计划喵？" |
| 21:00-23:00 | "该准备睡觉了喵~", "明天还要早起喵！" |
| 23:00-6:00 | "怎么还不睡喵！熬夜不好的！", "喵...好困...你还不睡吗？" |

### 5.4 点击互动台词

通用台词池（无紧急状态时使用）：

- "喵？找我什么事？"
- "摸摸我喵~"
- "嘿嘿，被发现了喵~"
- "主人好！喵~"
- "戳我干嘛喵？"
- "在呢在呢喵~"

### 5.5 特殊事件台词

- **喂食成功**："谢谢主人喵！好好吃~", "喵呜~ 真香！", "吃饱饱了喵~"
- **获得罐头**（番茄钟完成）："又有罐头了喵！", "主人好棒！"
- **无库存点击喂食**："没有罐头了喵...去做个番茄钟吧~"
- **已满重点击喂食**："吃不下了喵...我太圆了..."

### 5.6 数据存储

台词以 JSON 格式存储在前端 `src/lib/bubbles.ts`，不经过后端。

```typescript
interface BubbleLine {
  text: string;
}

interface BubbleCategory {
  id: string;
  trigger: 'state_change' | 'timer' | 'click' | 'idle';
  weightRange?: [number, number]; // [min, max) kg
  timeRange?: [number, number];   // [min, max) hours
  lines: BubbleLine[];
  priority: number; // 越高越优先
}
```

选取逻辑：根据当前状态匹配所有满足条件的类别，按优先级排序，从最高优先级类别中随机选一条。

## 6. 与现有系统的集成

### 6.1 番茄钟完成流程

```
现有:
  record_pomodoro → incrementTaskProgress → fetchStats → playCompleteSound

改为:
  record_pomodoro → add_food (food_inventory +1) → incrementTaskProgress
  → fetchStats → fetchCatState → playCompleteSound
  → emit("pet-notification", { title: '专注完成！获得 1 个罐头 🥫' })
```

### 6.2 移除的代码

| 位置 | 移除项 |
|------|--------|
| `src/stores/userStore.ts` | `CAT_STAGES` 数组 |
| `src/stores/userStore.ts` | `calculateCatLevel()` 函数 |
| `src/stores/userStore.ts` | `userData.level` 字段 |
| `src/pages/Cat.tsx` | 等级展示相关 UI |

### 6.3 新增的文件

| 文件 | 内容 |
|------|------|
| `src/lib/bubbles.ts` | 气泡台词数据 + 选取逻辑 |
| `src/types/index.ts` (追加) | `CatState`、`WeightState` 类型 |

### 6.4 修改的文件

| 文件 | 改动 |
|------|------|
| `src-tauri/src/db.rs` | 新增 `cat_state` 表 + `CatState` 结构体 |
| `src-tauri/src/commands.rs` | 新增 `get_cat_state`、`feed_cat`、`add_food` 命令 |
| `src-tauri/src/lib.rs` | 注册新命令到 `invoke_handler![]` |
| `src/types/index.ts` | 新增 `CatState`、`WeightState` 类型 |
| `src/stores/userStore.ts` | 移除等级系统，新增 `fetchCatState`、`feedCat` action |
| `src/pages/Cat.tsx` | 重写为喂养信息面板 |
| `src/components/GlobalTimer.tsx` | 完成时调用 `add_food`，更新通知文案 |
| `src/pet/PetWindow.tsx` | 点击弹出喂食浮层 + 定时气泡逻辑 |

### 6.5 保留不动的系统

- `pomodoro_records` 表 — 继续记录番茄钟历史
- `user_config` 表 — 继续管理用户设置
- `stats` 统计功能 — 继续用于统计页面
- `tasks` 任务系统 — 不受影响
- 桌面宠物猫咪 SVG — 外形不变
- 计时器核心逻辑 — 不受影响

## 7. 初始数据迁移

首次启动时检测 `cat_state` 表是否存在。不存在则创建并插入默认行：

- `weight`: 2.0（苗条状态，新用户起点）
- `food_inventory`: 0
- `last_fed_at`: 当前时间
- `last_metabolism_at`: 当前时间

老用户已有的 `pomodoro_records` 仍然保留，`stats.totalCount` 继续正常统计，但不再用于猫咪等级计算。猫咪重量独立于历史统计数据。
