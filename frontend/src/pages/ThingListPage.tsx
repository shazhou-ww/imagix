import type { Thing, TaxonomyNode, AttributeDefinition } from "@imagix/shared";
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
  useThings,
  useCreateThing,
  useUpdateThing,
  useDeleteThing,
} from "@/api/hooks/useThings";
import { useTaxonomyTree } from "@/api/hooks/useTaxonomy";
import ConfirmDialog from "@/components/ConfirmDialog";
import EmptyState from "@/components/EmptyState";

function getAncestorChain(nodeId: string, nodeMap: Map<string, TaxonomyNode>): TaxonomyNode[] {
  const chain: TaxonomyNode[] = [];
  let cur = nodeMap.get(nodeId);
  while (cur) {
    chain.unshift(cur);
    cur = cur.parentId ? nodeMap.get(cur.parentId) : undefined;
  }
  return chain;
}

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

export default function ThingListPage() {
  const { worldId } = useParams<{ worldId: string }>();
  const navigate = useNavigate();
  const { data: things, isLoading } = useThings(worldId);
  const { data: thingNodes } = useTaxonomyTree(worldId, "THING");
  const createThing = useCreateThing(worldId!);
  const updateThing = useUpdateThing(worldId!);
  const deleteThing = useDeleteThing(worldId!);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingThing, setEditingThing] = useState<Thing | null>(null);
  const [categoryNodeId, setCategoryNodeId] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Thing | null>(null);

  const nodeMap = useMemo(() => {
    const map = new Map<string, TaxonomyNode>();
    for (const n of thingNodes ?? []) map.set(n.id, n);
    return map;
  }, [thingNodes]);

  const openCreate = () => {
    setEditingThing(null);
    setCategoryNodeId(thingNodes?.[0]?.id ?? "");
    setDialogOpen(true);
  };

  const openEdit = (thing: Thing) => {
    setEditingThing(thing);
    setCategoryNodeId(thing.categoryNodeId);
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!categoryNodeId) return;
    if (editingThing) {
      updateThing.mutate(
        { thingId: editingThing.id, body: { categoryNodeId } },
        { onSuccess: () => setDialogOpen(false) },
      );
    } else {
      createThing.mutate(
        { categoryNodeId },
        { onSuccess: () => setDialogOpen(false) },
      );
    }
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteThing.mutate(deleteTarget.id, {
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
          事物
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          添加事物
        </Button>
      </Box>

      {!things?.length ? (
        <EmptyState
          title="暂无事物"
          description="先在分类体系中定义事物分类，然后添加事物"
          action={
            <Button variant="outlined" onClick={openCreate}>
              添加事物
            </Button>
          }
        />
      ) : (
        <Grid container spacing={2}>
          {things.map((thing) => {
            const node = nodeMap.get(thing.categoryNodeId);
            const chain = getAncestorChain(thing.categoryNodeId, nodeMap);
            const allAttrs = collectAttributes(chain);
            return (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={thing.id}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
                      <Typography variant="subtitle1" fontWeight="bold" sx={{ flex: 1 }}>
                        {node?.name ?? "未知分类"}
                      </Typography>
                      <Tooltip title="编辑">
                        <IconButton size="small" onClick={() => openEdit(thing)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="删除">
                        <IconButton size="small" color="error" onClick={() => setDeleteTarget(thing)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
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
                      {thing.id}
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
        <DialogTitle>{editingThing ? "编辑事物" : "添加事物"}</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "8px !important" }}>
          {(thingNodes ?? []).length === 0 ? (
            <Box sx={{ textAlign: "center", py: 2 }}>
              <Typography color="text.secondary" gutterBottom>
                还没有事物分类节点
              </Typography>
              <Button
                variant="outlined"
                onClick={() => {
                  setDialogOpen(false);
                  navigate(`/worlds/${worldId}/taxonomy/THING`);
                }}
              >
                去创建分类
              </Button>
            </Box>
          ) : (
            <TextField
              label="事物分类"
              value={categoryNodeId}
              onChange={(e) => setCategoryNodeId(e.target.value)}
              select
              required
              helperText="选择事物所属的分类节点"
            >
              {thingNodes!.map((n) => (
                <MenuItem key={n.id} value={n.id}>
                  {n.name}
                </MenuItem>
              ))}
            </TextField>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>取消</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={!categoryNodeId || createThing.isPending || updateThing.isPending}
          >
            {editingThing ? "保存" : "创建"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="删除事物"
        message="确定要删除此事物吗？相关的事件和关系不会被删除。"
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </Box>
  );
}
