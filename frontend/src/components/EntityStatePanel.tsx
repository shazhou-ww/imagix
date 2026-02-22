import type { AttributeDefinition } from "@imagix/shared";
import {
  Box,
  Chip,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableRow,
  Typography,
} from "@mui/material";
import { useMemo, useState } from "react";
import { useAttributeDefinitions } from "@/api/hooks/useAttributeDefinitions";
import { useEntityState } from "@/api/hooks/useEntityState";
import EpochTimeInput from "@/components/EpochTimeInput";
import { formatDuration, formatEpochMs } from "@/utils/time";

interface EntityStatePanelProps {
  worldId: string;
  entityId: string;
  /** 默认时间点；不传表示使用一个很大的值（查看最新状态） */
  defaultTime?: number;
}

/** 系统属性的中文标签 */
const SYSTEM_ATTR_LABELS: Record<string, string> = {
  $alive: "存活",
  $age: "年龄",
};

/**
 * 实体状态面板。
 * 展示某实体在指定时间点的属性值快照。
 */
export default function EntityStatePanel({
  worldId,
  entityId,
  defaultTime,
}: EntityStatePanelProps) {
  // Use a very large time to get latest state if no default provided
  const [time, setTime] = useState<number>(
    defaultTime ?? Number.MAX_SAFE_INTEGER,
  );
  const [showTimePicker, setShowTimePicker] = useState(false);

  const { data: state, isLoading } = useEntityState(worldId, entityId, time);
  const { data: attrDefs } = useAttributeDefinitions(worldId);

  const attrDefMap = useMemo(() => {
    const map = new Map<string, AttributeDefinition>();
    for (const ad of attrDefs ?? []) map.set(ad.name, ad);
    return map;
  }, [attrDefs]);

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  const attributes = state?.attributes ?? {};
  const entries = Object.entries(attributes);

  if (!entries.length) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
        暂无属性数据
      </Typography>
    );
  }

  // Separate system attrs from user attrs
  const systemEntries = entries.filter(([k]) => k.startsWith("$"));
  const userEntries = entries.filter(([k]) => !k.startsWith("$"));

  return (
    <Box>
      {/* Time picker toggle */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
        <Chip
          label={
            time === Number.MAX_SAFE_INTEGER
              ? "最新状态"
              : `时间点: ${formatEpochMs(time)}`
          }
          size="small"
          onClick={() => setShowTimePicker(!showTimePicker)}
          color="primary"
          variant="outlined"
        />
        {time !== Number.MAX_SAFE_INTEGER && (
          <Chip
            label="重置为最新"
            size="small"
            variant="outlined"
            onClick={() => setTime(Number.MAX_SAFE_INTEGER)}
          />
        )}
      </Box>

      {showTimePicker && (
        <Box sx={{ mb: 2 }}>
          <EpochTimeInput
            value={time === Number.MAX_SAFE_INTEGER ? 0 : time}
            onChange={(v) => setTime(v)}
            size="small"
            showPreview
          />
        </Box>
      )}

      {/* Attributes table */}
      <Table size="small">
        <TableBody>
          {systemEntries.map(([key, val]) => (
            <TableRow key={key}>
              <TableCell
                sx={{ fontWeight: 500, width: 120, color: "text.secondary" }}
              >
                {SYSTEM_ATTR_LABELS[key] ?? key}
              </TableCell>
              <TableCell>{formatAttrValue(key, val)}</TableCell>
            </TableRow>
          ))}
          {userEntries.map(([key, val]) => {
            const def = attrDefMap.get(key);
            return (
              <TableRow key={key}>
                <TableCell
                  sx={{ fontWeight: 500, width: 120, color: "text.secondary" }}
                >
                  {def?.name ?? key}
                </TableCell>
                <TableCell>{formatAttrValueWithDef(key, val, def)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Box>
  );
}

function formatAttrValue(key: string, value: unknown): React.ReactNode {
  if (key === "$alive") {
    return (
      <Chip
        label={value ? "存活" : "已消亡"}
        size="small"
        color={value ? "success" : "error"}
        sx={{ height: 20 }}
      />
    );
  }
  if (key === "$age" && typeof value === "number") {
    return formatDuration(value);
  }
  if (typeof value === "boolean") return value ? "是" : "否";
  return String(value);
}

function formatAttrValueWithDef(
  _key: string,
  value: unknown,
  def?: AttributeDefinition,
): React.ReactNode {
  if (typeof value === "boolean") return value ? "是" : "否";
  if (def?.type === "timestamp" && typeof value === "number") {
    return formatEpochMs(value);
  }
  if (def?.type === "timespan" && typeof value === "number") {
    return formatDuration(value);
  }
  return String(value);
}
