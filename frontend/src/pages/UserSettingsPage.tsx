import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import LogoutIcon from "@mui/icons-material/Logout";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  Grid,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { useChat } from "@/ai-assistant/ChatContext";
import type {
  AiConfig,
  AiEndpoint,
  AiModel,
  LlmProvider,
} from "@/ai-assistant/types";
import {
  useDeleteTemplate,
  useTemplates,
  useUpdateTemplate,
} from "@/api/hooks/useTemplates";
import { useAuth } from "@/auth/AuthContext";
import ConfirmDialog from "@/components/ConfirmDialog";
import EmptyState from "@/components/EmptyState";

export default function UserSettingsPage() {
  const { authState, signOut } = useAuth();
  const { data: templates, isLoading } = useTemplates();
  const deleteTemplate = useDeleteTemplate();

  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Edit template form
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");

  const handleEdit = (id: string) => {
    const tpl = templates?.find((t) => t.id === id);
    if (!tpl) return;
    setEditId(id);
    setEditName(tpl.name);
    setEditDesc(tpl.description);
  };

  const handleDelete = () => {
    if (!deleteId) return;
    deleteTemplate.mutate(deleteId, {
      onSuccess: () => setDeleteId(null),
    });
  };

  const username =
    authState.status === "authenticated" ? authState.displayName : "";

  return (
    <Box>
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        用户设置
      </Typography>

      {/* User info */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 2,
          mb: 2,
          p: 2,
          borderRadius: 2,
          bgcolor: "background.paper",
          border: 1,
          borderColor: "divider",
        }}
      >
        <Avatar sx={{ width: 48, height: 48, bgcolor: "primary.main" }}>
          {username[0]?.toUpperCase() ?? "U"}
        </Avatar>
        <Box sx={{ flex: 1 }}>
          <Typography variant="subtitle1" fontWeight="bold">
            {username}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            已登录
          </Typography>
        </Box>
        <Button
          variant="outlined"
          color="error"
          startIcon={<LogoutIcon />}
          onClick={() => signOut()}
          size="small"
        >
          退出登录
        </Button>
      </Box>

      <Divider sx={{ my: 3 }} />

      {/* Templates section */}
      <Typography variant="h5" fontWeight="bold" sx={{ mb: 1 }}>
        世界模板
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        在世界设定页面可将已有世界保存为模板。创建新世界时可以选择模板快速开始。
      </Typography>

      {isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress />
        </Box>
      ) : !templates?.length ? (
        <EmptyState
          title="还没有模板"
          description="在世界设定中将已有世界保存为模板，创建新世界时即可选择模板快速开始"
        />
      ) : (
        <Grid container spacing={2}>
          {templates.map((tpl) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={tpl.id}>
              <Card variant="outlined">
                <CardContent>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                    }}
                  >
                    <Typography
                      variant="subtitle1"
                      fontWeight="bold"
                      gutterBottom
                    >
                      {tpl.name}
                    </Typography>
                    <Box
                      sx={{ display: "flex", gap: 0.5, ml: 1, flexShrink: 0 }}
                    >
                      <Tooltip title="编辑模板">
                        <IconButton
                          size="small"
                          onClick={() => handleEdit(tpl.id)}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="删除模板">
                        <IconButton
                          size="small"
                          onClick={() => setDeleteId(tpl.id)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>
                  {tpl.description && (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        mb: 1,
                      }}
                    >
                      {tpl.description}
                    </Typography>
                  )}
                  <Box
                    sx={{ display: "flex", gap: 1, flexWrap: "wrap", mt: 1 }}
                  >
                    <Typography variant="caption" color="text.secondary">
                      分类节点: {tpl.snapshot.taxonomy.length}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      属性定义: {tpl.snapshot.attributeDefinitions.length}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      地点: {tpl.snapshot.places.length}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Edit Template Dialog */}
      {editId && (
        <EditTemplateDialog
          templateId={editId}
          name={editName}
          description={editDesc}
          onNameChange={setEditName}
          onDescChange={setEditDesc}
          onClose={() => setEditId(null)}
        />
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteId}
        title="删除模板"
        message="确定要删除此模板吗？此操作不可撤销。"
        onConfirm={handleDelete}
        onClose={() => setDeleteId(null)}
      />

      <Divider sx={{ my: 3 }} />

      {/* AI Assistant settings */}
      <AiAssistantSettings />
    </Box>
  );
}

function EditTemplateDialog({
  templateId,
  name,
  description,
  onNameChange,
  onDescChange,
  onClose,
}: {
  templateId: string;
  name: string;
  description: string;
  onNameChange: (v: string) => void;
  onDescChange: (v: string) => void;
  onClose: () => void;
}) {
  const updateTemplate = useUpdateTemplate(templateId);
  const handleSave = () => {
    updateTemplate.mutate(
      {
        name: name.trim() || undefined,
        description: description.trim() || undefined,
      },
      { onSuccess: onClose },
    );
  };

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>编辑模板</DialogTitle>
      <DialogContent
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: 2,
          pt: "8px !important",
        }}
      >
        <TextField
          label="模板名称"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          autoFocus
        />
        <TextField
          label="模板描述"
          value={description}
          onChange={(e) => onDescChange(e.target.value)}
          multiline
          rows={3}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={updateTemplate.isPending}
        >
          保存
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// AI Assistant settings section
// ---------------------------------------------------------------------------

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function AiAssistantSettings() {
  const { config, setConfig, ready } = useChat();

  // Dialog state
  const [endpointDialogOpen, setEndpointDialogOpen] = useState(false);
  const [editingEndpoint, setEditingEndpoint] = useState<AiEndpoint | null>(
    null,
  );
  const [modelDialogOpen, setModelDialogOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<AiModel | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    type: "endpoint" | "model";
    id: string;
    label: string;
  } | null>(null);

  if (!ready) return null;

  const handleSaveEndpoint = (ep: AiEndpoint) => {
    const existing = config.endpoints.find((e) => e.id === ep.id);
    const endpoints = existing
      ? config.endpoints.map((e) => (e.id === ep.id ? ep : e))
      : [...config.endpoints, ep];
    setConfig({ ...config, endpoints });
    setEndpointDialogOpen(false);
    setEditingEndpoint(null);
  };

  const handleSaveModel = (model: AiModel) => {
    const existing = config.models.find((m) => m.id === model.id);
    const models = existing
      ? config.models.map((m) => (m.id === model.id ? model : m))
      : [...config.models, model];
    const next: AiConfig = { ...config, models };
    // Auto-select if it's the first model
    if (!next.activeModelId && next.models.length === 1) {
      next.activeModelId = model.id;
    }
    setConfig(next);
    setModelDialogOpen(false);
    setEditingModel(null);
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === "endpoint") {
      const endpoints = config.endpoints.filter(
        (e) => e.id !== deleteTarget.id,
      );
      // Remove models under this endpoint
      const models = config.models.filter(
        (m) => m.endpointId !== deleteTarget.id,
      );
      const activeModelId =
        config.activeModelId &&
        models.find((m) => m.id === config.activeModelId)
          ? config.activeModelId
          : models[0]?.id ?? null;
      setConfig({ ...config, endpoints, models, activeModelId });
    } else {
      const models = config.models.filter((m) => m.id !== deleteTarget.id);
      const activeModelId =
        config.activeModelId === deleteTarget.id
          ? (models[0]?.id ?? null)
          : config.activeModelId;
      setConfig({ ...config, models, activeModelId });
    }
    setDeleteTarget(null);
  };

  return (
    <>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
        <SmartToyIcon color="primary" />
        <Typography variant="h5" fontWeight="bold">
          AI 助手
        </Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        配置 LLM API 端点和模型。AI
        助手通过您提供的 API Key 直接调用 LLM，数据不经过我们的服务器。
      </Typography>

      {/* Endpoints */}
      <Box sx={{ display: "flex", alignItems: "center", mb: 1.5 }}>
        <Typography variant="h6" fontWeight="bold" sx={{ flex: 1 }}>
          API 端点
        </Typography>
        <Button
          size="small"
          startIcon={<AddIcon />}
          onClick={() => {
            setEditingEndpoint(null);
            setEndpointDialogOpen(true);
          }}
        >
          添加端点
        </Button>
      </Box>

      {config.endpoints.length === 0 ? (
        <EmptyState
          title="还没有 API 端点"
          description="添加一个 LLM API 端点（如 OpenAI、Anthropic 或兼容服务）来开始使用 AI 助手"
        />
      ) : (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {config.endpoints.map((ep) => {
            const epModels = config.models.filter(
              (m) => m.endpointId === ep.id,
            );
            return (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={ep.id}>
                <Card variant="outlined">
                  <CardContent>
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                      }}
                    >
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography
                          variant="subtitle1"
                          fontWeight="bold"
                          noWrap
                        >
                          {ep.label}
                        </Typography>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          noWrap
                          sx={{ display: "block" }}
                        >
                          {ep.url}
                        </Typography>
                      </Box>
                      <Box
                        sx={{
                          display: "flex",
                          gap: 0.5,
                          ml: 1,
                          flexShrink: 0,
                        }}
                      >
                        <Tooltip title="编辑">
                          <IconButton
                            size="small"
                            onClick={() => {
                              setEditingEndpoint(ep);
                              setEndpointDialogOpen(true);
                            }}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="删除">
                          <IconButton
                            size="small"
                            onClick={() =>
                              setDeleteTarget({
                                type: "endpoint",
                                id: ep.id,
                                label: ep.label,
                              })
                            }
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Box>

                    <Box sx={{ mt: 1, display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                      <Chip
                        label={ep.provider === "anthropic" ? "Anthropic" : "OpenAI 兼容"}
                        size="small"
                        variant="outlined"
                      />
                      <Chip
                        label={`${epModels.length} 个模型`}
                        size="small"
                        variant="outlined"
                      />
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      {/* Models */}
      <Box sx={{ display: "flex", alignItems: "center", mb: 1.5 }}>
        <Typography variant="h6" fontWeight="bold" sx={{ flex: 1 }}>
          模型
        </Typography>
        <Button
          size="small"
          startIcon={<AddIcon />}
          disabled={config.endpoints.length === 0}
          onClick={() => {
            setEditingModel(null);
            setModelDialogOpen(true);
          }}
        >
          添加模型
        </Button>
      </Box>

      {config.models.length === 0 ? (
        <EmptyState
          title="还没有模型"
          description={
            config.endpoints.length === 0
              ? "请先添加 API 端点"
              : "添加一个模型来开始使用 AI 助手"
          }
        />
      ) : (
        <Grid container spacing={2}>
          {config.models.map((model) => {
            const ep = config.endpoints.find(
              (e) => e.id === model.endpointId,
            );
            const isActive = config.activeModelId === model.id;
            return (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={model.id}>
                <Card
                  variant="outlined"
                  sx={{
                    borderColor: isActive ? "primary.main" : undefined,
                    borderWidth: isActive ? 2 : 1,
                  }}
                >
                  <CardContent>
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                      }}
                    >
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography
                          variant="subtitle1"
                          fontWeight="bold"
                          noWrap
                        >
                          {model.alias}
                        </Typography>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          noWrap
                          sx={{ display: "block" }}
                        >
                          {model.name}
                        </Typography>
                      </Box>
                      <Box
                        sx={{
                          display: "flex",
                          gap: 0.5,
                          ml: 1,
                          flexShrink: 0,
                        }}
                      >
                        <Tooltip title="编辑">
                          <IconButton
                            size="small"
                            onClick={() => {
                              setEditingModel(model);
                              setModelDialogOpen(true);
                            }}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="删除">
                          <IconButton
                            size="small"
                            onClick={() =>
                              setDeleteTarget({
                                type: "model",
                                id: model.id,
                                label: model.alias,
                              })
                            }
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Box>

                    <Box sx={{ mt: 1, display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                      {ep && (
                        <Chip
                          label={ep.label}
                          size="small"
                          variant="outlined"
                        />
                      )}
                      {isActive && (
                        <Chip
                          label="当前选中"
                          size="small"
                          color="primary"
                        />
                      )}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      {/* Endpoint dialog */}
      <EndpointDialog
        open={endpointDialogOpen}
        endpoint={editingEndpoint}
        onSave={handleSaveEndpoint}
        onClose={() => {
          setEndpointDialogOpen(false);
          setEditingEndpoint(null);
        }}
      />

      {/* Model dialog */}
      <ModelDialog
        open={modelDialogOpen}
        model={editingModel}
        endpoints={config.endpoints}
        onSave={handleSaveModel}
        onClose={() => {
          setModelDialogOpen(false);
          setEditingModel(null);
        }}
      />

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        title={deleteTarget?.type === "endpoint" ? "删除端点" : "删除模型"}
        message={
          deleteTarget?.type === "endpoint"
            ? `确定要删除端点「${deleteTarget?.label}」吗？该端点下的所有模型也会被删除。`
            : `确定要删除模型「${deleteTarget?.label}」吗？`
        }
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Endpoint Dialog
// ---------------------------------------------------------------------------

function EndpointDialog({
  open,
  endpoint,
  onSave,
  onClose,
}: {
  open: boolean;
  endpoint: AiEndpoint | null;
  onSave: (ep: AiEndpoint) => void;
  onClose: () => void;
}) {
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [provider, setProvider] = useState<LlmProvider>("openai");
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    if (open) {
      setLabel(endpoint?.label ?? "");
      setUrl(endpoint?.url ?? "");
      setApiKey(endpoint?.apiKey ?? "");
      setProvider(endpoint?.provider ?? "openai");
      setShowKey(false);
    }
  }, [open, endpoint]);

  const handleSave = () => {
    if (!label.trim() || !url.trim() || !apiKey.trim()) return;
    onSave({
      id: endpoint?.id ?? generateId(),
      label: label.trim(),
      url: url.trim().replace(/\/$/, ""),
      apiKey: apiKey.trim(),
      provider,
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{endpoint ? "编辑端点" : "添加端点"}</DialogTitle>
      <DialogContent
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: 2,
          pt: "8px !important",
        }}
      >
        <TextField
          label="名称"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="如：OpenAI、DeepSeek"
          autoFocus
          required
        />
        <TextField
          label="API URL"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="如：https://api.openai.com"
          helperText="不含 /v1/chat/completions 后缀"
          required
        />
        <TextField
          label="API Key"
          type={showKey ? "text" : "password"}
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-..."
          required
          slotProps={{
            input: {
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    onClick={() => setShowKey(!showKey)}
                    edge="end"
                  >
                    {showKey ? <VisibilityOffIcon /> : <VisibilityIcon />}
                  </IconButton>
                </InputAdornment>
              ),
            },
          }}
        />
        <FormControl fullWidth>
          <InputLabel>API 格式</InputLabel>
          <Select
            value={provider}
            label="API 格式"
            onChange={(e) => setProvider(e.target.value as LlmProvider)}
          >
            <MenuItem value="openai">OpenAI 兼容</MenuItem>
            <MenuItem value="anthropic">Anthropic</MenuItem>
          </Select>
        </FormControl>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={!label.trim() || !url.trim() || !apiKey.trim()}
        >
          保存
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Model Dialog
// ---------------------------------------------------------------------------

function ModelDialog({
  open,
  model,
  endpoints,
  onSave,
  onClose,
}: {
  open: boolean;
  model: AiModel | null;
  endpoints: AiEndpoint[];
  onSave: (m: AiModel) => void;
  onClose: () => void;
}) {
  const [endpointId, setEndpointId] = useState("");
  const [name, setName] = useState("");
  const [alias, setAlias] = useState("");

  useEffect(() => {
    if (open) {
      setEndpointId(model?.endpointId ?? endpoints[0]?.id ?? "");
      setName(model?.name ?? "");
      setAlias(model?.alias ?? "");
    }
  }, [open, model, endpoints]);

  const handleSave = () => {
    if (!endpointId || !name.trim() || !alias.trim()) return;
    onSave({
      id: model?.id ?? generateId(),
      endpointId,
      name: name.trim(),
      alias: alias.trim(),
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{model ? "编辑模型" : "添加模型"}</DialogTitle>
      <DialogContent
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: 2,
          pt: "8px !important",
        }}
      >
        <FormControl fullWidth required>
          <InputLabel>端点</InputLabel>
          <Select
            value={endpointId}
            label="端点"
            onChange={(e) => setEndpointId(e.target.value)}
          >
            {endpoints.map((ep) => (
              <MenuItem key={ep.id} value={ep.id}>
                {ep.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField
          label="模型名称 (API)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="如：gpt-4o、claude-sonnet-4-20250514"
          helperText="用于 API 调用的模型标识"
          required
        />
        <TextField
          label="显示别名"
          value={alias}
          onChange={(e) => setAlias(e.target.value)}
          placeholder="如：GPT-4o、Claude Sonnet"
          helperText="在 UI 中显示的名称"
          required
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={!endpointId || !name.trim() || !alias.trim()}
        >
          保存
        </Button>
      </DialogActions>
    </Dialog>
  );
}
