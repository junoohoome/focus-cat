import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockInvoke } from "../test/setup";
import { useUserStore } from "./userStore";
import type { UserConfig } from "../types";

// resetConfig 内部 dynamic import 了 autostart 插件，需单独 mock
vi.mock("@tauri-apps/plugin-autostart", () => ({
  enable: vi.fn(),
  disable: vi.fn(),
}));
import { enable, disable } from "@tauri-apps/plugin-autostart";
const mockedEnable = vi.mocked(enable);
const mockedDisable = vi.mocked(disable);

const baseConfig: UserConfig = {
  id: 1,
  focusDuration: 25,
  breakDuration: 5,
  enableNotifications: false,
  enableSound: true,
  theme: "light",
  updatedAt: "2026-01-01 00:00:00",
  longBreakDuration: 15,
  autoStart: false,
  dailyGoal: 4,
  autoLaunch: false,
  showDesktopPet: false,
  showDailyGoal: true,
};

describe("userStore.resetConfig", () => {
  beforeEach(() => {
    mockedEnable.mockReset();
    mockedDisable.mockReset();
  });

  it("宠物窗/开机启动从开启→关闭默认值时，触发隐藏/注销副作用", async () => {
    // 旧配置：两者都开
    useUserStore.setState({
      config: { ...baseConfig, showDesktopPet: true, autoLaunch: true },
    });

    const togglePetWindow = vi.fn(() => null);
    mockInvoke({
      // 恢复默认返回：两者都关（默认值）
      reset_user_config: () => ({ ...baseConfig }),
      toggle_pet_window: togglePetWindow,
    });

    await useUserStore.getState().resetConfig();

    expect(togglePetWindow).toHaveBeenCalledWith({ show: false });
    expect(mockedDisable).toHaveBeenCalled();
    expect(mockedEnable).not.toHaveBeenCalled();
  });

  it("新旧配置一致时不触发副作用", async () => {
    // 新旧都是默认（都关），无差异
    useUserStore.setState({ config: { ...baseConfig } });

    const togglePetWindow = vi.fn(() => null);
    mockInvoke({
      reset_user_config: () => ({ ...baseConfig }),
      toggle_pet_window: togglePetWindow,
    });

    await useUserStore.getState().resetConfig();

    expect(togglePetWindow).not.toHaveBeenCalled();
    expect(mockedDisable).not.toHaveBeenCalled();
  });
});

describe("userStore.toggleAutoLaunch", () => {
  beforeEach(() => {
    mockedEnable.mockReset();
    mockedDisable.mockReset();
  });

  it("invoke 失败时回滚到 prevConfig，且不调用 enable", async () => {
    useUserStore.setState({
      config: { ...baseConfig, autoLaunch: false },
    });

    mockInvoke({
      // update_user_config 抛错 → 触发 catch 回滚
      update_user_config: () => {
        throw new Error("boom");
      },
    });

    await useUserStore.getState().toggleAutoLaunch(true);

    expect(useUserStore.getState().config?.autoLaunch).toBe(false);
    expect(mockedEnable).not.toHaveBeenCalled();
  });
});

describe("userStore.updateConfig", () => {
  it("把更新字段透传给 update_user_config 并随后刷新配置", async () => {
    useUserStore.setState({ config: { ...baseConfig } });

    const updateHandler = vi.fn(() => null);
    mockInvoke({
      update_user_config: updateHandler,
      get_user_config: () => ({ ...baseConfig, focusDuration: 30 }),
    });

    await useUserStore.getState().updateConfig({ focusDuration: 30 });

    expect(updateHandler).toHaveBeenCalledWith(
      expect.objectContaining({ focusDuration: 30 })
    );
    expect(useUserStore.getState().config?.focusDuration).toBe(30);
  });
});
