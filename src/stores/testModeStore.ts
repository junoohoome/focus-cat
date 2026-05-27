import { create } from "zustand";

interface TestModeStore {
  isTestMode: boolean;
  setIsTestMode: (enabled: boolean) => void;
}

export const useTestModeStore = create<TestModeStore>((set) => ({
  isTestMode: false, // 默认不开启测试模式
  setIsTestMode: (enabled: boolean) => set({ isTestMode: enabled }),
}));
