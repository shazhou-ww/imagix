import type { Place } from "@imagix/shared";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import PlaceIcon from "@mui/icons-material/Place";
import SearchIcon from "@mui/icons-material/Search";
import SubdirectoryArrowRightIcon from "@mui/icons-material/SubdirectoryArrowRight";
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
  IconButton,
  InputAdornment,
  MenuItem,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { useCallback, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  useCreatePlace,
  useDeletePlace,
  usePlaces,
} from "@/api/hooks/usePlaces";
import ConfirmDialog from "@/components/ConfirmDialog";
import EmptyState from "@/components/EmptyState";

/** Build a tree structure from flat place list */
interface PlaceNode {
  place: Place;
  children: PlaceNode[];
}

function buildTree(places: Place[]): PlaceNode[] {
  const map = new Map<string, PlaceNode>();
  for (const p of places) map.set(p.id, { place: p, children: [] });

  const roots: PlaceNode[] = [];
  for (const node of map.values()) {
    if (node.place.parentId) {
      const parent = map.get(node.place.parentId);
      if (parent) parent.children.push(node);
      else roots.push(node); // orphan — treat as root
    } else {
      roots.push(node);
    }
  }

  // Sort children alphabetically
  const sortChildren = (nodes: PlaceNode[]) => {
    nodes.sort((a, b) => a.place.name.localeCompare(b.place.name));
    for (const n of nodes) sortChildren(n.children);
  };
  sortChildren(roots);
  return roots;
}

/** Get the full ancestor path label for a place */
function getAncestorPath(
  placeId: string,
  placeMap: Map<string, Place>,
): string {
  const chain: string[] = [];
  let cur = placeMap.get(placeId);
  while (cur) {
    chain.unshift(cur.name);
    cur = cur.parentId ? placeMap.get(cur.parentId) : undefined;
  }
  return chain.join(" › ");
}

/** Count all descendants */
function countDescendants(node: PlaceNode): number {
  let count = node.children.length;
  for (const child of node.children) count += countDescendants(child);
  return count;
}

export default function PlaceListPage() {
  const { worldId } = useParams<{ worldId: string }>();
  const navigate = useNavigate();
  const { data: places, isLoading } = usePlaces(worldId);
  const createPlace = useCreatePlace(worldId ?? "");
  const deletePlace = useDeletePlace(worldId ?? "");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Place | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Filter state
  const [filterName, setFilterName] = useState("");

  const placeMap = useMemo(() => {
    const map = new Map<string, Place>();
    for (const p of places ?? []) map.set(p.id, p);
    return map;
  }, [places]);

  const tree = useMemo(() => buildTree(places ?? []), [places]);

  // Filtered tree: keep nodes matching search and their ancestors
  const filteredTree = useMemo(() => {
    if (!filterName.trim()) return tree;
    const q = filterName.trim().toLowerCase();
    const filterNodes = (nodes: PlaceNode[]): PlaceNode[] => {
      const result: PlaceNode[] = [];
      for (const node of nodes) {
        const selfMatch =
          node.place.name.toLowerCase().includes(q) ||
          (node.place.description ?? "").toLowerCase().includes(q);
        const filteredChildren = filterNodes(node.children);
        if (selfMatch || filteredChildren.length > 0) {
          result.push({
            ...node,
            children: selfMatch ? node.children : filteredChildren,
          });
        }
      }
      return result;
    };
    return filterNodes(tree);
  }, [tree, filterName]);

  // Auto-expand nodes when filtering
  const effectiveExpandedIds = useMemo(() => {
    if (!filterName.trim()) return expandedIds;
    // When filtering, expand all to show matches
    const ids = new Set<string>();
    const collectIds = (nodes: PlaceNode[]) => {
      for (const node of nodes) {
        if (node.children.length > 0) ids.add(node.place.id);
        collectIds(node.children);
      }
    };
    collectIds(filteredTree);
    return ids;
  }, [filteredTree, filterName, expandedIds]);

  const parentOptions = useMemo(() => {
    if (!places) return [];
    return places;
  }, [places]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const openCreate = (presetParentId?: string) => {
    setName("");
    setParentId(presetParentId ?? null);
    setDescription("");
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!name.trim()) return;
    createPlace.mutate(
      {
        name: name.trim(),
        parentId,
        description: description.trim() || undefined,
      },
      { onSuccess: () => setDialogOpen(false) },
    );
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deletePlace.mutate(deleteTarget.id, {
      onSuccess: () => {
        setDeleteTarget(null);
        setDeleteError("");
      },
      onError: (err) => {
        setDeleteError(
          err instanceof Error ? err.message : "删除失败，该地点可能有子地点",
        );
      },
    });
  };

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  const renderNode = (node: PlaceNode, depth: number) => {
    const hasChildren = node.children.length > 0;
    const isExpanded = effectiveExpandedIds.has(node.place.id);
    const descendantCount = countDescendants(node);

    return (
      <Box key={node.place.id}>
        <Card
          sx={{
            ml: depth * 3,
            mb: 1,
            borderLeft: depth > 0 ? "3px solid" : "none",
            borderLeftColor: "primary.light",
          }}
        >
          <CardContent
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.5,
              py: 1.5,
              "&:last-child": { pb: 1.5 },
            }}
          >
            {/* Expand/collapse toggle */}
            {hasChildren ? (
              <IconButton
                size="small"
                onClick={() => toggleExpand(node.place.id)}
              >
                {isExpanded ? (
                  <ExpandLessIcon fontSize="small" />
                ) : (
                  <ExpandMoreIcon fontSize="small" />
                )}
              </IconButton>
            ) : (
              <Box sx={{ width: 34 }} /> // spacer
            )}

            <PlaceIcon color="primary" fontSize="small" />

            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                variant="subtitle1"
                fontWeight="bold"
                noWrap
                sx={{
                  cursor: "pointer",
                  "&:hover": { color: "primary.main" },
                }}
                onClick={() =>
                  navigate(`/worlds/${worldId}/places/${node.place.id}`)
                }
              >
                {node.place.name}
              </Typography>
              {node.place.description && (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  noWrap
                  sx={{ maxWidth: 400 }}
                >
                  {node.place.description}
                </Typography>
              )}
            </Box>

            {/* Badges */}
            {descendantCount > 0 && (
              <Chip
                label={`${descendantCount} 个子地点`}
                size="small"
                variant="outlined"
                sx={{ height: 22, fontSize: "0.75rem" }}
              />
            )}
            {node.place.parentId && (
              <Chip
                icon={<SubdirectoryArrowRightIcon sx={{ fontSize: 14 }} />}
                label={placeMap.get(node.place.parentId)?.name ?? ""}
                size="small"
                variant="outlined"
                color="default"
                sx={{ height: 22, fontSize: "0.75rem" }}
              />
            )}

            {/* Actions */}
            <Tooltip title="添加子地点">
              <IconButton
                size="small"
                color="primary"
                onClick={() => openCreate(node.place.id)}
              >
                <AddIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="删除">
              <IconButton
                size="small"
                color="error"
                onClick={() => {
                  setDeleteError("");
                  setDeleteTarget(node.place);
                }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </CardContent>
        </Card>

        {/* Children */}
        {hasChildren && isExpanded && (
          <Box>
            {node.children.map((child) => renderNode(child, depth + 1))}
          </Box>
        )}
      </Box>
    );
  };

  return (
    <Box>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          mb: 2,
        }}
      >
        <Typography variant="h4" fontWeight="bold">
          地点
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => openCreate()}
        >
          添加地点
        </Button>
      </Box>

      {(places?.length ?? 0) > 0 && (
        <Box sx={{ display: "flex", gap: 2, mb: 2, flexWrap: "wrap" }}>
          <TextField
            size="small"
            placeholder="搜索地点"
            value={filterName}
            onChange={(e) => setFilterName(e.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              },
            }}
            sx={{ minWidth: 220 }}
          />
        </Box>
      )}

      {!filteredTree.length ? (
        <EmptyState
          title={places?.length ? "无匹配地点" : "暂无地点"}
          description={
            places?.length
              ? "尝试调整搜索关键词"
              : "添加地点来构建世界的空间结构"
          }
          action={
            places?.length ? (
              <Button variant="outlined" onClick={() => setFilterName("")}>
                清除搜索
              </Button>
            ) : (
              <Button variant="outlined" onClick={() => openCreate()}>
                添加地点
              </Button>
            )
          }
        />
      ) : (
        <Box>{filteredTree.map((node) => renderNode(node, 0))}</Box>
      )}

      {/* Create / Edit Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>添加地点</DialogTitle>
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
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
          />
          <TextField
            label="上级地点"
            select
            value={parentId ?? ""}
            onChange={(e) =>
              setParentId(e.target.value === "" ? null : e.target.value)
            }
          >
            <MenuItem value="">
              <em>无（顶层地点）</em>
            </MenuItem>
            {parentOptions.map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {getAncestorPath(p.id, placeMap)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="描述"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            multiline
            rows={3}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>取消</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={!name.trim() || createPlace.isPending}
          >
            创建
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="删除地点"
        message={
          deleteError
            ? deleteError
            : "确定要删除此地点吗？有子地点的地点无法删除。"
        }
        onConfirm={handleDelete}
        onClose={() => {
          setDeleteTarget(null);
          setDeleteError("");
        }}
      />
    </Box>
  );
}
