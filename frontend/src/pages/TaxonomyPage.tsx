import type { TaxonomyTree, TaxonomyNode, AttributeDefinition } from "@imagix/shared";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { useState, useMemo } from "react";
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

interface TreeNodeProps {
  node: TaxonomyNode;
  nodes: TaxonomyNode[];
  depth: number;
  onEdit: (node: TaxonomyNode) => void;
  onDelete: (node: TaxonomyNode) => void;
  onAddChild: (parentId: string) => void;
}

function TreeNodeItem({ node, nodes, depth, onEdit, onDelete, onAddChild }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(true);
  const children = nodes.filter((n) => n.parentId === node.id);

  return (
    <Box>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          pl: depth * 3,
          py: 0.5,
          "&:hover": { bgcolor: "action.hover" },
          borderRadius: 1,
        }}
      >
        <IconButton
          size="small"
          onClick={() => setExpanded(!expanded)}
          sx={{ visibility: children.length ? "visible" : "hidden" }}
        >
          {expanded ? <ExpandMoreIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
        </IconButton>
        <Typography sx={{ flex: 1, fontWeight: children.length ? 600 : 400 }}>
          {node.name}
        </Typography>
        {node.attributeDefinitions.length > 0 && (
          <Box sx={{ display: "flex", gap: 0.5, mr: 1 }}>
            {node.attributeDefinitions.map((attr) => (
              <Chip key={attr.name} label={attr.name} size="small" variant="outlined" />
            ))}
          </Box>
        )}
        <Tooltip title="添加子节点">
          <IconButton size="small" onClick={() => onAddChild(node.id)}>
            <AddIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="编辑">
          <IconButton size="small" onClick={() => onEdit(node)}>
            <EditIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="删除">
          <IconButton size="small" color="error" onClick={() => onDelete(node)}>
            <DeleteIcon fontSize="small" />
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
            onEdit={onEdit}
            onDelete={onDelete}
            onAddChild={onAddChild}
          />
        ))}
    </Box>
  );
}

const EMPTY_ATTR: AttributeDefinition = { name: "", type: "string" };

export default function TaxonomyPage() {
  const { worldId, tree } = useParams<{ worldId: string; tree: string }>();
  const navigate = useNavigate();
  const currentTree = (tree as TaxonomyTree) ?? "CHAR";

  const { data: nodes, isLoading } = useTaxonomyTree(worldId, currentTree);
  const createNode = useCreateTaxonomyNode(worldId!, currentTree);
  const updateNode = useUpdateTaxonomyNode(worldId!, currentTree);
  const deleteNode = useDeleteTaxonomyNode(worldId!, currentTree);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingNode, setEditingNode] = useState<TaxonomyNode | null>(null);
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState<string | null>(null);
  const [attrs, setAttrs] = useState<AttributeDefinition[]>([]);
  const [timeFormula, setTimeFormula] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<TaxonomyNode | null>(null);

  const rootNodes = useMemo(
    () => (nodes ?? []).filter((n) => n.parentId === null),
    [nodes],
  );

  const openCreate = (initialParentId: string | null = null) => {
    setEditingNode(null);
    setName("");
    setParentId(initialParentId);
    setAttrs([]);
    setTimeFormula("");
    setDialogOpen(true);
  };

  const openEdit = (node: TaxonomyNode) => {
    setEditingNode(node);
    setName(node.name);
    setParentId(node.parentId);
    setAttrs(node.attributeDefinitions.length ? [...node.attributeDefinitions] : []);
    setTimeFormula(node.timeFormula ?? "");
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!name.trim()) return;
    const validAttrs = attrs.filter((a) => a.name.trim());
    const body = {
      name: name.trim(),
      parentId,
      attributeDefinitions: validAttrs.length ? validAttrs : undefined,
      timeFormula: timeFormula.trim() || undefined,
    };
    if (editingNode) {
      updateNode.mutate(
        { nodeId: editingNode.id, body },
        { onSuccess: () => setDialogOpen(false) },
      );
    } else {
      createNode.mutate(body, { onSuccess: () => setDialogOpen(false) });
    }
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteNode.mutate(deleteTarget.id, {
      onSuccess: () => setDeleteTarget(null),
    });
  };

  const addAttr = () => setAttrs([...attrs, { ...EMPTY_ATTR }]);
  const removeAttr = (idx: number) => setAttrs(attrs.filter((_, i) => i !== idx));
  const updateAttr = (idx: number, field: keyof AttributeDefinition, value: any) =>
    setAttrs(attrs.map((a, i) => (i === idx ? { ...a, [field]: value } : a)));

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
        onChange={(_, v) => navigate(`/worlds/${worldId}/taxonomy/${v}`)}
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
        <Box sx={{ border: 1, borderColor: "divider", borderRadius: 2, p: 2 }}>
          {rootNodes.map((node) => (
            <TreeNodeItem
              key={node.id}
              node={node}
              nodes={nodes!}
              depth={0}
              onEdit={openEdit}
              onDelete={setDeleteTarget}
              onAddChild={(pid) => openCreate(pid)}
            />
          ))}
        </Box>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingNode ? "编辑分类节点" : "添加分类节点"}</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "8px !important" }}>
          <TextField
            label="节点名称"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            required
          />
          <TextField
            label="父节点"
            value={parentId ?? ""}
            onChange={(e) => setParentId(e.target.value || null)}
            select
          >
            <MenuItem value="">无（根节点）</MenuItem>
            {(nodes ?? []).map((n) => (
              <MenuItem key={n.id} value={n.id} disabled={n.id === editingNode?.id}>
                {n.name}
              </MenuItem>
            ))}
          </TextField>

          <Box>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
              <Typography variant="subtitle2">属性定义</Typography>
              <Button size="small" startIcon={<AddIcon />} onClick={addAttr}>
                添加属性
              </Button>
            </Box>
            {attrs.map((attr, idx) => (
              <Box key={idx} sx={{ display: "flex", gap: 1, mb: 1 }}>
                <TextField
                  size="small"
                  label="属性名"
                  value={attr.name}
                  onChange={(e) => updateAttr(idx, "name", e.target.value)}
                  sx={{ flex: 1 }}
                />
                <TextField
                  size="small"
                  label="类型"
                  value={attr.type}
                  onChange={(e) => updateAttr(idx, "type", e.target.value)}
                  select
                  sx={{ width: 120 }}
                >
                  <MenuItem value="string">文本</MenuItem>
                  <MenuItem value="number">数字</MenuItem>
                  <MenuItem value="boolean">布尔</MenuItem>
                  <MenuItem value="enum">枚举</MenuItem>
                </TextField>
                {attr.type === "enum" && (
                  <TextField
                    size="small"
                    label="枚举值 (逗号分隔)"
                    value={(attr.enumValues ?? []).join(",")}
                    onChange={(e) =>
                      updateAttr(
                        idx,
                        "enumValues",
                        e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                      )
                    }
                    sx={{ flex: 1 }}
                  />
                )}
                <IconButton size="small" color="error" onClick={() => removeAttr(idx)}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Box>
            ))}
          </Box>

          <TextField
            label="时间派生公式 (JSONata，可选)"
            value={timeFormula}
            onChange={(e) => setTimeFormula(e.target.value)}
            multiline
            rows={2}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>取消</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={!name.trim() || createNode.isPending || updateNode.isPending}
          >
            {editingNode ? "保存" : "创建"}
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
