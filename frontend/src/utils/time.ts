/**
 * 将毫秒级 epoch 时间转为人类可读格式。
 * 由于世界时间是虚拟纪元，使用简单的数值拆分而非 Date 对象。
 *
 * 虚拟历法约定：
 *   1 年 = 12 月
 *   1 月 = 30 天
 *   1 天 = 24 小时
 *   1 小时 = 60 分
 *   1 分 = 60 秒
 *   1 秒 = 1000 毫秒
 *   因此 1 年 = 360 天 = 31,104,000,000 毫秒
 */

const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;
const MS_PER_MONTH = 30 * MS_PER_DAY;
const MS_PER_YEAR = 12 * MS_PER_MONTH; // 360 days

export interface EpochTime {
  years: number;
  months: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  ms: number;
}

/** 将毫秒 epoch 拆分为年/月/日/时/分/秒/毫秒。 */
export function parseEpochMs(ms: number): EpochTime {
  const abs = Math.abs(ms);
  const sign = ms < 0 ? -1 : 1;
  const years = Math.floor(abs / MS_PER_YEAR);
  let remainder = abs % MS_PER_YEAR;
  const months = Math.floor(remainder / MS_PER_MONTH);
  remainder %= MS_PER_MONTH;
  const days = Math.floor(remainder / MS_PER_DAY);
  remainder %= MS_PER_DAY;
  const hours = Math.floor(remainder / MS_PER_HOUR);
  remainder %= MS_PER_HOUR;
  const minutes = Math.floor(remainder / MS_PER_MINUTE);
  remainder %= MS_PER_MINUTE;
  const seconds = Math.floor(remainder / MS_PER_SECOND);
  const msRemainder = remainder % MS_PER_SECOND;

  return {
    years: sign * years,
    months,
    days,
    hours,
    minutes,
    seconds,
    ms: msRemainder,
  };
}

/** 将年/月/日/时/分/秒组合为毫秒 epoch。 */
export function composeEpochMs(t: Partial<EpochTime>): number {
  const y = t.years ?? 0;
  const sign = y < 0 ? -1 : 1;
  return (
    sign *
    (Math.abs(y) * MS_PER_YEAR +
      (t.months ?? 0) * MS_PER_MONTH +
      (t.days ?? 0) * MS_PER_DAY +
      (t.hours ?? 0) * MS_PER_HOUR +
      (t.minutes ?? 0) * MS_PER_MINUTE +
      (t.seconds ?? 0) * MS_PER_SECOND +
      (t.ms ?? 0))
  );
}

/** 将毫秒 epoch 格式化为简洁的可读字符串（绝对时间点）。如 "第 3 年 4 月 15 日 12:30" */
export function formatEpochMs(ms: number): string {
  const t = parseEpochMs(ms);
  const prefix = ms < 0 ? "纪元前 " : "";
  const parts: string[] = [];

  parts.push(`第 ${Math.abs(t.years) + 1} 年`);
  if (t.months >= 0) parts.push(`${t.months + 1} 月`);
  if (t.days >= 0) parts.push(`${t.days + 1} 日`);

  const time = `${String(t.hours).padStart(2, "0")}:${String(t.minutes).padStart(2, "0")}`;
  parts.push(time);

  return prefix + parts.join(" ");
}

/** 将毫秒时间差格式化为可读字符串（时长/持续时间）。月/日从 0 计。如 "3 年 2 月 0 日" */
export function formatDuration(ms: number): string {
  const t = parseEpochMs(Math.abs(ms));
  const parts: string[] = [];

  if (t.years > 0) parts.push(`${t.years} 年`);
  if (t.months > 0 || parts.length > 0) parts.push(`${t.months} 月`);
  if (t.days > 0 || parts.length > 0) parts.push(`${t.days} 日`);

  if (t.hours > 0 || t.minutes > 0) {
    parts.push(`${String(t.hours).padStart(2, "0")}:${String(t.minutes).padStart(2, "0")}`);
  }

  return parts.length > 0 ? parts.join(" ") : "0";
}
