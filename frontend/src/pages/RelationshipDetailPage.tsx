import type { TaxonomyNode } from "@imagix/shared";
import DeleteIcon from "@mui/icons-material/Delete";
import HighlightOffIcon from "@mui/icons-material/HighlightOff";
import UndoIcon from "@mui/icons-material/Undo";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  TextField,
  Typography,
} from "@mui/material";
import { useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useCharacters } from "@/api/hooks/useCharacters";
import { useEvents } from "@/api/hooks/useEvents";
import {
  useDeleteRelationship,
  useEndRelationship,
  useRelationship,
  useUndoEndRelationship,
} from "@/api/hooks/useRelationships";
import { useTaxonomyTree } from "@/api/hooks/useTaxonomy";
import { useThings } from "@/api/hooks/useThings";
import ConfirmDialog from "@/components/ConfirmDialog";
import DetailPageHeader from "@/components/DetailPageHeader";
import EntityLink from "@/components/EntityLink";
import EntityStatePanel from "@/components/EntityStatePanel";
import EpochTimeInput from "@/components/EpochTimeInput";
import RelatedEventList from "@/components/RelatedEventList";
import { parseEpochMs } from "@/utils/time";

/** Build ancestor chain for a taxonomy node. */
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

export default function RelationshipDetailPage() {
  const { worldId, relId } = useParams<{
    worldId: string;
    relId: string;
  }>();
  const navigate = useNavigate();

  const { data: relationship, isLoading } = useRelationship(worldId, relId);
  const { data: relNodes } = useTaxonomyTree(worldId, "REL");
  const { data: characters } = useCharacters(worldId);
  const { data: things } = useThings(worldId);
  const { data: events } = useEvents(worldId);
  const deleteRel = useDeleteRelationship(worldId ?? "");
  const endRel = useEndRelationship(worldId ?? "");
  const undoEndRel = useUndoEndRelationship(worldId ?? "");

  // Delete confirm
  const [deleteOpen, setDeleteOpen] = useState(false);

  // End dialog
  const [endOpen, setEndOpen] = useState(false);
  const [endTime, setEndTime] = useState(0);
  const [endContent, setEndContent] = useState("");

  const nodeMap = useMemo(() => {
    const map = new Map<string, TaxonomyNode>();
    for (const n of relNodes ?? []) map.set(n.id, n);
    return map;
  }, [relNodes]);

  const entityNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of characters ?? []) map.set(c.id, c.name);
    for (const t of things ?? []) map.set(t.id, t.name);
    return map;
  }, [characters, things]);

  // Find establishment event (system event with $alive=true for this relationship)
  const establishEvent = useMemo(() => {
    if (!relationship || !events) return undefined;
    return events.find(
      (evt) =>
        evt.system &&
        evt.impacts?.relationshipAttributeChanges?.some(
          (rac) =>
            rac.relationshipId === relationship.id &&
            rac.attribute === "$active" &&
            rac.value === true,
        ),
    );
  }, [relationship, events]);

  const endEvent = useMemo(() => {
    if (!relationship?.endEventId || !events) return undefined;
    return events.find((e) => e.id === relationship.endEventId);
  }, [relationship, events]);

  const endTimeError = useMemo(() => {
    if (!establishEvent) return "";
    if (endTime <= establishEvent.time) return "解除时间必须晚于建立时间";
    return "";
  }, [endTime, establishEvent]);

  const fmtTime = (ms: number) => {
    const t = parseEpochMs(ms);
    const p = ms < 0 ? "前" : "";
    return `${p}${Math.abs(t.years) + 1}/${t.months + 1}/${t.days + 1}`;
  };

  if (!worldId || !relId) return null;

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!relationship) {
    return <Navigate to={`/worlds/${worldId}/relationships`} replace />;
  }

  const chain = getAncestorChain(relationship.typeNodeId, nodeMap);
  const typeName = chain.length > 0 ? chain[chain.length - 1].name : "未知类型";
  const isActive = !relationship.endEventId;

  const fromName =
    entityNameMap.get(relationship.fromId) ?? relationship.fromId;
  const toName = entityNameMap.get(relationship.toId) ?? relationship.toId;

  const handleDelete = () => {
    deleteRel.mutate(relationship.id, {
      onSuccess: () => navigate(`/worlds/${worldId}/relationships`),
    });
  };

  const handleEnd = () => {
    endRel.mutate(
      {
        relId: relationship.id,
        body: { time: endTime, content: endContent.trim() || undefined },
      },
      { onSuccess: () => setEndOpen(false) },
    );
  };

  return (
    <Box>
      <DetailPageHeader
        breadcrumbs={[
          { label: "关系", to: `/worlds/${worldId}/relationships` },
          { label: `${fromName} → ${toName}` },
        ]}
        title={`${fromName} → ${toName}`}
        subtitle={chain.map((n) => n.name).join(" › ")}
        status={
          isActive
            ? { label: "存续", color: "success" }
            : { label: "已解除", color: "error" }
        }
        actions={
          <>
            {isActive ? (
              <Button
                size="small"
                color="error"
                startIcon={<HighlightOffIcon />}
                onClick={() => {
                  setEndTime(0);
                  setEndContent("");
                  setEndOpen(true);
                }}
              >
                解除关系
              </Button>
            ) : (
              <Button
                size="small"
                color="warning"
                startIcon={<UndoIcon />}
                onClick={() => undoEndRel.mutate(relationship.id)}
              >
                撤销解除
              </Button>
            )}
            <Button
              size="small"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={() => setDeleteOpen(true)}
            >
              删除
            </Button>
          </>
        }
      />

      {/* Basic Info */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          基本信息
        </Typography>

        {/* Entities */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" color="text.secondary">
            关系实体
          </Typography>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              mt: 0.5,
              flexWrap: "wrap",
            }}
          >
            <EntityLink
              entityId={relationship.fromId}
              worldId={worldId}
              label={fromName}
            />
            <Typography variant="body2" color="text.secondary">
              →
            </Typography>
            <EntityLink
              entityId={relationship.toId}
              worldId={worldId}
              label={toName}
            />
          </Box>
        </Box>

        {/* Type chain */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" color="text.secondary">
            关系类型
          </Typography>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.5,
              flexWrap: "wrap",
              mt: 0.5,
            }}
          >
            {chain.map((n, i) => (
              <Box
                key={n.id}
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 0.5,
                }}
              >
                <Chip
                  label={n.name}
                  size="small"
                  variant={i === chain.length - 1 ? "filled" : "outlined"}
                  color={i === chain.length - 1 ? "primary" : "default"}
                  sx={{ height: 22, fontSize: "0.75rem" }}
                />
                {i < chain.length - 1 && (
                  <Typography variant="caption" color="text.disabled">
                    ›
                  </Typography>
                )}
              </Box>
            ))}
          </Box>
        </Box>

        {/* Lifecycle chips */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            flexWrap: "wrap",
          }}
        >
          {establishEvent && (
            <Chip
              label={`建立 ${fmtTime(establishEvent.time)}`}
              size="small"
              color="success"
              variant="outlined"
              sx={{ height: 22, fontSize: "0.75rem" }}
            />
          )}
          {endEvent && (
            <Chip
              label={`解除 ${fmtTime(endEvent.time)}`}
              size="small"
              color="error"
              variant="outlined"
              sx={{ height: 22, fontSize: "0.75rem" }}
            />
          )}
        </Box>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ mt: 1, display: "block" }}
        >
          ID: {relationship.id}
        </Typography>
      </Paper>

      {/* State Panel */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          关系属性状态
        </Typography>
        <EntityStatePanel worldId={worldId} entityId={relationship.id} />
      </Paper>

      {/* Events Timeline */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          事件时间线
        </Typography>
        <RelatedEventList worldId={worldId} entityId={relationship.id} />
      </Paper>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={deleteOpen}
        title="删除关系"
        message={`确定要删除「${typeName}: ${fromName} → ${toName}」吗？`}
        onConfirm={handleDelete}
        onClose={() => setDeleteOpen(false)}
        loading={deleteRel.isPending}
      />

      {/* End Dialog */}
      <Dialog
        open={endOpen}
        onClose={() => setEndOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>解除关系 — {typeName}</DialogTitle>
        <DialogContent
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: 2,
            pt: "8px !important",
          }}
        >
          {endTimeError && <Alert severity="error">{endTimeError}</Alert>}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              解除时间
            </Typography>
            <EpochTimeInput value={endTime} onChange={setEndTime} showPreview />
          </Box>
          <TextField
            label="解除描述（可选）"
            value={endContent}
            onChange={(e) => setEndContent(e.target.value)}
            multiline
            rows={2}
            placeholder="如：因背叛而决裂"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEndOpen(false)}>取消</Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleEnd}
            disabled={endRel.isPending || !!endTimeError}
          >
            确认解除
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
