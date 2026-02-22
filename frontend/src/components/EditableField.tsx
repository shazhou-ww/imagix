import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import EditIcon from "@mui/icons-material/Edit";
import { Box, IconButton, TextField, Tooltip, Typography } from "@mui/material";
import { useEffect, useState } from "react";

interface EditableFieldProps {
  /** 字段标签 */
  label: string;
  /** 当前值 */
  value: string;
  /** 值变更回调 */
  onSave: (newValue: string) => void;
  /** 是否多行 */
  multiline?: boolean;
  /** 多行时的行数 */
  rows?: number;
  /** 是否只读 */
  readOnly?: boolean;
  /** 是否必填 */
  required?: boolean;
  /** 保存中 */
  saving?: boolean;
  /** 值的排版 variant */
  variant?: "body1" | "body2" | "h6";
  /** 占位文本 */
  placeholder?: string;
}

/**
 * 就地编辑字段组件。
 * 点击编辑图标切换为输入框，保存或取消后恢复显示状态。
 */
export default function EditableField({
  label,
  value,
  onSave,
  multiline = false,
  rows = 2,
  readOnly = false,
  required = false,
  saving = false,
  variant = "body1",
  placeholder,
}: EditableFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  // Sync when parent value changes
  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  const handleSave = () => {
    if (required && !draft.trim()) return;
    onSave(draft);
    setEditing(false);
  };

  const handleCancel = () => {
    setDraft(value);
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!multiline && e.key === "Enter") {
      e.preventDefault();
      handleSave();
    }
    if (e.key === "Escape") handleCancel();
  };

  if (editing) {
    return (
      <Box sx={{ mb: 1 }}>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5 }}>
          {label}
        </Typography>
        <Box sx={{ display: "flex", gap: 0.5, alignItems: "flex-start" }}>
          <TextField
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            size="small"
            fullWidth
            autoFocus
            multiline={multiline}
            rows={multiline ? rows : undefined}
            placeholder={placeholder}
            required={required}
          />
          <Tooltip title="保存">
            <IconButton
              size="small"
              color="primary"
              onClick={handleSave}
              disabled={saving || (required && !draft.trim())}
            >
              <CheckIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="取消">
            <IconButton size="small" onClick={handleCancel} disabled={saving}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ mb: 1 }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 0.5 }}>
        <Typography
          variant={variant}
          sx={{
            flex: 1,
            whiteSpace: multiline ? "pre-wrap" : "nowrap",
            color: value ? "text.primary" : "text.disabled",
          }}
        >
          {value || placeholder || "—"}
        </Typography>
        {!readOnly && (
          <Tooltip title="编辑">
            <IconButton size="small" onClick={() => setEditing(true)}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>
    </Box>
  );
}
