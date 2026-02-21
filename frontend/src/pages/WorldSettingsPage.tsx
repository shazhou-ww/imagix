import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import DownloadIcon from "@mui/icons-material/Download";
import FileCopyIcon from "@mui/icons-material/FileCopy";
import SaveIcon from "@mui/icons-material/Save";
import UploadIcon from "@mui/icons-material/Upload";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Snackbar,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "@/api/client";
import { useSaveWorldAsTemplate } from "@/api/hooks/useTemplates";
import {
  useDeleteWorld,
  useUpdateWorld,
  useWorld,
} from "@/api/hooks/useWorlds";
import ConfirmDialog from "@/components/ConfirmDialog";

export default function WorldSettingsPage() {
  const { worldId } = useParams<{ worldId: string }>();
  const navigate = useNavigate();
  const { data: world, isLoading } = useWorld(worldId);
  const updateWorld = useUpdateWorld(worldId ?? "");
  const deleteWorld = useDeleteWorld();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [settings, setSettings] = useState("");
  const [epoch, setEpoch] = useState("");
  const [saved, setSaved] = useState(false);

  // Delete
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Export / Import
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [snackMsg, setSnackMsg] = useState("");

  // Save as template
  const saveAsTemplate = useSaveWorldAsTemplate(worldId ?? "");
  const [templateOpen, setTemplateOpen] = useState(false);
  const [tplName, setTplName] = useState("");
  const [tplDesc, setTplDesc] = useState("");

  useEffect(() => {
    if (world) {
      setName(world.name);
      setDescription(world.description);
      setSettings(world.settings);
      setEpoch(world.epoch);
    }
  }, [world]);

  const handleSave = () => {
    if (!name.trim()) return;
    updateWorld.mutate(
      {
        name: name.trim(),
        description: description.trim() || undefined,
        settings: settings.trim() || undefined,
        epoch: epoch.trim() || undefined,
      },
      { onSuccess: () => setSaved(true) },
    );
  };

  const handleDelete = () => {
    deleteWorld.mutate(worldId ?? "", {
      onSuccess: () => navigate("/"),
    });
  };

  const handleExport = async () => {
    try {
      const data = await api.get<Record<string, unknown>>(
        `/worlds/${worldId}/export`,
      );
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${world?.name ?? "world"}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setSnackMsg("导出成功");
    } catch {
      setSnackMsg("导出失败");
    }
  };

  const handleImportSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImportFile(file);
      setImportOpen(true);
    }
    e.target.value = "";
  };

  const handleImportConfirm = async () => {
    if (!importFile) return;
    setImporting(true);
    try {
      const text = await importFile.text();
      const data = JSON.parse(text);
      await api.post(`/worlds/${worldId}/import`, data);
      setSnackMsg("导入成功，请刷新页面查看");
      setImportOpen(false);
      setImportFile(null);
    } catch {
      setSnackMsg("导入失败，请检查文件格式");
    } finally {
      setImporting(false);
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!world) {
    return <Typography color="error">世界不存在</Typography>;
  }

  return (
    <Box>
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        世界设定
      </Typography>

      <Box
        sx={{ display: "flex", flexDirection: "column", gap: 3, maxWidth: 600 }}
      >
        <TextField
          label="世界名称"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <TextField
          label="世界描述"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          multiline
          rows={3}
        />
        <TextField
          label="世界设定"
          value={settings}
          onChange={(e) => setSettings(e.target.value)}
          multiline
          rows={6}
          helperText="物理法则、力量体系、社会规则等"
        />
        <TextField
          label="时间纪元"
          value={epoch}
          onChange={(e) => setEpoch(e.target.value)}
          helperText='对 t=0 原点的文字说明，如"盘古开天辟地"'
        />
        <Box>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            disabled={!name.trim() || updateWorld.isPending}
          >
            保存设定
          </Button>
        </Box>

        <Divider sx={{ my: 1 }} />

        {/* Export & Import */}
        <Typography variant="h6" fontWeight="bold">
          数据导出 / 导入
        </Typography>
        <Box sx={{ display: "flex", gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={handleExport}
          >
            导出世界数据
          </Button>
          <Button
            variant="outlined"
            startIcon={<UploadIcon />}
            onClick={() => fileInputRef.current?.click()}
          >
            导入世界数据
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            hidden
            onChange={handleImportSelect}
          />
        </Box>
        <Typography variant="body2" color="text.secondary">
          导出当前世界的全部数据为 JSON 文件；导入时相同 ID 的实体将被覆盖。
        </Typography>

        <Divider sx={{ my: 1 }} />

        {/* Save as template */}
        <Typography variant="h6" fontWeight="bold">
          保存为模板
        </Typography>
        <Box>
          <Button
            variant="outlined"
            startIcon={<FileCopyIcon />}
            onClick={() => {
              setTplName(world?.name ?? "");
              setTplDesc(`基于「${world?.name}」创建的模板`);
              setTemplateOpen(true);
            }}
          >
            保存为模板
          </Button>
        </Box>
        <Typography variant="body2" color="text.secondary">
          将当前世界的结构设定（分类体系、属性定义、地点）保存为模板，以便快速创建类似的世界。
        </Typography>

        <Divider sx={{ my: 1 }} />

        {/* Danger zone */}
        <Typography variant="h6" fontWeight="bold" color="error">
          危险区域
        </Typography>
        <Box>
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteForeverIcon />}
            onClick={() => setDeleteOpen(true)}
          >
            删除世界
          </Button>
        </Box>
        <Typography variant="body2" color="text.secondary">
          删除后无法恢复，世界中的所有数据将被永久移除。
        </Typography>
      </Box>

      {/* Delete confirm dialog */}
      <ConfirmDialog
        open={deleteOpen}
        title="确认删除世界"
        message={`确定要删除「${world?.name}」吗？此操作不可恢复，世界中的所有角色、事件、关系等数据将被永久移除。`}
        confirmLabel="删除"
        onConfirm={handleDelete}
        onClose={() => setDeleteOpen(false)}
        loading={deleteWorld.isPending}
      />

      {/* Import confirm dialog */}
      <ConfirmDialog
        open={importOpen}
        title="确认导入"
        message={`将导入文件「${importFile?.name}」中的数据。相同 ID 的实体将被覆盖，确定继续吗？`}
        confirmLabel="导入"
        onConfirm={handleImportConfirm}
        onClose={() => {
          setImportOpen(false);
          setImportFile(null);
        }}
        loading={importing}
      />

      <Snackbar
        open={saved || !!snackMsg}
        autoHideDuration={3000}
        onClose={() => {
          setSaved(false);
          setSnackMsg("");
        }}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={snackMsg.includes("失败") ? "error" : "success"}
          onClose={() => {
            setSaved(false);
            setSnackMsg("");
          }}
        >
          {snackMsg || "世界设定已保存"}
        </Alert>
      </Snackbar>

      {/* Save as template dialog */}
      <Dialog
        open={templateOpen}
        onClose={() => setTemplateOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>保存为模板</DialogTitle>
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
            value={tplName}
            onChange={(e) => setTplName(e.target.value)}
            autoFocus
            required
          />
          <TextField
            label="模板描述"
            value={tplDesc}
            onChange={(e) => setTplDesc(e.target.value)}
            multiline
            rows={3}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTemplateOpen(false)}>取消</Button>
          <Button
            variant="contained"
            disabled={!tplName.trim() || saveAsTemplate.isPending}
            onClick={() => {
              saveAsTemplate.mutate(
                {
                  name: tplName.trim(),
                  description: tplDesc.trim() || undefined,
                },
                {
                  onSuccess: () => {
                    setTemplateOpen(false);
                    setTplName("");
                    setTplDesc("");
                    setSnackMsg("已保存为模板");
                  },
                },
              );
            }}
          >
            保存
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
