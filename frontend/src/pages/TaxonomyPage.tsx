import type { TaxonomyTree, TaxonomyNode } from "@imagix/shared";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import SaveIcon from "@mui/icons-material/Save";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  MenuItem,
  Paper,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { useState, useMemo, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  useTaxonomyTree,
  useCreateTaxonomyNode,
  useUpdateTaxonomyNode,
  useDeleteTaxonomyNode,
} from "@/api/hooks/useTaxonomy";
import ConfirmDialog from "@/components/ConfirmDialog";
import EmptyState from "@/components/EmptyState";

const TREES: { value: TaxonomyTree; label: string }[] = [
  { value: "CHAR", label: "角色分类" },
  { value: "THING", label: "事物分类" },
  { value: "REL", label: "关系类型" },
];

// ---------------------------------------------------------------------------
// Tree node renderer (left panel)
// ---------------------------------------------------------------------------

interface TreeNodeProps {
  node: TaxonomyNode;
  nodes: TaxonomyNode[];
  depth: number;
  selectedId: string | null;
  onSelect: (node: TaxonomyNode) => void;
  onAddChild: (parentId: string) => void;
}

function TreeNodeItem({ node, nodes, depth, selectedId, onSelect, onAddChild }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(true);
  const children = nodes.filter((n) => n.parentId === node.id);
  const isSelected = selectedId === node.id;

  return (
    <Box>
      <Box
        onClick={() => onSelect(node)}
        sx={{
          display: "flex",
          alignItems: "center",
          pl: depth * 2.5,
          py: 0.75,
          cursor: "pointer",
          bgcolor: isSelected ? "primary.50" : "transparent",
          borderLeft: isSelected ? 3 : 3,
          borderColor: isSelected ? "primary.main" : "transparent",
          "&:hover": { bgcolor: isSelected ? "primary.50" : "action.hover" },
          transition: "all 0.15s",
        }}
      >
        <IconButton
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
          sx={{ visibility: children.length ? "visible" : "hidden", mr: 0.5 }}
        >
          {expanded ? <ExpandMoreIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
        </IconButton>
        <Typography
          sx={{
            flex: 1,
            fontWeight: isSelected ? 700 : children.length ? 600 : 400,
            color: isSelected ? "primary.main" : "text.primary",
            fontSize: "0.9rem",
          }}
        >
          {node.name}
        </Typography>
        {children.length > 0 && (
          <Chip
            label={`${children.length}`}
            size="small"
            variant="outlined"
            sx={{ mr: 0.5, height: 20, fontSize: "0.7rem" }}
          />
        )}
        <Tooltip title="添加子分类">
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onAddChild(node.id);
            }}
          >
            <AddIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
      {expanded &&
        children.map((child) => (
          <TreeNodeItem
            key={child.id}
            node={child}
            nodes={nodes}
            depth={depth + 1}
            selectedId={selectedId}
            onSelect={onSelect}
            onAddChild={onAddChild}
          />
        ))}
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Detail panel (right side)
// ---------------------------------------------------------------------------

function NodeDetailPanel({
  node,
  nodes,
  onSave,
  onDelete,
  saving,
}: {
  node: TaxonomyNode;
  nodes: TaxonomyNode[];
  onSave: (nodeId: string, body: any) => void;
  onDelete: (node: TaxonomyNode) => void;
  saving: boolean;
}) {
  const [name, setName] = useState(node.name);
  const [timeFormula, setTimeFormula] = useState(node.timeFormula ?? "");
  const [dirty, setDirty] = useState(false);

  const resetToNode = useCallback((n: TaxonomyNode) => {
    setName(n.name);
    setTimeFormula(n.timeFormula ?? "");
    setDirty(false);
  }, []);

  const nodeKey = node.id;
  const [lastKey, setLastKey] = useState(nodeKey);
  if (nodeKey !== lastKey) {
    resetToNode(node);
    setLastKey(nodeKey);
  }

  const ancestorPath = useMemo(() => {
    const path: TaxonomyNode[] = [];
    let current: TaxonomyNode | undefined = node;
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    while (current?.parentId) {
      const parent = nodeMap.get(current.parentId);
      if (!parent) break;
      path.unshift(parent);
      current = parent;
    }
    return path;
  }, [node, nodes]);

  const markDirty = () => setDirty(true);

  const handleSave = () => {
    if (!name.trim()) return;
    onSave(node.id, {
      name: name.trim(),
      parentId: node.parentId,
      timeFormula: timeFormula.trim() || undefined,
    });
    setDirty(false);
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, p: 2.5 }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Typography variant="h6" fontWeight="bold" sx={{ flex: 1 }}>
          节点详情
        </Typography>
        <Button
          variant="contained"
          size="small"
          startIcon={<SaveIcon />}
          onClick={handleSave}
          disabled={!dirty || !name.trim() || saving || node.system}
        >
          保存
        </Button>
        {!node.system && (
          <Tooltip title="删除此节点">
            <IconButton size="small" color="error" onClick={() => onDelete(node)}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {/* Classification path */}
      {ancestorPath.length > 0 && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexWrap: "wrap" }}>
          <Typography variant="caption" color="text.secondary">
            路径:
          </Typography>
          {ancestorPath.map((a, i) => (
            <Box key={a.id} sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <Chip label={a.name} size="small" variant="outlined" sx={{ height: 22, fontSize: "0.75rem" }} />
              {i < ancestorPath.length - 1 && (
                <Typography variant="caption" color="text.secondary">›</Typography>
              )}
            </Box>
          ))}
          <Typography variant="caption" color="text.secondary">›</Typography>
          <Chip label={node.name} size="small" color="primary" sx={{ height: 22, fontSize: "0.75rem" }} />
        </Box>
      )}

      {/* Name edit */}
      <TextField
        label="分类名称"
        value={name}
        onChange={(e) => { setName(e.target.value); markDirty(); }}
        size="small"
        required
        disabled={node.system}
      />

      <Divider />

      {/* Time formula */}
      <Box>
        <Typography variant="subtitle2" gutterBottom>
          时间派生公式
        </Typography>
        <TextField
          size="small"
          value={timeFormula}
          onChange={(e) => { setTimeFormula(e.target.value); markDirty(); }}
          multiline
          rows={3}
          fullWidth
          disabled={node.system}
          placeholder='例如: { "年龄": attributes.年龄 + (currentTime - lastTime) }'
          helperText={node.system ? "系统预置公式，不可修改" : "JSONata 表达式，事件溯源回放时自动执行。子节点继承，可覆盖。"}
        />
      </Box>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function TaxonomyPage() {
  const { worldId, tree } = useParams<{ worldId: string; tree: string }>();
  const navigate = useNavigate();
  const currentTree = (tree as TaxonomyTree) ?? "CHAR";

  const { data: nodes, isLoading } = useTaxonomyTree(worldId, currentTree);
  const createNode = useCreateTaxonomyNode(worldId!, currentTree);
  const updateNode = useUpdateTaxonomyNode(worldId!, currentTree);
  const deleteNode = useDeleteTaxonomyNode(worldId!, currentTree);

  const [selectedNode, setSelectedNode] = useState<TaxonomyNode | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createParentId, setCreateParentId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TaxonomyNode | null>(null);

  const rootNodes = useMemo(
    () => (nodes ?? []).filter((n) => n.parentId === null),
    [nodes],
  );

  const activeNode = useMemo(() => {
    if (!selectedNode || !nodes) return null;
    return nodes.find((n) => n.id === selectedNode.id) ?? null;
  }, [selectedNode, nodes]);

  const openCreate = (initialParentId: string | null = null) => {
    setCreateName("");
    setCreateParentId(initialParentId);
    setCreateDialogOpen(true);
  };

  const handleCreate = () => {
    if (!createName.trim()) return;
    createNode.mutate(
      { name: createName.trim(), parentId: createParentId },
      {
        onSuccess: (newNode) => {
          setCreateDialogOpen(false);
          setSelectedNode(newNode);
        },
      },
    );
  };

  const handleSaveNode = (nodeId: string, body: any) => {
    updateNode.mutate({ nodeId, body });
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteNode.mutate(deleteTarget.id, {
      onSuccess: () => {
        setDeleteTarget(null);
        if (selectedNode?.id === deleteTarget.id) setSelectedNode(null);
      },
    });
  };

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
        <Typography variant="h4" fontWeight="bold">
          分类体系
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => openCreate()}>
          添加根节点
        </Button>
      </Box>

      <Tabs
        value={currentTree}
        onChange={(_, v) => {
          setSelectedNode(null);
          navigate(`/worlds/${worldId}/taxonomy/${v}`);
        }}
        sx={{ mb: 3 }}
      >
        {TREES.map((t) => (
          <Tab key={t.value} value={t.value} label={t.label} />
        ))}
      </Tabs>

      {isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress />
        </Box>
      ) : !rootNodes.length ? (
        <EmptyState
          title="暂无分类节点"
          description={`为「${TREES.find((t) => t.value === currentTree)?.label}」添加分类层级`}
          action={
            <Button variant="outlined" onClick={() => openCreate()}>
              添加根节点
            </Button>
          }
        />
      ) : (
        <Box sx={{ display: "flex", gap: 2, minHeight: 400 }}>
          {/* Left: Tree */}
          <Paper
            variant="outlined"
            sx={{ width: 320, minWidth: 260, flexShrink: 0, overflow: "auto", py: 1 }}
          >
            {rootNodes.map((node) => (
              <TreeNodeItem
                key={node.id}
                node={node}
                nodes={nodes!}
                depth={0}
                selectedId={activeNode?.id ?? null}
                onSelect={setSelectedNode}
                onAddChild={(pid) => openCreate(pid)}
              />
            ))}
          </Paper>

          {/* Right: Detail */}
          <Paper variant="outlined" sx={{ flex: 1, overflow: "auto" }}>
            {activeNode ? (
              <NodeDetailPanel
                key={activeNode.id}
                node={activeNode}
                nodes={nodes!}
                onSave={handleSaveNode}
                onDelete={setDeleteTarget}
                saving={updateNode.isPending}
              />
            ) : (
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "100%",
                  color: "text.secondary",
                }}
              >
                <Typography>← 选择一个分类节点查看详情</Typography>
              </Box>
            )}
          </Paper>
        </Box>
      )}

      {/* Create Node Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>添加分类节点</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "8px !important" }}>
          <TextField
            label="分类名称"
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            autoFocus
            required
          />
          <TextField
            label="父节点"
            value={createParentId ?? ""}
            onChange={(e) => setCreateParentId(e.target.value || null)}
            select
            slotProps={{ inputLabel: { htmlFor: undefined } }}
          >
            <MenuItem value="">无（根节点）</MenuItem>
            {(nodes ?? []).map((n) => (
              <MenuItem key={n.id} value={n.id}>
                {n.name}
              </MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>取消</Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={!createName.trim() || createNode.isPending}
          >
            创建
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="删除分类节点"
        message={`确定要删除「${deleteTarget?.name}」吗？其子节点也将被影响。`}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </Box>
  );
}
