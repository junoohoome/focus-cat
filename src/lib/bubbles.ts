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
