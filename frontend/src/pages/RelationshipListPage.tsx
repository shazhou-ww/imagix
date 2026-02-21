import type { Relationship, TaxonomyNode } from "@imagix/shared";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
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
import { useCallback, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  useRelationships,
  useCreateRelationship,
  useDeleteRelationship,
} from "@/api/hooks/useRelationships";
import { useTaxonomyTree } from "@/api/hooks/useTaxonomy";
import { useCharacters } from "@/api/hooks/useCharacters";
import { useThings } from "@/api/hooks/useThings";
import ConfirmDialog from "@/components/ConfirmDialog";
import EpochTimeInput from "@/components/EpochTimeInput";
import EmptyState from "@/components/EmptyState";

export default function RelationshipListPage() {
  const { worldId } = useParams<{ worldId: string }>();
  const { data: relationships, isLoading } = useRelationships(worldId);
  const { data: relNodes } = useTaxonomyTree(worldId, "REL");
  const { data: characters } = useCharacters(worldId);
  const { data: things } = useThings(worldId);
  const createRel = useCreateRelationship(worldId!);
  const deleteRel = useDeleteRelationship(worldId!);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [typeNodeId, setTypeNodeId] = useState("");
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [establishTime, setEstablishTime] = useState<number>(0);
  const [deleteTarget, setDeleteTarget] = useState<Relationship | null>(null);

  const relNodeMap = useMemo(() => {
    const map = new Map<string, TaxonomyNode>();
    for (const n of relNodes ?? []) map.set(n.id, n);
    return map;
  }, [relNodes]);

  // Direction sub-nodes: the 3 system children of the REL root ("角色→角色", "角色→事物", "事物→事物")
  const directionNodes = useMemo(
    () => (relNodes ?? []).filter((n) => n.parentId !== null && relNodeMap.get(n.parentId!)?.parentId === null),
    [relNodes, relNodeMap],
  );

  // Leaf type nodes: nodes whose parent is one of the direction nodes (user-created relationship types)
  const typeNodes = useMemo(
    () => {
      const dirIds = new Set(directionNodes.map((n) => n.id));
      return (relNodes ?? []).filter((n) => n.parentId && dirIds.has(n.parentId));
    },
    [relNodes, directionNodes],
  );

  /** Given a type node id, find its direction ancestor name to determine from/to entity types */
  const getDirection = useCallback(
    (nodeId: string): "char-char" | "char-thing" | "thing-thing" | null => {
      const dirIds = new Set(directionNodes.map((n) => n.id));
      let current = nodeId;
      // Walk up until we find a direction node
      while (current) {
        if (dirIds.has(current)) {
          const name = relNodeMap.get(current)?.name ?? "";
          if (name.includes("角色") && name.includes("事物")) return "char-thing";
          if (name.includes("事物")) return "thing-thing";
          return "char-char";
        }
        const parent = relNodeMap.get(current)?.parentId;
        if (!parent) break;
        current = parent;
      }
      return null;
    },
    [directionNodes, relNodeMap],
  );

  const direction = getDirection(typeNodeId);

  // Build entity options based on direction type
  const charOptions = useMemo(
    () => (characters ?? []).map((c) => ({ id: c.id, label: c.name })),
    [characters],
  );
  const thingOptions = useMemo(
    () => (things ?? []).map((t) => ({ id: t.id, label: t.name })),
    [things],
  );

  const fromOptions = direction === "thing-thing" ? thingOptions : charOptions;
  const toOptions = direction === "char-char" ? charOptions : thingOptions;

  // Label map for displaying entity names on cards
  const entityLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of characters ?? []) map.set(c.id, c.name);
    for (const t of things ?? []) map.set(t.id, t.name);
    return map;
  }, [characters, things]);

  const openCreate = () => {
    setTypeNodeId("");
    setFromId("");
    setToId("");
    setEstablishTime(0);
    setDialogOpen(true);
  };

  const handleTypeChange = (nodeId: string) => {
    setTypeNodeId(nodeId);
    setFromId("");
    setToId("");
  };

  const handleCreate = () => {
    if (!typeNodeId || !fromId || !toId) return;
    createRel.mutate(
      { typeNodeId, fromId, toId, establishTime },
      { onSuccess: () => setDialogOpen(false) },
    );
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteRel.mutate(deleteTarget.id, {
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
          关系
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          添加关系
        </Button>
      </Box>

      {!relationships?.length ? (
        <EmptyState
          title="暂无关系"
          description="在分类体系中定义关系类型，然后建立实体间的关系"
          action={
            <Button variant="outlined" onClick={openCreate}>
              添加关系
            </Button>
          }
        />
      ) : (
        <Grid container spacing={2}>
          {relationships.map((rel) => {
            const typeNode = relNodeMap.get(rel.typeNodeId);
            return (
              <Grid size={{ xs: 12, sm: 6 }} key={rel.id}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
                      <Chip label={typeNode?.name ?? "未知类型"} size="small" color="primary" />
                      <Box sx={{ flex: 1 }} />
                      <Tooltip title="删除">
                        <IconButton size="small" color="error" onClick={() => setDeleteTarget(rel)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Typography variant="body2" noWrap sx={{ flex: 1 }}>
                        {entityLabelMap.get(rel.fromId) ?? rel.fromId}
                      </Typography>
                      <ArrowForwardIcon fontSize="small" color="action" />
                      <Typography variant="body2" noWrap sx={{ flex: 1 }}>
                        {entityLabelMap.get(rel.toId) ?? rel.toId}
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>添加关系</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "8px !important" }}>
          <TextField
            label="关系类型"
            value={typeNodeId}
            onChange={(e) => handleTypeChange(e.target.value)}
            select
            slotProps={{ inputLabel: { htmlFor: undefined } }}
            required
            helperText="在分类体系的关系类型树中，于对应方向分类下定义具体关系类型"
          >
            {directionNodes.map((dirNode) => {
              const children = typeNodes.filter((n) => n.parentId === dirNode.id);
              return [
                <MenuItem key={`header-${dirNode.id}`} disabled sx={{ opacity: 0.7, fontWeight: "bold", fontSize: "0.85rem" }}>
                  {dirNode.name}
                </MenuItem>,
                ...children.map((n) => (
                  <MenuItem key={n.id} value={n.id} sx={{ pl: 4 }}>
                    {n.name}
                  </MenuItem>
                )),
              ];
            })}
          </TextField>
          <TextField
            label={direction === "thing-thing" ? "源事物" : "源角色"}
            value={fromId}
            onChange={(e) => setFromId(e.target.value)}
            select
            slotProps={{ inputLabel: { htmlFor: undefined } }}
            required
            disabled={!direction}
          >
            {fromOptions.map((o) => (
              <MenuItem key={o.id} value={o.id}>
                {o.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label={direction === "char-char" ? "目标角色" : "目标事物"}
            value={toId}
            onChange={(e) => setToId(e.target.value)}
            select
            slotProps={{ inputLabel: { htmlFor: undefined } }}
            required
            disabled={!direction}
          >
            {toOptions.map((o) => (
              <MenuItem key={o.id} value={o.id}>
                {o.label}
              </MenuItem>
            ))}
          </TextField>
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>建立时间</Typography>
            <EpochTimeInput value={establishTime} onChange={setEstablishTime} showPreview />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
              创建后会自动生成「建立」事件。
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>取消</Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={!typeNodeId || !fromId || !toId || fromId === toId || createRel.isPending}
          >
            创建
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="删除关系"
        message="确定要删除此关系吗？"
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </Box>
  );
}
