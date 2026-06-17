import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockInvoke } from "../test/setup";
import { useTaskStore } from "./taskStore";
import type { Task } from "../types";

const makeTask = (overrides: Partial<Task> = {}): Task => ({
  id: 1,
  name: "测试任务",
  durationTarget: 2,
  completedMinutes: 0,
  completed: false,
  priority: "medium",
  createdAt: "2026-01-01 00:00:00",
  updatedAt: "2026-01-01 00:00:00",
  ...overrides,
});

describe("taskStore.incrementTaskProgress", () => {
  beforeEach(() => {
    useTaskStore.setState({ activeTasks: [], completedTasks: [], currentTask: null });
  });

  it("累加 completedMinutes 并调用 update_task", async () => {
    useTaskStore.setState({ activeTasks: [makeTask({ id: 1, completedMinutes: 10 })] });
    const updateHandler = vi.fn(() => null);
    mockInvoke({ update_task: updateHandler });

    await useTaskStore.getState().incrementTaskProgress(1, 5);

    expect(updateHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        updates: expect.objectContaining({ id: 1, completedMinutes: 15 }),
      })
    );
  });

  it("任务不存在时不调用 update_task", async () => {
    const updateHandler = vi.fn(() => null);
    mockInvoke({ update_task: updateHandler });

    await useTaskStore.getState().incrementTaskProgress(999, 5);

    expect(updateHandler).not.toHaveBeenCalled();
  });
});

describe("taskStore.completeTask", () => {
  beforeEach(() => {
    useTaskStore.setState({ activeTasks: [], completedTasks: [], currentTask: null });
  });

  it("把任务从进行中移到已完成，并清空 currentTask", async () => {
    const task = makeTask({ id: 1 });
    useTaskStore.setState({ activeTasks: [task], currentTask: task });
    mockInvoke({ update_task: vi.fn(() => null) });

    await useTaskStore.getState().completeTask(1);

    const s = useTaskStore.getState();
    expect(s.activeTasks).toHaveLength(0);
    expect(s.completedTasks).toHaveLength(1);
    expect(s.completedTasks[0].completed).toBe(true);
    expect(s.currentTask).toBeNull();
  });
});

describe("taskStore.reopenTask", () => {
  beforeEach(() => {
    useTaskStore.setState({ activeTasks: [], completedTasks: [], currentTask: null });
  });

  it("把任务从已完成移回进行中且 completed=false", async () => {
    const task = makeTask({ id: 1, completed: true });
    useTaskStore.setState({ completedTasks: [task] });
    mockInvoke({ update_task: vi.fn(() => null) });

    await useTaskStore.getState().reopenTask(1);

    const s = useTaskStore.getState();
    expect(s.completedTasks).toHaveLength(0);
    expect(s.activeTasks).toHaveLength(1);
    expect(s.activeTasks[0].completed).toBe(false);
  });
});
