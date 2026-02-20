import { Box, TextField, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { type EpochTime, parseEpochMs, composeEpochMs, formatEpochMs } from "@/utils/time";

interface EpochTimeInputProps {
  /** 当前毫秒 epoch 值 */
  value: number;
  /** 值变更回调 */
  onChange: (ms: number) => void;
  /** 输入框尺寸 */
  size?: "small" | "medium";
  /** 是否显示预览文字 */
  showPreview?: boolean;
  /** 是否显示秒字段 */
  showSeconds?: boolean;
  /** 禁用所有输入框 */
  disabled?: boolean;
}

/**
 * 世界纪元时间输入组件。
 * 用年/月/日/时/分/秒六个独立数字输入框编辑时间，自动换算成毫秒 epoch 存储。
 * 不使用日期选择器——故事世界时间未必与现实世界相同。
 *
 * 虚拟历法：1 年 = 12 月，1 月 = 30 天，1 天 = 24 小时。
 */
export default function EpochTimeInput({
  value,
  onChange,
  size = "small",
  showPreview = true,
  showSeconds = false,
  disabled = false,
}: EpochTimeInputProps) {
  const [fields, setFields] = useState<EpochTime>(() => parseEpochMs(value));

  // Sync from parent when value changes externally
  useEffect(() => {
    const current = composeEpochMs(fields);
    if (current !== value) {
      setFields(parseEpochMs(value));
    }
    // Only react to external value changes, not our own field edits
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const update = (patch: Partial<EpochTime>) => {
    const next = { ...fields, ...patch };
    setFields(next);
    onChange(composeEpochMs(next));
  };

  const fieldDefs: { key: keyof EpochTime; label: string; min?: number; max?: number; width: number; offset?: number }[] = [
    { key: "years", label: "年", width: 88 },
    { key: "months", label: "月", min: 1, max: 12, width: 56, offset: 1 },
    { key: "days", label: "日", min: 1, max: 30, width: 56, offset: 1 },
    { key: "hours", label: "时", min: 0, max: 23, width: 56 },
    { key: "minutes", label: "分", min: 0, max: 59, width: 56 },
    ...(showSeconds ? [{ key: "seconds" as const, label: "秒", min: 0, max: 59, width: 56 }] : []),
  ];

  return (
    <Box>
      <Box sx={{ display: "flex", gap: 0.5, alignItems: "center", flexWrap: "wrap" }}>
        {fieldDefs.map((f) => (
          <TextField
            key={f.key}
            size={size}
            type="number"
            label={f.label}
            value={fields[f.key] + (f.offset ?? 0)}
            disabled={disabled}
            onChange={(e) => {
              let v = Number(e.target.value);
              if (f.min !== undefined && v < f.min) v = f.min;
              if (f.max !== undefined && v > f.max) v = f.max;
              update({ [f.key]: v - (f.offset ?? 0) });
            }}
            slotProps={{
              htmlInput: {
                min: f.min,
                max: f.max,
                style: { textAlign: "center" },
              },
            }}
            sx={{
              width: f.width,
              "& input[type=number]::-webkit-outer-spin-button, & input[type=number]::-webkit-inner-spin-button": {
                WebkitAppearance: "none",
                margin: 0,
              },
              "& input[type=number]": {
                MozAppearance: "textfield",
              },
            }}
          />
        ))}
      </Box>
      {showPreview && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
          {formatEpochMs(value)}
        </Typography>
      )}
    </Box>
  );
}
