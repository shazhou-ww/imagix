import type { Chapter, Plot } from "@imagix/shared";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import VisibilityIcon from "@mui/icons-material/Visibility";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useCharacters } from "@/api/hooks/useCharacters";
import { useEvents } from "@/api/hooks/useEvents";
import {
  useChapters,
  useCreateChapter,
  useCreatePlot,
  useDeleteChapter,
  useDeletePlot,
  useDeleteStory,
  usePlots,
  useStory,
  useUpdatePlot,
  useUpdateStory,
} from "@/api/hooks/useStories";
import ConfirmDialog from "@/components/ConfirmDialog";
import DetailPageHeader from "@/components/DetailPageHeader";
import EditableField from "@/components/EditableField";
import EntityLink from "@/components/EntityLink";

// ---------------------------------------------------------------------------
// PlotItem — reused from StoryListPage pattern
// ---------------------------------------------------------------------------

function PlotItem({
  plot,
  storyId,
  eventName,
  characterName,
  worldId,
}: {
  plot: Plot;
  storyId: string;
  eventName: string;
  characterName: string;
  worldId: string;
}) {
  const updatePlot = useUpdatePlot(storyId);
  const deletePlot = useDeletePlot(storyId);
  const [viewing, setViewing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [style, setStyle] = useState(plot.style);
  const [content, setContent] = useState(plot.content);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const openEdit = () => {
    setStyle(plot.style);
    setContent(plot.content);
    setEditing(true);
  };

  const handleSave = () => {
    updatePlot.mutate(
      {
        plotId: plot.id,
        body: { style: style.trim(), content: content.trim() },
      },
      { onSuccess: () => setEditing(false) },
    );
  };

  return (
    <Box
      sx={{
        p: 1.5,
        border: 1,
        borderColor: "divider",
        borderRadius: 1,
        bgcolor: "background.paper",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
        <EntityLink
          entityId={plot.eventId}
          worldId={worldId}
          label={eventName}
          size="small"
        />
        <Chip
          label={characterName}
          size="small"
          color="primary"
          variant="outlined"
        />
        {plot.style && (
          <Chip
            label={plot.style}
            size="small"
            variant="outlined"
            color="secondary"
          />
        )}
        <Box sx={{ flex: 1 }} />
        <Tooltip title="查看内容">
          <IconButton size="small" onClick={() => setViewing(true)}>
            <VisibilityIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="编辑">
          <IconButton size="small" onClick={openEdit}>
            <EditIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="删除">
          <IconButton
            size="small"
            color="error"
            onClick={() => setDeleteConfirm(true)}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
      {plot.content && (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
          }}
        >
          {plot.content}
        </Typography>
      )}

      {/* View dialog */}
      <Dialog
        open={viewing}
        onClose={() => setViewing(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          情节 — {eventName}
          {plot.style && ` · ${plot.style}`}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            视角: {characterName}
          </Typography>
          <Typography variant="body1" sx={{ whiteSpace: "pre-wrap" }}>
            {plot.content || "（暂无内容）"}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewing(false)}>关闭</Button>
        </DialogActions>
      </Dialog>

      {/* Edit dialog */}
      <Dialog
        open={editing}
        onClose={() => setEditing(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>编辑情节</DialogTitle>
        <DialogContent
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: 2,
            pt: "8px !important",
          }}
        >
          <TextField
            label="文风"
            value={style}
            onChange={(e) => setStyle(e.target.value)}
          />
          <TextField
            label="内容"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            multiline
            rows={10}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditing(false)}>取消</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={updatePlot.isPending}
          >
            保存
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirm */}
      <ConfirmDialog
        open={deleteConfirm}
        title="删除情节"
        message="确定要删除此情节吗？"
        onConfirm={() =>
          deletePlot.mutate(plot.id, {
            onSuccess: () => setDeleteConfirm(false),
          })
        }
        onClose={() => setDeleteConfirm(false)}
      />
    </Box>
  );
}

// ---------------------------------------------------------------------------
// ChapterSection — chapter with expandable plots
// ---------------------------------------------------------------------------

function ChapterSection({
  chapter,
  storyId,
  worldId,
}: {
  chapter: Chapter;
  storyId: string;
  worldId: string;
}) {
  const { data: allPlots } = usePlots(storyId);
  const { data: events } = useEvents(worldId);
  const { data: characters } = useCharacters(worldId);
  const createPlot = useCreatePlot(storyId, chapter.id);
  const deleteChapter = useDeleteChapter(storyId, worldId);

  const [addPlotOpen, setAddPlotOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<{
    id: string;
    label: string;
  } | null>(null);
  const [selectedChar, setSelectedChar] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [plotStyle, setPlotStyle] = useState("");
  const [plotContent, setPlotContent] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const chapterPlots = useMemo(
    () => (allPlots ?? []).filter((p) => p.chapterId === chapter.id),
    [allPlots, chapter.id],
  );

  const eventMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const e of events ?? [])
      m[e.id] =
        e.content.length > 40 ? `${e.content.slice(0, 40)}…` : e.content;
    return m;
  }, [events]);

  const charMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const c of characters ?? []) m[c.id] = c.name;
    return m;
  }, [characters]);

  const eventOptions = useMemo(
    () =>
      (events ?? []).map((e) => ({
        id: e.id,
        label: e.content.length > 60 ? `${e.content.slice(0, 60)}…` : e.content,
      })),
    [events],
  );

  const charOptions = useMemo(
    () => (characters ?? []).map((c) => ({ id: c.id, name: c.name })),
    [characters],
  );

  const handleAddPlot = () => {
    if (!selectedEvent) return;
    createPlot.mutate(
      {
        eventId: selectedEvent.id,
        perspectiveCharacterId: selectedChar?.id ?? null,
        style: plotStyle.trim() || undefined,
        content: plotContent.trim() || undefined,
      },
      {
        onSuccess: () => {
          setAddPlotOpen(false);
          setSelectedEvent(null);
          setSelectedChar(null);
          setPlotStyle("");
          setPlotContent("");
        },
      },
    );
  };

  return (
    <Accordion variant="outlined" disableGutters sx={{ mb: 1 }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Box sx={{ display: "flex", alignItems: "center", flex: 1, mr: 2 }}>
          <Typography fontWeight="bold" sx={{ flex: 1 }}>
            {chapter.title}
          </Typography>
          <Chip
            label={`${chapterPlots.length} 个情节`}
            size="small"
            variant="outlined"
            sx={{ mr: 1 }}
          />
          <Tooltip title="删除章节">
            <IconButton
              component="span"
              size="small"
              color="error"
              onClick={(e) => {
                e.stopPropagation();
                setDeleteConfirm(true);
              }}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </AccordionSummary>
      <AccordionDetails>
        <Box sx={{ pl: 2 }}>
          {chapterPlots.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              暂无情节
            </Typography>
          ) : (
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                gap: 1,
                mb: 1,
              }}
            >
              {chapterPlots.map((plot) => (
                <PlotItem
                  key={plot.id}
                  plot={plot}
                  storyId={storyId}
                  worldId={worldId}
                  eventName={eventMap[plot.eventId] ?? plot.eventId}
                  characterName={
                    plot.perspectiveCharacterId
                      ? (charMap[plot.perspectiveCharacterId] ?? "未知角色")
                      : "上帝视角"
                  }
                />
              ))}
            </Box>
          )}

          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={() => setAddPlotOpen(true)}
          >
            添加情节
          </Button>
        </Box>

        {/* Add plot dialog */}
        <Dialog
          open={addPlotOpen}
          onClose={() => setAddPlotOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>添加情节</DialogTitle>
          <DialogContent
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: 2,
              pt: "8px !important",
            }}
          >
            <Autocomplete
              options={eventOptions}
              getOptionLabel={(o) => o.label}
              value={selectedEvent}
              onChange={(_e, v) => setSelectedEvent(v)}
              renderInput={(params) => (
                <TextField {...params} label="关联事件" required />
              )}
            />
            <Autocomplete
              options={charOptions}
              getOptionLabel={(o) => o.name}
              value={selectedChar}
              onChange={(_e, v) => setSelectedChar(v)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="视角角色（可选，留空为上帝视角）"
                />
              )}
            />
            <TextField
              label="文风"
              value={plotStyle}
              onChange={(e) => setPlotStyle(e.target.value)}
              helperText="如：武侠风、意识流、书信体等"
            />
            <TextField
              label="内容"
              value={plotContent}
              onChange={(e) => setPlotContent(e.target.value)}
              multiline
              rows={6}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setAddPlotOpen(false)}>取消</Button>
            <Button
              variant="contained"
              onClick={handleAddPlot}
              disabled={!selectedEvent || createPlot.isPending}
            >
              创建
            </Button>
          </DialogActions>
        </Dialog>

        {/* Delete chapter confirm */}
        <ConfirmDialog
          open={deleteConfirm}
          title="删除章节"
          message={`确定要删除章节「${chapter.title}」吗？`}
          onConfirm={() =>
            deleteChapter.mutate(chapter.id, {
              onSuccess: () => setDeleteConfirm(false),
            })
          }
          onClose={() => setDeleteConfirm(false)}
        />
      </AccordionDetails>
    </Accordion>
  );
}

// ---------------------------------------------------------------------------
// StoryDetailPage
// ---------------------------------------------------------------------------

export default function StoryDetailPage() {
  const { worldId, storyId } = useParams<{
    worldId: string;
    storyId: string;
  }>();
  const navigate = useNavigate();

  const { data: story, isLoading } = useStory(worldId, storyId);
  const { data: chapters } = useChapters(storyId);
  const updateStory = useUpdateStory(worldId ?? "");
  const deleteStory = useDeleteStory(worldId ?? "");
  const createChapter = useCreateChapter(storyId ?? "");

  // Delete confirm
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Add chapter dialog
  const [addChapterOpen, setAddChapterOpen] = useState(false);
  const [chapterTitle, setChapterTitle] = useState("");

  // Chapters ordered by story.chapterIds
  const orderedChapters = useMemo(() => {
    if (!story || !chapters) return [];
    const chapterMap = new Map<string, Chapter>();
    for (const ch of chapters) chapterMap.set(ch.id, ch);
    const ordered: Chapter[] = [];
    for (const id of story.chapterIds) {
      const ch = chapterMap.get(id);
      if (ch) ordered.push(ch);
    }
    // Append any chapters not in chapterIds (shouldn't happen, but be safe)
    for (const ch of chapters) {
      if (!story.chapterIds.includes(ch.id)) ordered.push(ch);
    }
    return ordered;
  }, [story, chapters]);

  if (!worldId || !storyId) return null;

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!story) {
    return <Navigate to={`/worlds/${worldId}/stories`} replace />;
  }

  const handleDelete = () => {
    deleteStory.mutate(story.id, {
      onSuccess: () => navigate(`/worlds/${worldId}/stories`),
    });
  };

  const handleAddChapter = () => {
    if (!chapterTitle.trim()) return;
    createChapter.mutate(
      { title: chapterTitle.trim() },
      {
        onSuccess: () => {
          setAddChapterOpen(false);
          setChapterTitle("");
        },
      },
    );
  };

  return (
    <Box>
      <DetailPageHeader
        breadcrumbs={[
          { label: "故事", to: `/worlds/${worldId}/stories` },
          { label: story.title },
        ]}
        title={story.title}
        subtitle={`${orderedChapters.length} 个章节`}
        actions={
          <Button
            size="small"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={() => setDeleteOpen(true)}
          >
            删除
          </Button>
        }
      />

      {/* Basic Info */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          基本信息
        </Typography>
        <EditableField
          label="标题"
          value={story.title}
          onSave={(v) =>
            updateStory.mutate({
              storyId: story.id,
              body: { title: v },
            })
          }
          required
          saving={updateStory.isPending}
        />
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: "block" }}
        >
          ID: {story.id}
        </Typography>
      </Paper>

      {/* Chapters & Plots */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            mb: 2,
          }}
        >
          <Typography variant="subtitle2" color="text.secondary">
            章节（{orderedChapters.length}）
          </Typography>
          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={() => {
              setChapterTitle("");
              setAddChapterOpen(true);
            }}
          >
            添加章节
          </Button>
        </Box>
        {orderedChapters.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            暂无章节，点击上方按钮创建第一个章节
          </Typography>
        ) : (
          orderedChapters.map((ch) => (
            <ChapterSection
              key={ch.id}
              chapter={ch}
              storyId={story.id}
              worldId={worldId}
            />
          ))
        )}
      </Paper>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={deleteOpen}
        title="删除故事"
        message={`确定要删除「${story.title}」吗？所有章节和情节都将被删除。`}
        onConfirm={handleDelete}
        onClose={() => setDeleteOpen(false)}
        loading={deleteStory.isPending}
      />

      {/* Add Chapter Dialog */}
      <Dialog
        open={addChapterOpen}
        onClose={() => setAddChapterOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>添加章节</DialogTitle>
        <DialogContent sx={{ pt: "8px !important" }}>
          <TextField
            label="章节标题"
            value={chapterTitle}
            onChange={(e) => setChapterTitle(e.target.value)}
            autoFocus
            fullWidth
            required
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddChapterOpen(false)}>取消</Button>
          <Button
            variant="contained"
            onClick={handleAddChapter}
            disabled={!chapterTitle.trim() || createChapter.isPending}
          >
            创建
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
