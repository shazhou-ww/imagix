import type { TaxonomyNode, TaxonomyTree } from "@imagix/shared";
import CategoryIcon from "@mui/icons-material/Category";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  TextField,
  Typography,
} from "@mui/material";
import { useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useCharacters } from "@/api/hooks/useCharacters";
import { useRelationships } from "@/api/hooks/useRelationships";
import {
  useDeleteTaxonomyNode,
  useTaxonomyTree,
  useUpdateTaxonomyNode,
} from "@/api/hooks/useTaxonomy";
import { useThings } from "@/api/hooks/useThings";
import ConfirmDialog from "@/components/ConfirmDialog";
import DetailPageHeader from "@/components/DetailPageHeader";
import EditableField from "@/components/EditableField";

const TREE_LABELS: Record<string, string> = {
  CHAR: "角色分类",
  THING: "事物分类",
  REL: "关系类型",
};

/** Build ancestor chain for a node (bottom-up, returned top-down). */
function getAncestorChain(
  nodeId: string,
  nodeMap: Map<string, TaxonomyNode>,
): TaxonomyNode[] {
  const chain: TaxonomyNode[] = [];
  let cur = nodeMap.get(nodeId);
  while (cur) {
    chain.unshift(cur);
    cur = cur.parentId ? nodeMap.get(cur.parentId) : undefined;
  }
  return chain;
}

export default function TaxonomyNodeDetailPage() {
  const {
    worldId,
    tree: treeParam,
    nodeId,
  } = useParams<{
    worldId: string;
    tree: string;
    nodeId: string;
  }>();
  const navigate = useNavigate();
  const tree = treeParam as TaxonomyTree | undefined;

  const { data: nodes, isLoading } = useTaxonomyTree(worldId, tree);
  const { data: characters } = useCharacters(worldId);
  const { data: things } = useThings(worldId);
  const { data: relationships } = useRelationships(worldId);
  const updateNode = useUpdateTaxonomyNode(worldId ?? "", tree ?? "CHAR");
  const deleteNode = useDeleteTaxonomyNode(worldId ?? "", tree ?? "CHAR");

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editFormula, setEditFormula] = useState("");

  // Delete confirm
  const [deleteOpen, setDeleteOpen] = useState(false);

  const nodeMap = useMemo(() => {
    const map = new Map<string, TaxonomyNode>();
    for (const n of nodes ?? []) map.set(n.id, n);
    return map;
  }, [nodes]);

  const node = useMemo(
    () => (nodeId ? nodeMap.get(nodeId) : undefined),
    [nodeMap, nodeId],
  );

  // Child nodes
  const childNodes = useMemo(() => {
    if (!nodes || !nodeId) return [];
    return nodes
      .filter((n) => n.parentId === nodeId)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [nodes, nodeId]);

  // Entities using this classification node
  const usingEntities = useMemo(() => {
    if (!nodeId) return [];
    const entities: { id: string; name: string; type: string }[] = [];
    if (tree === "CHAR") {
      for (const c of characters ?? []) {
        if (c.categoryNodeId === nodeId) {
          entities.push({ id: c.id, name: c.name, type: "角色" });
        }
      }
    } else if (tree === "THING") {
      for (const t of things ?? []) {
        if (t.categoryNodeId === nodeId) {
          entities.push({ id: t.id, name: t.name, type: "事物" });
        }
      }
    } else if (tree === "REL") {
      for (const r of relationships ?? []) {
        if (r.typeNodeId === nodeId) {
          entities.push({ id: r.id, name: r.id, type: "关系" });
        }
      }
    }
    return entities;
  }, [nodeId, tree, characters, things, relationships]);

  if (!worldId || !tree || !nodeId) return null;

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!node) {
    return <Navigate to={`/worlds/${worldId}/taxonomy/${tree}`} replace />;
  }

  const ancestors = getAncestorChain(node.id, nodeMap);
  const isSystem = node.system;
  const treeLabel = TREE_LABELS[tree] ?? tree;

  const openEdit = () => {
    setEditName(node.name);
    setEditDesc(node.description ?? "");
    setEditFormula(node.timeFormula ?? "");
    setEditOpen(true);
  };

  const handleSaveEdit = () => {
    if (!editName.trim()) return;
    updateNode.mutate(
      {
        nodeId: node.id,
        body: {
          name: editName.trim(),
          description: editDesc.trim() || undefined,
          timeFormula: editFormula.trim() || undefined,
        },
      },
      { onSuccess: () => setEditOpen(false) },
    );
  };

  const handleDelete = () => {
    deleteNode.mutate(node.id, {
      onSuccess: () => navigate(`/worlds/${worldId}/taxonomy/${tree}`),
    });
  };

  const getEntityRoute = (entityId: string) => {
    const prefix = entityId.slice(0, 3);
    if (prefix === "chr") return `/worlds/${worldId}/characters/${entityId}`;
    if (prefix === "thg") return `/worlds/${worldId}/things/${entityId}`;
    if (prefix === "rel") return `/worlds/${worldId}/relationships/${entityId}`;
    return "#";
  };

  return (
    <Box>
      <DetailPageHeader
        breadcrumbs={[
          { label: treeLabel, to: `/worlds/${worldId}/taxonomy/${tree}` },
          ...ancestors.slice(0, -1).map((a) => ({
            label: a.name,
            to: `/worlds/${worldId}/taxonomy/${tree}/${a.id}`,
          })),
          { label: node.name },
        ]}
        title={node.name}
        subtitle={
          ancestors.length > 1
            ? ancestors.map((a) => a.name).join(" › ")
            : treeLabel
        }
        status={
          isSystem
            ? { label: "系统", color: "info" }
            : { label: "自定义", color: "default" }
        }
        actions={
          !isSystem ? (
            <>
              <Button size="small" startIcon={<EditIcon />} onClick={openEdit}>
                编辑
              </Button>
              <Button
                size="small"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={() => setDeleteOpen(true)}
              >
                删除
              </Button>
            </>
          ) : undefined
        }
      />

      {/* Basic Info */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          基本信息
        </Typography>
        {!isSystem ? (
          <>
            <EditableField
              label="名称"
              value={node.name}
              onSave={(v) =>
                updateNode.mutate({
                  nodeId: node.id,
                  body: { name: v },
                })
              }
              required
              saving={updateNode.isPending}
            />
            <EditableField
              label="描述"
              value={node.description ?? ""}
              onSave={(v) =>
                updateNode.mutate({
                  nodeId: node.id,
                  body: { description: v || undefined },
                })
              }
              multiline
              rows={2}
              placeholder="暂无描述"
              saving={updateNode.isPending}
            />
          </>
        ) : (
          <>
            <Box sx={{ mb: 1 }}>
              <Typography variant="caption" color="text.secondary">
                名称
              </Typography>
              <Typography variant="body1">{node.name}</Typography>
            </Box>
            {node.description && (
              <Box sx={{ mb: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  描述
                </Typography>
                <Typography variant="body2">{node.description}</Typography>
              </Box>
            )}
          </>
        )}
        {node.timeFormula && (
          <Box sx={{ mb: 1 }}>
            <Typography variant="caption" color="text.secondary">
              时间公式（JSONata）
            </Typography>
            <Typography
              variant="body2"
              sx={{
                fontFamily: "monospace",
                bgcolor: "action.hover",
                p: 0.5,
                borderRadius: 0.5,
                mt: 0.5,
              }}
            >
              {node.timeFormula}
            </Typography>
          </Box>
        )}
        {node.parentId && (
          <Box sx={{ mb: 1 }}>
            <Typography variant="caption" color="text.secondary">
              上级节点
            </Typography>
            <Box sx={{ mt: 0.5 }}>
              <Chip
                label={nodeMap.get(node.parentId)?.name ?? node.parentId}
                size="small"
                variant="outlined"
                onClick={() =>
                  navigate(
                    `/worlds/${worldId}/taxonomy/${tree}/${node.parentId}`,
                  )
                }
                sx={{ cursor: "pointer" }}
              />
            </Box>
          </Box>
        )}
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ mt: 1, display: "block" }}
        >
          ID: {node.id}
        </Typography>
      </Paper>

      {/* Child Nodes */}
      {childNodes.length > 0 && (
        <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            子节点（{childNodes.length}）
          </Typography>
          <List dense disablePadding>
            {childNodes.map((child) => (
              <ListItemButton
                key={child.id}
                onClick={() =>
                  navigate(`/worlds/${worldId}/taxonomy/${tree}/${child.id}`)
                }
              >
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <CategoryIcon fontSize="small" color="action" />
                </ListItemIcon>
                <ListItemText
                  primary={child.name}
                  secondary={child.description || undefined}
                  secondaryTypographyProps={{
                    noWrap: true,
                    sx: { maxWidth: 400 },
                  }}
                />
                {child.system && (
                  <Chip
                    label="系统"
                    size="small"
                    color="info"
                    variant="outlined"
                    sx={{ ml: 1, height: 20, fontSize: "0.7rem" }}
                  />
                )}
              </ListItemButton>
            ))}
          </List>
        </Paper>
      )}

      {/* Entities using this node */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          使用此分类的实体（{usingEntities.length}）
        </Typography>
        {usingEntities.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            暂无实体使用此分类
          </Typography>
        ) : (
          <List dense disablePadding>
            {usingEntities.map((entity) => (
              <ListItemButton
                key={entity.id}
                onClick={() => navigate(getEntityRoute(entity.id))}
              >
                <ListItemText primary={entity.name} secondary={entity.type} />
              </ListItemButton>
            ))}
          </List>
        )}
      </Paper>

      {/* Edit Dialog */}
      {!isSystem && (
        <Dialog
          open={editOpen}
          onClose={() => setEditOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>编辑分类节点</DialogTitle>
          <DialogContent
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: 2,
              pt: "8px !important",
            }}
          >
            <TextField
              label="节点名称"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              autoFocus
              required
            />
            <TextField
              label="描述（可选）"
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              multiline
              rows={2}
            />
            <TextField
              label="时间公式（可选，JSONata）"
              value={editFormula}
              onChange={(e) => setEditFormula(e.target.value)}
              multiline
              rows={2}
              helperText="用于计算实体的时间相关属性"
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditOpen(false)}>取消</Button>
            <Button
              variant="contained"
              onClick={handleSaveEdit}
              disabled={!editName.trim() || updateNode.isPending}
            >
              保存
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {/* Delete Confirm */}
      {!isSystem && (
        <ConfirmDialog
          open={deleteOpen}
          title="删除分类节点"
          message={`确定要删除「${node.name}」吗？${
            childNodes.length > 0
              ? `该节点下有 ${childNodes.length} 个子节点。`
              : ""
          }`}
          onConfirm={handleDelete}
          onClose={() => setDeleteOpen(false)}
          loading={deleteNode.isPending}
        />
      )}
    </Box>
  );
}
