import type { Character, TaxonomyNode } from "@imagix/shared";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import {
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
  Grid,
  IconButton,
  MenuItem,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  useCharacters,
  useCreateCharacter,
  useUpdateCharacter,
  useDeleteCharacter,
} from "@/api/hooks/useCharacters";
import { useTaxonomyTree } from "@/api/hooks/useTaxonomy";
import ConfirmDialog from "@/components/ConfirmDialog";
import EmptyState from "@/components/EmptyState";
import { formatEpochMs } from "@/utils/time";

/** Build ancestor chain for a node (bottom-up, returned top-down). */
function getAncestorChain(nodeId: string, nodeMap: Map<string, TaxonomyNode>): TaxonomyNode[] {
  const chain: TaxonomyNode[] = [];
  let cur = nodeMap.get(nodeId);
  while (cur) {
    chain.unshift(cur);
    cur = cur.parentId ? nodeMap.get(cur.parentId) : undefined;
  }
  return chain;
}

export default function CharacterListPage() {
  const { worldId } = useParams<{ worldId: string }>();
  const navigate = useNavigate();
  const { data: characters, isLoading } = useCharacters(worldId);
  const { data: charNodes } = useTaxonomyTree(worldId, "CHAR");
  const createChar = useCreateCharacter(worldId!);
  const updateChar = useUpdateCharacter(worldId!);
  const deleteChar = useDeleteCharacter(worldId!);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingChar, setEditingChar] = useState<Character | null>(null);
  const [charName, setCharName] = useState("");
  const [categoryNodeId, setCategoryNodeId] = useState("");
  const [birthTime, setBirthTime] = useState<number>(0);
  const [deleteTarget, setDeleteTarget] = useState<Character | null>(null);

  const nodeMap = useMemo(() => {
    const map = new Map<string, TaxonomyNode>();
    for (const n of charNodes ?? []) map.set(n.id, n);
    return map;
  }, [charNodes]);

  const openCreate = () => {
    setEditingChar(null);
    setCharName("");
    setCategoryNodeId(charNodes?.[0]?.id ?? "");
    setBirthTime(0);
    setDialogOpen(true);
  };

  const openEdit = (char: Character) => {
    setEditingChar(char);
    setCharName(char.name ?? "");
    setCategoryNodeId(char.categoryNodeId);
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!charName.trim() || !categoryNodeId) return;
    if (editingChar) {
      updateChar.mutate(
        { charId: editingChar.id, body: { name: charName.trim(), categoryNodeId } },
        { onSuccess: () => setDialogOpen(false) },
      );
    } else {
      createChar.mutate(
        { name: charName.trim(), categoryNodeId, birthTime },
        { onSuccess: () => setDialogOpen(false) },
      );
    }
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteChar.mutate(deleteTarget.id, {
      onSuccess: () => setDeleteTarget(null),
    });
  };

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3 }}>
        <Typography variant="h4" fontWeight="bold">
          角色
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          添加角色
        </Button>
      </Box>

      {!characters?.length ? (
        <EmptyState
          title="暂无角色"
          description="先在分类体系中定义角色分类，然后添加角色"
          action={
            <Button variant="outlined" onClick={openCreate}>
              添加角色
            </Button>
          }
        />
      ) : (
        <Grid container spacing={2}>
          {characters.map((char) => {
            const node = nodeMap.get(char.categoryNodeId);
            const chain = getAncestorChain(char.categoryNodeId, nodeMap);
            return (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={char.id}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
                      <Typography variant="subtitle1" fontWeight="bold" sx={{ flex: 1 }}>
                        {char.name}
                      </Typography>
                      <Tooltip title="编辑">
                        <IconButton size="small" onClick={() => openEdit(char)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="删除">
                        <IconButton size="small" color="error" onClick={() => setDeleteTarget(char)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                    {/* Classification path */}
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexWrap: "wrap" }}>
                      {chain.length > 0 ? (
                        chain.map((n, i) => (
                          <Box key={n.id} sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
                            <Chip
                              label={n.name}
                              size="small"
                              variant={i === chain.length - 1 ? "filled" : "outlined"}
                              color={i === chain.length - 1 ? "primary" : "default"}
                              sx={{ height: 22, fontSize: "0.75rem" }}
                            />
                            {i < chain.length - 1 && (
                              <Typography variant="caption" color="text.disabled">›</Typography>
                            )}
                          </Box>
                        ))
                      ) : (
                        <Chip label={node?.name ?? "未知分类"} size="small" variant="outlined" sx={{ height: 22, fontSize: "0.75rem" }} />
                      )}
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
                      {char.id}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingChar ? "编辑角色" : "添加角色"}</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "8px !important" }}>
          <TextField
            label="角色名称"
            value={charName}
            onChange={(e) => setCharName(e.target.value)}
            autoFocus
            required
          />
          {(charNodes ?? []).length === 0 ? (
            <Box sx={{ textAlign: "center", py: 2 }}>
              <Typography color="text.secondary" gutterBottom>
                还没有角色分类节点
              </Typography>
              <Button
                variant="outlined"
                onClick={() => {
                  setDialogOpen(false);
                  navigate(`/worlds/${worldId}/taxonomy/CHAR`);
                }}
              >
                去创建分类
              </Button>
            </Box>
          ) : (
            <TextField
              label="角色分类"
              value={categoryNodeId}
              onChange={(e) => setCategoryNodeId(e.target.value)}
              select
              required
              helperText="选择角色所属的分类节点"
            >
              {charNodes!.map((n) => (
                <MenuItem key={n.id} value={n.id}>
                  {n.name}
                </MenuItem>
              ))}
            </TextField>
          )}
          {!editingChar && (
            <TextField
              label="出生时间（毫秒，相对纪元原点）"
              type="number"
              value={birthTime}
              onChange={(e) => setBirthTime(Number(e.target.value))}
              required
              helperText={`预览: ${formatEpochMs(birthTime)}。创建后会自动生成出生事件。`}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>取消</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={!charName.trim() || !categoryNodeId || createChar.isPending || updateChar.isPending}
          >
            {editingChar ? "保存" : "创建"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="删除角色"
        message={`确定要删除「${deleteTarget?.name}」吗？相关的事件和关系不会被删除。`}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </Box>
  );
}
