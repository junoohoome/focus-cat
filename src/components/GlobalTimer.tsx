import { useEffect, useRef } from "react";
import { useTimerStore } from "../stores/timerStore";
import { useTaskStore } from "../stores/taskStore";
import { useUserStore } from "../stores/userStore";
import { invoke } from "@tauri-apps/api/core";
import { sendNotification as sendTauriNotification } from "@tauri-apps/plugin-notification";
import { emit } from "@tauri-apps/api/event";
import { playCompleteSound, playBreakEndSound } from "../lib/sound";

/**
 * 全局计时器组件
 * 挂载在 App 顶层，始终存活。
 * 1. 每秒 tick 驱动倒计时
 * 2. 通过 Zustand subscribe 监听 remainingSeconds 归零，触发完成逻辑
 *    → 不依赖任何页面组件，不受页面切换/最小化影响
 */
export default function GlobalTimer() {
  const { state, tick } = useTimerStore();
  const completingRef = useRef(false);

  // 每秒 tick
  useEffect(() => {
    if (state === "running") {
      const intervalId = setInterval(() => {
        tick();
      }, 1000);
      return () => { clearInterval(intervalId); };
    }
  }, [state, tick]);

  // 监听 remainingSeconds 归零 → 触发完成逻辑
  useEffect(() => {
    const unsubscribe = useTimerStore.subscribe((state, prevState) => {
      // 检测：上一次 > 0，这一次 == 0，且之前是 running 状态
      if (
        prevState.remainingSeconds > 0 &&
        state.remainingSeconds === 0 &&
        prevState.state === "running" &&
        !completingRef.current
      ) {
        completingRef.current = true;
        handleComplete(prevState.type);
      }
    });
    return unsubscribe;
  }, []);

  return null;
}

let isCompleting = false;

/** 计时完成处理 — 独立函数，不依赖 React 组件生命周期 */
async function handleComplete(completedType: string) {
  try {
    const config = useUserStore.getState().config;
    const { currentTask } = useTaskStore.getState();

    if (completedType === "focus") {
      // 记录番茄钟
      const focusMinutes = config?.focusDuration || 25;
      try {
        await invoke("record_pomodoro", {
          record: {
            taskId: currentTask?.id || null,
            duration: focusMinutes,
            type: "focus",
          },
        });
      } catch (e) {
        console.error("record_pomodoro failed:", e);
      }

      // 更新任务进度
      if (currentTask) {
        try { await useTaskStore.getState().incrementTaskProgress(currentTask.id); } catch { /* ignore */ }
      }

      // 增加番茄钟计数
      useTimerStore.setState(s => ({ completedPomodorosInSession: s.completedPomodorosInSession + 1 }));

      // 刷新统计
      try { await useUserStore.getState().fetchStats(); } catch { /* ignore */ }
      const todayCount = useUserStore.getState().stats?.todayCount || 0;
      const dailyGoal = config?.dailyGoal || 4;

      // 播放声音
      if (config?.enableSound !== false) {
        playCompleteSound();
      }

      // 发送通知
      if (config?.enableNotifications !== false) {
        const msg = todayCount >= dailyGoal ? '目标达成！今天太棒了！' : '太棒了！休息一下吧~';
        try { await emit("pet-notification", { title: '专注完成！', body: msg }); } catch { /* ignore */ }
        try { await sendTauriNotification({ title: '专注完成！', body: msg }); } catch { /* ignore */ }
      }

      // 进入休息模式
      useTimerStore.getState().prepareBreakMode();

      // 自动开始休息
      if (config?.autoStart) {
        const store = useTimerStore.getState();
        const isLongBreak = store.completedPomodorosInSession >= 4;
        const breakMins = isLongBreak ? store.storedLongBreakDuration : store.storedBreakDuration;
        store.start(store.storedFocusDuration, breakMins, store.storedLongBreakDuration, store.storedAutoStart);
      }
    } else {
      // 休息结束
      if (config?.enableSound !== false) {
        playBreakEndSound();
      }

      if (config?.enableNotifications !== false) {
        try { await emit("pet-notification", { title: '休息结束！', body: '准备开始新的专注吧~' }); } catch { /* ignore */ }
        try { await sendTauriNotification({ title: '休息结束！', body: '准备开始新的专注吧~' }); } catch { /* ignore */ }
      }

      useTimerStore.getState().stop();

      // 自动开始下一个专注
      if (config?.autoStart) {
        const store = useTimerStore.getState();
        store.start(store.storedFocusDuration, store.storedBreakDuration, store.storedLongBreakDuration, store.storedAutoStart);
      }
    }
  } finally {
    completingRef.current = false;
  }
}
