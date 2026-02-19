import type { Character, TaxonomyNode, AttributeDefinition } from "@imagix/shared";
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
import { useParams } from "react-router-dom";
import {
  useCharacters,
  useCreateCharacter,
  useUpdateCharacter,
  useDeleteCharacter,
} from "@/api/hooks/useCharacters";
import { useTaxonomyTree } from "@/api/hooks/useTaxonomy";
import ConfirmDialog from "@/components/ConfirmDialog";
import EmptyState from "@/components/EmptyState";

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

/** Collect all inherited + own attributes along the ancestor chain. */
function collectAttributes(chain: TaxonomyNode[]): { attr: AttributeDefinition; from: string }[] {
  const result: { attr: AttributeDefinition; from: string }[] = [];
  for (const node of chain) {
    for (const attr of node.attributeDefinitions) {
      result.push({ attr, from: node.name });
    }
  }
  return result;
}

const TYPE_LABELS: Record<string, string> = {
  string: "文本",
  number: "数字",
  boolean: "布尔",
  enum: "枚举",
};

export default function CharacterListPage() {
  const { worldId } = useParams<{ worldId: string }>();
  const { data: characters, isLoading } = useCharacters(worldId);
  const { data: charNodes } = useTaxonomyTree(worldId, "CHAR");
  const createChar = useCreateCharacter(worldId!);
  const updateChar = useUpdateCharacter(worldId!);
  const deleteChar = useDeleteCharacter(worldId!);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingChar, setEditingChar] = useState<Character | null>(null);
  const [categoryNodeId, setCategoryNodeId] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Character | null>(null);

  const nodeMap = useMemo(() => {
    const map = new Map<string, TaxonomyNode>();
    for (const n of charNodes ?? []) map.set(n.id, n);
    return map;
  }, [charNodes]);

  const openCreate = () => {
    setEditingChar(null);
    setCategoryNodeId(charNodes?.[0]?.id ?? "");
    setDialogOpen(true);
  };

  const openEdit = (char: Character) => {
    setEditingChar(char);
    setCategoryNodeId(char.categoryNodeId);
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!categoryNodeId) return;
    if (editingChar) {
      updateChar.mutate(
        { charId: editingChar.id, body: { categoryNodeId } },
        { onSuccess: () => setDialogOpen(false) },
      );
    } else {
      createChar.mutate(
        { categoryNodeId },
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
            const allAttrs = collectAttributes(chain);
            return (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={char.id}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
                      <Typography variant="subtitle1" fontWeight="bold" sx={{ flex: 1 }}>
                        {node?.name ?? "未知分类"}
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
                    {chain.length > 1 && (
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 1, flexWrap: "wrap" }}>
                        {chain.map((n, i) => (
                          <Box key={n.id} sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
                            <Typography
                              variant="caption"
                              color={i === chain.length - 1 ? "primary.main" : "text.secondary"}
                              fontWeight={i === chain.length - 1 ? 600 : 400}
                            >
                              {n.name}
                            </Typography>
                            {i < chain.length - 1 && (
                              <Typography variant="caption" color="text.disabled">›</Typography>
                            )}
                          </Box>
                        ))}
                      </Box>
                    )}
                    {/* Attribute schema */}
                    {allAttrs.length > 0 && (
                      <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                        {allAttrs.map(({ attr, from }, i) => (
                          <Tooltip key={`${from}-${attr.name}-${i}`} title={`${attr.description ?? attr.name} (${TYPE_LABELS[attr.type]}，来自「${from}」)`}>
                            <Chip label={attr.name} size="small" variant="outlined" sx={{ height: 22, fontSize: "0.75rem" }} />
                          </Tooltip>
                        ))}
                      </Box>
                    )}
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
            label="角色分类"
            value={categoryNodeId}
            onChange={(e) => setCategoryNodeId(e.target.value)}
            select
            required
            helperText="请先在分类体系中定义角色分类树"
          >
            {(charNodes ?? []).map((n) => (
              <MenuItem key={n.id} value={n.id}>
                {n.name}
              </MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>取消</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={!categoryNodeId || createChar.isPending || updateChar.isPending}
          >
            {editingChar ? "保存" : "创建"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="删除角色"
        message="确定要删除此角色吗？相关的事件和关系不会被删除。"
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </Box>
  );
}
