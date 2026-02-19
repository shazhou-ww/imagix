/**
 * 将毫秒级 epoch 时间转为人类可读格式。
 * 由于世界时间是虚拟纪元，使用简单的数值拆分而非 Date 对象。
 */

const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;
const MS_PER_YEAR = 365 * MS_PER_DAY;

export interface EpochTime {
  years: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  ms: number;
}

/** 将毫秒 epoch 拆分为年/日/时/分/秒/毫秒。 */
export function parseEpochMs(ms: number): EpochTime {
  const abs = Math.abs(ms);
  const sign = ms < 0 ? -1 : 1;
  const years = Math.floor(abs / MS_PER_YEAR);
  let remainder = abs % MS_PER_YEAR;
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
    days,
    hours,
    minutes,
    seconds,
    ms: msRemainder,
  };
}

/** 将毫秒 epoch 格式化为简洁的可读字符串。如 "第 3 年 第 42 天 12:30" */
export function formatEpochMs(ms: number): string {
  const t = parseEpochMs(ms);
  const prefix = ms < 0 ? "纪元前 " : "";
  const parts: string[] = [];

  if (Math.abs(t.years) > 0) parts.push(`第 ${Math.abs(t.years)} 年`);
  if (t.days > 0) parts.push(`第 ${t.days} 天`);

  const time = `${String(t.hours).padStart(2, "0")}:${String(t.minutes).padStart(2, "0")}`;
  parts.push(time);

  return prefix + parts.join(" ");
}
