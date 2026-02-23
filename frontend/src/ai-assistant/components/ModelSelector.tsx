// ---------------------------------------------------------------------------
// AI Assistant – Model selector (dropdown in chat panel header)
// ---------------------------------------------------------------------------

import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import {
  Box,
  FormControl,
  MenuItem,
  Select,
  type SelectChangeEvent,
  Tooltip,
  Typography,
} from "@mui/material";
import { useChat } from "../ChatContext";

export default function ModelSelector() {
  const { config, setConfig } = useChat();

  const activeModel = config.models.find(
    (m) => m.id === config.activeModelId,
  );

  const handleChange = (e: SelectChangeEvent<string>) => {
    setConfig({ ...config, activeModelId: e.target.value || null });
  };

  if (config.models.length === 0) {
    return (
      <Tooltip title="请在用户设置中配置 AI 模型">
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <WarningAmberIcon sx={{ fontSize: 16, color: "warning.main" }} />
          <Typography variant="caption" color="text.secondary">
            未配置模型
          </Typography>
        </Box>
      </Tooltip>
    );
  }

  return (
    <FormControl size="small" sx={{ minWidth: 100 }}>
      <Select
        value={activeModel?.id ?? ""}
        onChange={handleChange}
        displayEmpty
        variant="standard"
        sx={{
          fontSize: "0.8rem",
          "&::before": { display: "none" },
          "&::after": { display: "none" },
          "& .MuiSelect-select": { py: 0.5 },
        }}
      >
        {!activeModel && (
          <MenuItem value="" disabled>
            <em>选择模型</em>
          </MenuItem>
        )}
        {config.models.map((m) => {
          const ep = config.endpoints.find((e) => e.id === m.endpointId);
          return (
            <MenuItem key={m.id} value={m.id}>
              <Box>
                <Typography variant="body2">{m.alias}</Typography>
                {ep && (
                  <Typography variant="caption" color="text.secondary">
                    {ep.label}
                  </Typography>
                )}
              </Box>
            </MenuItem>
          );
        })}
      </Select>
    </FormControl>
  );
}
