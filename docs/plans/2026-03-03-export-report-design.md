# 导出统计报表功能设计

## 概述

为番茄专注猫应用添加导出统计报表功能，用户可生成 Markdown 格式的详细报表
用于分享到社交媒体或笔记软件等平台。

## 需求

- **场景**: 报表分享
- **时间范围**: 周报、月报、自定义范围
- **格式**: Markdown
- **内容**: 详细版（统计+任务+每日明细+效率分析）

## 技术方案

采用**纯前端生成**方案：
- Rust 后端提供原始数据查询
- 前端生成 Markdown 字符串
- 通过 Tauri 文件对话框保存

## 数据流架构

```
用户点击"导出报表"
    → 前端弹出选项（时间范围类型、开始/结束日期）
    → 调用 Rust 命令 get_report_data(startDate, endDate)
    → Rust 查询数据库，返回 ReportData 结构
    → 前端生成 Markdown 字符串
    → 调用 Tauri save 对话框保存文件
```

## 数据结构

### Rust 端 (db.rs)

```rust
// 导出报表数据
#[derive(Debug, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReportData {
    pub summary: ReportSummary,
    pub daily_records: Vec<DailyRecord>,
    pub task_stats: Vec<TaskStats>,
    pub hourly_distribution: Vec<HourlyCount>,
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReportSummary {
    pub total_pomodoros: i32,
    pub total_minutes: i32,
    pub completed_tasks: i32,
    pub total_tasks: i32,
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DailyRecord {
    pub date: String,
    pub pomodoro_count: i32,
    pub minutes: i32,
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskStats {
    pub name: String,
    pub target_pomodoros: i32,
    pub completed_pomodoros: i32,
    pub completed: bool,
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HourlyCount {
    pub hour: i32,
    pub count: i32,
}
```

### TypeScript 端 (types/index.ts)

镜像 Rust 结构体定义。

## Markdown 报表格式示例

```markdown
# 番茄专注周报
**时间范围**: 2026-02-24 ~ 2026-03-02

## 统计概览
| 指标 | 数值 |
|------|------|
| 总番茄数 | 42 |
| 总专注时长 | 17小时30分 |
| 完成任务 | 8/12 |

## 每日明细
| 日期 | 番茄数 | 专注时长 |
|------|--------|----------|
| 02-24 | 6 | 2小时30分 |
| 02-25 | 8 | 3小时20分 |
| ... | ... | ... |

## 任务完成情况
| 任务 | 进度 | 状态 |
|------|------|------|
| 完成项目文档 | 4/4 | ✅ |
| 学习新技术 | 2/5 | 🔄 |
| ... | ... | ... |

## 效率分析
**最佳专注时段**:
- 09:00-11:00 (8个番茄)
- 14:00-16:00 (6个番茄)
- 20:00-22:00 (5个番茄)

---
*报表由番茄专注猫自动生成*
```

## 文件修改清单

| 文件 | 修改内容 |
|------|----------|
| `src-tauri/src/db.rs` | 添加 ReportData 相关结构体 |
| `src-tauri/src/commands.rs` | 添加 get_report_data 命令 |
| `src-tauri/src/lib.rs` | 注册新命令到 invoke_handler |
| `src/types/index.ts` | 添加 TypeScript 类型定义 |
| `src/lib/reportGenerator.ts` | **新建** - Markdown 生成逻辑 |
| `src/pages/Stats.tsx` | 添加导出按钮和UI交互 |

## 实现步骤

1. 后端：添加数据结构和查询命令
2. 前端：添加类型定义
3. 前端：实现 Markdown 生成器
4. 前端：集成到统计页面 UI
5. 测试：验证导出功能
