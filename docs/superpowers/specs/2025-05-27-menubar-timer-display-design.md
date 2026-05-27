# 菜单栏时间显示功能修复设计

## 概述

修复番茄专注猫应用的macOS菜单栏时间显示功能，使其能够在计时过程中显示剩余时间，空闲时显示猫咪logo图标。

## 问题分析

### 当前状态
- **问题**: `update_tray_title` 函数为空实现，无法更新菜单栏标题
- **表现**: 菜单栏始终显示emoji 🐱，无法看到计时进度
- **影响**: 用户无法通过菜单栏了解计时状态

### 根本原因
```rust
// src-tauri/src/commands.rs:409
pub fn update_tray_title(app: AppHandle, title: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        // 使用 Tauri 的事件系统发送更新消息
        // 由于直接获取 tray icon 比较困难，我们暂时返回成功
        // 实际的菜单栏标题更新可以在 Tauri 支持更好的 API 时实现
    }
    Ok(())  // ← 问题：空实现
}
```

### 技术限制
- TrayIcon 创建后没有保存引用，无法后续更新
- 缺少状态管理机制来维持 TrayIcon 实例

## 解决方案设计

### 用户需求
经过用户确认的显示规范：

| 状态 | 显示内容 | 说明 |
|------|----------|------|
| **空闲** | 🐱 猫咪logo图标 | 使用 32x32.png 图标文件 |
| **运行** | 🍅 24:00 | Emoji + 剩余时间 |
| **暂停** | ⏸️ 24:00 | 暂停图标 + 剩余时间 |
| **完成** | 🐱 猫咪logo图标 | 恢复空闲状态 |

### 技术架构

```
┌─────────────────┐
│   timerStore    │
│  (前端状态管理)  │
└────────┬────────┘
         │ invoke("update_tray_title", title)
         ▼
┌─────────────────┐
│  Rust Commands  │
│update_tray_title│
│  (commands.rs)  │
└────────┬────────┘
         │ TrayIconState.set_title()
         ▼
┌─────────────────┐
│  TrayIconState  │
│  (全局状态)     │
│ Arc<Mutex<Tray>> │
└────────┬────────┘
         │ tray.set_title()
         ▼
┌─────────────────┐
│ macOS Menu Bar  │
│   🐱 或 🍅 24:00│
└─────────────────┘
```

### 核心组件设计

#### 1. TrayIcon 全局状态管理

**挑战**: Tauri 2 的 `TrayIcon` 在 `setup` 函数结束后会被销毁，无法直接存储引用。

**解决方案**: 使用 Tauri 的内部 tray 管理机制

```rust
use std::sync::Arc;
use tauri::{Manager, AppHandle};

#[derive(Clone)]
pub struct TrayIconState(pub Arc<AppHandle>);

impl TrayIconState {
    pub fn new(app: &AppHandle) -> Self {
        Self(app.clone())
    }
    
    /// 更新菜单栏显示
    pub fn update_tray(&self, title: &str) {
        let app = self.0.clone();
        
        #[cfg(target_os = "macos")]
        {
            // 移除旧的 tray icon
            let _ = app.remove_tray_by_id("main-tray");
            
            // 创建新的 tray icon（带新标题）
            if title.is_empty() {
                // 显示图标模式
                let _ = self.create_tray_icon(app, "🐱");
            } else {
                // 显示文字模式
                let _ = self.create_tray_icon(app, title);
            }
        }
    }
    
    #[cfg(target_os = "macos")]
    fn create_tray_icon(&self, app: &AppHandle, title: &str) -> Result<(), String> {
        use tauri::tray::{TrayIconBuilder, TrayIconEvent};
        use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
        
        // 重新创建菜单（需要每次重建）
        let show_item = MenuItem::with_id(app, "show", "显示窗口", true, None::<&str>)
            .map_err(|e| e.to_string())?;
        let hide_item = MenuItem::with_id(app, "hide", "隐藏窗口", true, None::<&str>)
            .map_err(|e| e.to_string())?;
        let sep1 = PredefinedMenuItem::separator(app)
            .map_err(|e| e.to_string())?;
        let quit_item = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)
            .map_err(|e| e.to_string())?;
        
        let menu = Menu::with_items(app, &[&show_item, &hide_item, &sep1, &quit_item])
            .map_err(|e| e.to_string())?;
        
        let _tray = TrayIconBuilder::new()
            .id("main-tray")
            .menu(&menu)
            .menu_on_left_click(false)
            .title(title)
            .build(app)
            .map_err(|e| e.to_string())?;
            
        Ok(())
    }
}
```

#### 2. 命令实现

**文件**: `src-tauri/src/commands.rs`

```rust
/// 更新菜单栏标题（显示计时时间或恢复图标）
#[tauri::command]
pub fn update_tray_title(state: State<TrayIconState>, title: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        state.update_tray(&title);
    }
    Ok(())
}
```

#### 3. 应用集成

**文件**: `src-tauri/src/lib.rs`

**关键修改点**:
1. 创建 TrayIconState 实例
2. 保存 TrayIcon 引用到状态中
3. 注册状态到 app.manage()
4. 传递状态给命令处理函数

### 前端调用逻辑

**文件**: `src/stores/timerStore.ts`

```typescript
async function updateTrayTitle(state, remainingSeconds, type) {
  try {
    let title = "🐱"; // 默认显示猫咪logo

    if (state === "running") {
      const timeStr = formatTime(remainingSeconds);
      const emoji = type === "focus" ? "🍅" : "☕";
      title = `${emoji} ${timeStr}`;
    } else if (state === "paused") {
      const timeStr = formatTime(remainingSeconds);
      title = `⏸️ ${timeStr}`;
    }

    await invoke("update_tray_title", { title });
  } catch (e) {
    // macOS only - ignore errors on other platforms
    console.warn('Tray update failed:', e);
  }
}
```

**逻辑说明**:
- **空闲状态**: `title = "🐱"` → 重新创建带emoji的tray icon
- **运行状态**: `title = "🍅 24:00"` → 重新创建带时间的tray icon  
- **暂停状态**: `title = "⏸️ 24:00"` → 重新创建带暂停信息的tray icon

**重要**: 由于技术限制，每次状态变化都需要重新创建 tray icon（移除旧的，创建新的）。

## 实现细节

### 文件修改清单

| 文件 | 修改类型 | 重要性 |
|------|----------|--------|
| `src-tauri/src/lib.rs` | 新增 TrayIconState 实现 | 🔴 高 |
| `src-tauri/src/commands.rs` | 实现 update_tray_title 逻辑 | 🔴 高 |
| `src-tauri/src/main.rs` | 添加必要的 use 语句 | 🟡 中 |

### 图标资源使用

**空闲状态图标**: `src-tauri/icons/32x32.png`
- 尺寸: 32x32 像素
- 格式: PNG (RGBA)
- 适合: macOS 菜单栏显示

## 测试计划

### 功能测试场景

1. **应用启动测试**
   - ✅ 启动应用，菜单栏显示猫咪logo图标
   - ✅ 无控制台错误信息

2. **计时开始测试**
   - ✅ 点击"开始专注"，菜单栏显示 "🍅 25:00"
   - ✅ 倒计时每秒更新: "🍅 24:59" → "🍅 24:58"

3. **暂停功能测试**
   - ✅ 点击"暂停"，菜单栏显示 "⏸️ 24:xx"
   - ✅ 时间数字保持准确

4. **恢复功能测试**
   - ✅ 点击"继续"，恢复倒计时显示
   - ✅ 无显示异常

5. **完成测试**
   - ✅ 计时完成，菜单栏恢复猫咪logo图标
   - ✅ 状态转换流畅

6. **放弃功能测试**
   - ✅ 点击"放弃"，立即恢复猫咪logo图标
   - ✅ 状态正确重置

### 边缘情况测试

- 应用最小化时的菜单栏更新
- 长时间运行（25分钟完整周期）的稳定性
- 快速状态切换的响应性
- 内存泄漏检测

### 性能考虑

- **更新频率**: 每秒一次重建 tray icon（技术限制）
- **性能目标**: 更新延迟 < 100ms，CPU 使用 < 5%
- **内存管理**: 确保旧的 tray icon 被正确释放
- **线程安全**: 使用 Arc<AppHandle> 确保跨线程安全

### 实施注意事项

**菜单事件监听器重建**:
每次重建 tray icon 时需要重新绑定菜单事件：

```rust
// 在 create_tray_icon 中重新绑定事件
let app_handle = app.clone();
app.on_tray_icon_event(move |_tray_id, event| {
    // 事件处理逻辑
});
```

**性能优化**:
- 考虑使用防抖策略减少不必要的重建
- 只在状态真正改变时才重建
- 添加性能监控代码

## 兼容性

### 平台支持
- **macOS**: ✅ 主要支持平台
- **Windows/Linux**: ⚠️ 使用 `#[cfg(target_os = "macos")]` 条件编译

### 向后兼容
- 现有 API 接口不变
- 前端调用代码无需修改
- 其他平台功能不受影响

## 风险和限制

### 技术风险
1. **TrayIcon 重建开销**: 每秒重建 tray icon 可能有性能影响
2. **菜单事件丢失**: 重建 tray icon 会重置菜单事件监听器
3. **内存泄漏风险**: 频繁创建/销毁 tray icon 需要仔细管理

### 缓解措施
1. **性能监控**: 实施后监控 CPU 和内存使用
2. **事件管理**: 确保菜单事件在重建后正确重新绑定
3. **错误隔离**: tray 更新失败不应影响主计时功能
4. **后备方案**: 如果重建失败，保持现有状态不变

## 错误处理策略

### 错误场景和处理

| 错误场景 | 处理方式 | 用户影响 |
|----------|----------|----------|
| TrayIcon 创建失败 | 记录错误，继续主功能 | 菜单栏可能不更新 |
| TrayIcon 移除失败 | 忽略错误，创建新的 | 可能有重复图标 |
| 菜单创建失败 | 返回错误，不更新tray | 菜单栏功能受限 |
| 频繁更新失败 | 降低更新频率或停止更新 | 用户体验下降 |

### 错误恢复
- **自动重试**: 更新失败时在下次tick时重试
- **降级策略**: 连续失败时停止更新，避免影响性能
- **用户通知**: 不显示错误通知，静默处理

## 实施计划

### 开发阶段
1. 修改 `TrayIconState` 结构体
2. 实现 `update_tray_title` 命令
3. 测试基本功能

### 测试阶段
1. 手动功能测试
2. 边缘情况验证
3. 性能监控

### 发布阶段
1. 合并到主分支
2. 构建生产版本
3. 用户反馈收集

## 成功标准

- ✅ 菜单栏能正确显示猫咪logo图标（空闲状态）
- ✅ 计时时能显示 "🍅 24:00" 格式文字
- ✅ 暂停时能显示 "⏸️ 24:00" 格式文字
- ✅ 每秒更新流畅无延迟
- ✅ 状态切换无显示异常
- ✅ 无内存泄漏或性能问题

## 备选方案

如果主要方案遇到技术限制，备选方案：

### 方案 B: 事件系统
```rust
app.emit("update-tray", title)?;
```
- 前端监听事件并更新
- 增加复杂度但更灵活

### 方案 C: 重新设计图标
- 创建专用的菜单栏图标
- 考虑 macOS template 模式
- 更符合系统设计规范