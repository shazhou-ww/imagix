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
import { useMemo, useState } from "react";
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
import EmptyState from "@/components/EmptyState";

export default function RelationshipListPage() {
  const { worldId } = useParams<{ worldId: string }>();
  const { data: relationships, isLoading } = useRelationships(worldId);
  const { data: relNodes } = useTaxonomyTree(worldId, "REL");
  const { data: charNodes } = useTaxonomyTree(worldId, "CHAR");
  const { data: characters } = useCharacters(worldId);
  const { data: things } = useThings(worldId);
  const createRel = useCreateRelationship(worldId!);
  const deleteRel = useDeleteRelationship(worldId!);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [typeNodeId, setTypeNodeId] = useState("");
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Relationship | null>(null);

  const relNodeMap = useMemo(() => {
    const map = new Map<string, TaxonomyNode>();
    for (const n of relNodes ?? []) map.set(n.id, n);
    return map;
  }, [relNodes]);

  // Build entity options for from/to selectors
  const entityOptions = useMemo(() => {
    const charNodeMap = new Map<string, TaxonomyNode>();
    for (const n of charNodes ?? []) charNodeMap.set(n.id, n);
    const opts: { id: string; label: string }[] = [];
    for (const c of characters ?? []) {
      const node = charNodeMap.get(c.categoryNodeId);
      opts.push({ id: c.id, label: `[角色] ${node?.name ?? c.id}` });
    }
    for (const t of things ?? []) {
      opts.push({ id: t.id, label: `[事物] ${t.id}` });
    }
    return opts;
  }, [characters, things, charNodes]);

  const entityLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const o of entityOptions) map.set(o.id, o.label);
    return map;
  }, [entityOptions]);

  const openCreate = () => {
    setTypeNodeId(relNodes?.[0]?.id ?? "");
    setFromId("");
    setToId("");
    setDialogOpen(true);
  };

  const handleCreate = () => {
    if (!typeNodeId || !fromId || !toId) return;
    createRel.mutate(
      { typeNodeId, fromId, toId },
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
            onChange={(e) => setTypeNodeId(e.target.value)}
            select
            required
            helperText="请先在分类体系中定义关系类型树"
          >
            {(relNodes ?? []).map((n) => (
              <MenuItem key={n.id} value={n.id}>
                {n.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="源实体 (From)"
            value={fromId}
            onChange={(e) => setFromId(e.target.value)}
            select
            required
          >
            {entityOptions.map((o) => (
              <MenuItem key={o.id} value={o.id}>
                {o.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="目标实体 (To)"
            value={toId}
            onChange={(e) => setToId(e.target.value)}
            select
            required
          >
            {entityOptions.map((o) => (
              <MenuItem key={o.id} value={o.id}>
                {o.label}
              </MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>取消</Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={!typeNodeId || !fromId || !toId || createRel.isPending}
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
