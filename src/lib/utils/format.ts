/**
 * 将分钟数格式化为易读的时间字符串
 * 5 → "5min", 60 → "1h", 85 → "1h25min"
 */
export function formatDuration(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours === 0) return `${mins}min`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h${mins}min`;
}
