import type { TaxonomyNode } from "@imagix/shared";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
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
  MenuItem,
  Paper,
  TextField,
  Typography,
} from "@mui/material";
import { useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import {
  useCharacter,
  useDeleteCharacter,
  useEndCharacter,
  useUndoEndCharacter,
  useUpdateCharacter,
} from "@/api/hooks/useCharacters";
import { useEvents } from "@/api/hooks/useEvents";
import { useTaxonomyTree } from "@/api/hooks/useTaxonomy";
import ConfirmDialog from "@/components/ConfirmDialog";
import DetailPageHeader from "@/components/DetailPageHeader";
import EditableField from "@/components/EditableField";
import EntityStatePanel from "@/components/EntityStatePanel";
import EpochTimeInput from "@/components/EpochTimeInput";
import RelatedEventList from "@/components/RelatedEventList";
import RelatedRelationshipList from "@/components/RelatedRelationshipList";
import { parseEpochMs } from "@/utils/time";

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

export default function CharacterDetailPage() {
  const { worldId, charId } = useParams<{
    worldId: string;
    charId: string;
  }>();
  const navigate = useNavigate();

  const { data: character, isLoading } = useCharacter(worldId, charId);
  const { data: charNodes } = useTaxonomyTree(worldId, "CHAR");
  const { data: events } = useEvents(worldId);
  const updateChar = useUpdateCharacter(worldId ?? "");
  const deleteChar = useDeleteCharacter(worldId ?? "");
  const endChar = useEndCharacter(worldId ?? "");
  const undoEndChar = useUndoEndCharacter(worldId ?? "");

  // Edit dialog state
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editCategory, setEditCategory] = useState("");

  // Delete confirm
  const [deleteOpen, setDeleteOpen] = useState(false);

  // End dialog
  const [endOpen, setEndOpen] = useState(false);
  const [endTime, setEndTime] = useState(0);
  const [endContent, setEndContent] = useState("");

  const nodeMap = useMemo(() => {
    const map = new Map<string, TaxonomyNode>();
    for (const n of charNodes ?? []) map.set(n.id, n);
    return map;
  }, [charNodes]);

  // Build birth event map
  const birthEvent = useMemo(() => {
    if (!character || !events) return undefined;
    return events.find(
      (evt) =>
        evt.system &&
        evt.impacts?.attributeChanges?.some(
          (ac) =>
            ac.entityId === character.id &&
            ac.attribute === "$alive" &&
            ac.value === true,
        ),
    );
  }, [character, events]);

  const endEvent = useMemo(() => {
    if (!character?.endEventId || !events) return undefined;
    return events.find((e) => e.id === character.endEventId);
  }, [character, events]);

  const endTimeError = useMemo(() => {
    if (!birthEvent) return "";
    if (endTime <= birthEvent.time) return "消亡时间必须晚于创生时间";
    return "";
  }, [endTime, birthEvent]);

  const fmtTime = (ms: number) => {
    const t = parseEpochMs(ms);
    const p = ms < 0 ? "前" : "";
    return `${p}${Math.abs(t.years) + 1}/${t.months + 1}/${t.days + 1}`;
  };

  if (!worldId || !charId) return null;

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!character) {
    return <Navigate to={`/worlds/${worldId}/characters`} replace />;
  }

  const chain = getAncestorChain(character.categoryNodeId, nodeMap);
  const isAlive = !character.endEventId;

  const openEdit = () => {
    setEditName(character.name);
    setEditDesc(character.description ?? "");
    setEditCategory(character.categoryNodeId);
    setEditOpen(true);
  };

  const handleSaveEdit = () => {
    if (!editName.trim() || !editCategory) return;
    updateChar.mutate(
      {
        charId: character.id,
        body: {
          name: editName.trim(),
          description: editDesc.trim() || undefined,
          categoryNodeId: editCategory,
        },
      },
      { onSuccess: () => setEditOpen(false) },
    );
  };

  const handleDelete = () => {
    deleteChar.mutate(character.id, {
      onSuccess: () => navigate(`/worlds/${worldId}/characters`),
    });
  };

  const handleEnd = () => {
    endChar.mutate(
      {
        charId: character.id,
        body: { time: endTime, content: endContent.trim() || undefined },
      },
      { onSuccess: () => setEndOpen(false) },
    );
  };

  return (
    <Box>
      <DetailPageHeader
        breadcrumbs={[
          { label: "角色", to: `/worlds/${worldId}/characters` },
          { label: character.name },
        ]}
        title={character.name}
        subtitle={chain.map((n) => n.name).join(" › ")}
        status={
          isAlive
            ? { label: "存活", color: "success" }
            : { label: "已消亡", color: "error" }
        }
        actions={
          <>
            <Button size="small" startIcon={<EditIcon />} onClick={openEdit}>
              编辑
            </Button>
            {isAlive ? (
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
                标记消亡
              </Button>
            ) : (
              <Button
                size="small"
                color="warning"
                startIcon={<UndoIcon />}
                onClick={() => undoEndChar.mutate(character.id)}
              >
                撤销消亡
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
        <EditableField
          label="名称"
          value={character.name}
          onSave={(v) =>
            updateChar.mutate({
              charId: character.id,
              body: { name: v },
            })
          }
          required
          saving={updateChar.isPending}
        />
        <EditableField
          label="描述"
          value={character.description ?? ""}
          onSave={(v) =>
            updateChar.mutate({
              charId: character.id,
              body: { description: v || undefined },
            })
          }
          multiline
          rows={3}
          placeholder="暂无描述"
          saving={updateChar.isPending}
        />
        <Box sx={{ mb: 1 }}>
          <Typography variant="caption" color="text.secondary">
            分类
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
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            flexWrap: "wrap",
            mt: 1,
          }}
        >
          {birthEvent && (
            <Chip
              label={`创生 ${fmtTime(birthEvent.time)}`}
              size="small"
              color="success"
              variant="outlined"
              sx={{ height: 22, fontSize: "0.75rem" }}
            />
          )}
          {endEvent && (
            <Chip
              label={`消亡 ${fmtTime(endEvent.time)}`}
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
          ID: {character.id}
        </Typography>
      </Paper>

      {/* State Panel */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          当前状态（属性快照）
        </Typography>
        <EntityStatePanel worldId={worldId} entityId={character.id} />
      </Paper>

      {/* Relationships */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          关系
        </Typography>
        <RelatedRelationshipList worldId={worldId} entityId={character.id} />
      </Paper>

      {/* Events Timeline */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          事件时间线
        </Typography>
        <RelatedEventList worldId={worldId} entityId={character.id} />
      </Paper>

      {/* Edit Dialog */}
      <Dialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>编辑角色</DialogTitle>
        <DialogContent
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: 2,
            pt: "8px !important",
          }}
        >
          <TextField
            label="角色名称"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            autoFocus
            required
          />
          <TextField
            label="角色描述（可选）"
            value={editDesc}
            onChange={(e) => setEditDesc(e.target.value)}
            multiline
            rows={2}
          />
          <TextField
            label="角色分类"
            value={editCategory}
            onChange={(e) => setEditCategory(e.target.value)}
            select
            required
            slotProps={{ inputLabel: { htmlFor: undefined } }}
          >
            {charNodes?.map((n) => (
              <MenuItem key={n.id} value={n.id}>
                {n.name}
              </MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>取消</Button>
          <Button
            variant="contained"
            onClick={handleSaveEdit}
            disabled={!editName.trim() || !editCategory || updateChar.isPending}
          >
            保存
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={deleteOpen}
        title="删除角色"
        message={`确定要删除「${character.name}」吗？相关的事件和关系不会被删除。`}
        onConfirm={handleDelete}
        onClose={() => setDeleteOpen(false)}
        loading={deleteChar.isPending}
      />

      {/* End Dialog */}
      <Dialog
        open={endOpen}
        onClose={() => setEndOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>标记消亡 — {character.name}</DialogTitle>
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
              消亡时间
            </Typography>
            <EpochTimeInput value={endTime} onChange={setEndTime} showPreview />
          </Box>
          <TextField
            label="消亡描述（可选）"
            value={endContent}
            onChange={(e) => setEndContent(e.target.value)}
            multiline
            rows={2}
            placeholder="如：战死沙场、寿终正寝"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEndOpen(false)}>取消</Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleEnd}
            disabled={endChar.isPending || !!endTimeError}
          >
            确认消亡
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
