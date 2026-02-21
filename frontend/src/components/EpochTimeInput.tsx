import {
  Box,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import {
  composeEpochMs,
  type EpochTime,
  formatEpochMs,
  parseEpochMs,
} from "@/utils/time";

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
  /** 是否显示纪元前/后切换（时间跨度不需要） */
  showEraToggle?: boolean;
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
  showEraToggle = true,
  disabled = false,
}: EpochTimeInputProps) {
  const [fields, setFields] = useState<EpochTime>(() => parseEpochMs(value));
  const [era, setEra] = useState<"after" | "before">(() =>
    value < 0 ? "before" : "after",
  );

  // Sync from parent when value changes externally
  useEffect(() => {
    const current = composeEpochMs(fields);
    if (current !== value) {
      const parsed = parseEpochMs(value);
      setFields(parsed);
      setEra(value < 0 ? "before" : "after");
    }
    // Only react to external value changes, not our own field edits
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, fields]);

  const update = (patch: Partial<EpochTime>, newEra?: "after" | "before") => {
    const next = { ...fields, ...patch };
    // Ensure years is stored as absolute; sign is controlled by era toggle
    next.years = Math.abs(next.years);
    setFields(next);
    const e = newEra ?? era;
    const ms = composeEpochMs({
      ...next,
      years: e === "before" ? -next.years : next.years,
    });
    onChange(ms);
  };

  const handleEraChange = (_: unknown, newEra: "after" | "before" | null) => {
    if (!newEra) return;
    setEra(newEra);
    update({}, newEra);
  };

  const fieldDefs: {
    key: keyof EpochTime;
    label: string;
    min?: number;
    max?: number;
    width: number;
    offset?: number;
  }[] = [
    // Timestamp mode: 1-based year/month/day (no year 0, like AD/BC); Duration mode: 0-based
    {
      key: "years",
      label: "年",
      min: showEraToggle ? 1 : 0,
      width: 88,
      offset: showEraToggle ? 1 : 0,
    },
    {
      key: "months",
      label: "月",
      min: showEraToggle ? 1 : 0,
      max: showEraToggle ? 12 : 11,
      width: 56,
      offset: showEraToggle ? 1 : 0,
    },
    {
      key: "days",
      label: "日",
      min: showEraToggle ? 1 : 0,
      max: showEraToggle ? 30 : 29,
      width: 56,
      offset: showEraToggle ? 1 : 0,
    },
    { key: "hours", label: "时", min: 0, max: 23, width: 56 },
    { key: "minutes", label: "分", min: 0, max: 59, width: 56 },
    ...(showSeconds
      ? [{ key: "seconds" as const, label: "秒", min: 0, max: 59, width: 56 }]
      : []),
  ];

  return (
    <Box>
      <Box
        sx={{
          display: "flex",
          gap: 0.5,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        {showEraToggle && (
          <ToggleButtonGroup
            value={era}
            exclusive
            onChange={handleEraChange}
            size="small"
            disabled={disabled}
            sx={{ height: size === "small" ? 40 : 56 }}
          >
            <ToggleButton value="after" sx={{ px: 1, fontSize: "0.8rem" }}>
              纪元后
            </ToggleButton>
            <ToggleButton value="before" sx={{ px: 1, fontSize: "0.8rem" }}>
              纪元前
            </ToggleButton>
          </ToggleButtonGroup>
        )}
        {fieldDefs.map((f) => (
          <TextField
            key={f.key}
            size={size}
            type="number"
            label={f.label}
            value={
              f.key === "years"
                ? Math.abs(fields[f.key]) + (f.offset ?? 0)
                : fields[f.key] + (f.offset ?? 0)
            }
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
              "& input[type=number]::-webkit-outer-spin-button, & input[type=number]::-webkit-inner-spin-button":
                {
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
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ mt: 0.5, display: "block" }}
        >
          {formatEpochMs(value)}
        </Typography>
      )}
    </Box>
  );
}
