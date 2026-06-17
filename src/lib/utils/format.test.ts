import { describe, it, expect } from "vitest";
import { formatDuration } from "./format";

describe("formatDuration", () => {
  it("分钟数小于 1 小时只显示 min", () => {
    expect(formatDuration(5)).toBe("5min");
  });

  it("整小时只显示 h", () => {
    expect(formatDuration(60)).toBe("1h");
  });

  it("小时+分钟组合", () => {
    expect(formatDuration(85)).toBe("1h25min");
  });

  it("整天只显示 d", () => {
    expect(formatDuration(1440)).toBe("1d");
  });

  it("天+小时组合", () => {
    expect(formatDuration(1500)).toBe("1d1h");
  });

  it("负数归零", () => {
    expect(formatDuration(-5)).toBe("0min");
  });
});
