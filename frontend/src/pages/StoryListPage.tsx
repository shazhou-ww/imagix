import type { Story, Chapter, Plot } from "@imagix/shared";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import SearchIcon from "@mui/icons-material/Search";
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
  InputAdornment,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  useStories,
  useCreateStory,
  useUpdateStory,
  useDeleteStory,
  useChapters,
  useCreateChapter,
  useDeleteChapter,
  usePlots,
  useCreatePlot,
  useUpdatePlot,
  useDeletePlot,
} from "@/api/hooks/useStories";
import { useEvents } from "@/api/hooks/useEvents";
import { useCharacters } from "@/api/hooks/useCharacters";
import ConfirmDialog from "@/components/ConfirmDialog";
import EmptyState from "@/components/EmptyState";

// ---------------------------------------------------------------------------
// Plot viewer / editor for a single plot
// ---------------------------------------------------------------------------

function PlotItem({
  plot,
  storyId,
  eventName,
  characterName,
}: {
  plot: Plot;
  storyId: string;
  eventName: string;
  characterName: string;
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
      { plotId: plot.id, body: { style: style.trim(), content: content.trim() } },
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
        <Chip label={eventName} size="small" variant="outlined" />
        <Chip
          label={characterName}
          size="small"
          color="primary"
          variant="outlined"
        />
        {plot.style && (
          <Chip label={plot.style} size="small" variant="outlined" color="secondary" />
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
          <IconButton size="small" color="error" onClick={() => setDeleteConfirm(true)}>
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
      <Dialog open={viewing} onClose={() => setViewing(false)} maxWidth="md" fullWidth>
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
      <Dialog open={editing} onClose={() => setEditing(false)} maxWidth="md" fullWidth>
        <DialogTitle>编辑情节</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "8px !important" }}>
          <TextField label="文风" value={style} onChange={(e) => setStyle(e.target.value)} />
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
          <Button variant="contained" onClick={handleSave} disabled={updatePlot.isPending}>
            保存
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirm */}
      <ConfirmDialog
        open={deleteConfirm}
        title="删除情节"
        message="确定要删除此情节吗？"
        onConfirm={() => deletePlot.mutate(plot.id, { onSuccess: () => setDeleteConfirm(false) })}
        onClose={() => setDeleteConfirm(false)}
      />
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Chapter with its plots
// ---------------------------------------------------------------------------

function ChapterPlots({
  chapter,
  story,
  worldId,
}: {
  chapter: Chapter;
  story: Story;
  worldId: string;
}) {
  const { data: allPlots } = usePlots(story.id);
  const { data: events } = useEvents(worldId);
  const { data: characters } = useCharacters(worldId);
  const createPlot = useCreatePlot(story.id, chapter.id);

  const [addOpen, setAddOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<{ id: string; label: string } | null>(null);
  const [selectedChar, setSelectedChar] = useState<{ id: string; name: string } | null>(null);
  const [plotStyle, setPlotStyle] = useState("");
  const [plotContent, setPlotContent] = useState("");

  const chapterPlots = useMemo(
    () => (allPlots ?? []).filter((p) => p.chapterId === chapter.id),
    [allPlots, chapter.id],
  );

  const eventMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const e of events ?? [])
      m[e.id] = e.content.length > 40 ? `${e.content.slice(0, 40)}…` : e.content;
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

  const handleAdd = () => {
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
          setAddOpen(false);
          setSelectedEvent(null);
          setSelectedChar(null);
          setPlotStyle("");
          setPlotContent("");
        },
      },
    );
  };

  return (
    <Box sx={{ pl: 2 }}>
      {chapterPlots.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          暂无情节
        </Typography>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1, mb: 1 }}>
          {chapterPlots.map((plot) => (
            <PlotItem
              key={plot.id}
              plot={plot}
              storyId={story.id}
              eventName={eventMap[plot.eventId] ?? plot.eventId}
              characterName={
                plot.perspectiveCharacterId
                  ? charMap[plot.perspectiveCharacterId] ?? "未知角色"
                  : "上帝视角"
              }
            />
          ))}
        </Box>
      )}

      <Button size="small" startIcon={<AddIcon />} onClick={() => setAddOpen(true)}>
        添加情节
      </Button>

      {/* Add plot dialog */}
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>添加情节</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "8px !important" }}>
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
              <TextField {...params} label="视角角色（可选，留空为上帝视角）" />
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
          <Button onClick={() => setAddOpen(false)}>取消</Button>
          <Button
            variant="contained"
            onClick={handleAdd}
            disabled={!selectedEvent || createPlot.isPending}
          >
            创建
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Chapters list for a story (with expandable plots)
// ---------------------------------------------------------------------------

function StoryChapters({ story, worldId }: { story: Story; worldId: string }) {
  const { data: chapters, isLoading } = useChapters(story.id);
  const createChapter = useCreateChapter(story.id);
  const deleteChapter = useDeleteChapter(story.id, worldId);
  const [addOpen, setAddOpen] = useState(false);
  const [chapterTitle, setChapterTitle] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Chapter | null>(null);

  const handleAdd = () => {
    if (!chapterTitle.trim()) return;
    createChapter.mutate(
      { title: chapterTitle.trim() },
      {
        onSuccess: () => {
          setAddOpen(false);
          setChapterTitle("");
        },
      },
    );
  };

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
        <Typography variant="subtitle2" color="text.secondary">
          章节 ({chapters?.length ?? 0})
        </Typography>
        <Button size="small" startIcon={<AddIcon />} onClick={() => setAddOpen(true)}>
          添加章节
        </Button>
      </Box>
      {isLoading ? (
        <CircularProgress size={20} />
      ) : !chapters?.length ? (
        <Typography variant="body2" color="text.secondary">
          暂无章节
        </Typography>
      ) : (
        chapters.map((ch) => (
          <Accordion key={ch.id} variant="outlined" disableGutters sx={{ mb: 1 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: "flex", alignItems: "center", flex: 1, mr: 2 }}>
                <Typography fontWeight="bold" sx={{ flex: 1 }}>
                  {ch.title}
                </Typography>
                <Chip
                  label={`${ch.plotIds.length} 个情节`}
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
                      setDeleteTarget(ch);
                    }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <ChapterPlots chapter={ch} story={story} worldId={worldId} />
            </AccordionDetails>
          </Accordion>
        ))
      )}

      {/* Add Chapter Dialog */}
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="xs" fullWidth>
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
          <Button onClick={() => setAddOpen(false)}>取消</Button>
          <Button
            variant="contained"
            onClick={handleAdd}
            disabled={!chapterTitle.trim() || createChapter.isPending}
          >
            创建
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Chapter Confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="删除章节"
        message={`确定要删除章节「${deleteTarget?.title}」吗？`}
        onConfirm={() => {
          if (deleteTarget) {
            deleteChapter.mutate(deleteTarget.id, {
              onSuccess: () => setDeleteTarget(null),
            });
          }
        }}
        onClose={() => setDeleteTarget(null)}
      />
    </Box>
  );
}

export default function StoryListPage() {
  const { worldId } = useParams<{ worldId: string }>();
  const { data: stories, isLoading } = useStories(worldId);
  const createStory = useCreateStory(worldId!);
  const updateStory = useUpdateStory(worldId!);
  const deleteStory = useDeleteStory(worldId!);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStory, setEditingStory] = useState<Story | null>(null);
  const [title, setTitle] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Story | null>(null);

  // Filter state
  const [filterTitle, setFilterTitle] = useState("");

  // Filtered list
  const filteredStories = useMemo(() => {
    if (!filterTitle.trim()) return stories ?? [];
    const q = filterTitle.trim().toLowerCase();
    return (stories ?? []).filter((s) => s.title.toLowerCase().includes(q));
  }, [stories, filterTitle]);

  const openCreate = () => {
    setEditingStory(null);
    setTitle("");
    setDialogOpen(true);
  };

  const openEdit = (story: Story) => {
    setEditingStory(story);
    setTitle(story.title);
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!title.trim()) return;
    if (editingStory) {
      updateStory.mutate(
        { storyId: editingStory.id, body: { title: title.trim() } },
        { onSuccess: () => setDialogOpen(false) },
      );
    } else {
      createStory.mutate(
        { title: title.trim() },
        { onSuccess: () => setDialogOpen(false) },
      );
    }
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteStory.mutate(deleteTarget.id, {
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
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
        <Typography variant="h4" fontWeight="bold">
          故事
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          创建故事
        </Button>
      </Box>

      {(stories?.length ?? 0) > 0 && (
        <Box sx={{ display: "flex", gap: 2, mb: 2, flexWrap: "wrap" }}>
          <TextField
            size="small"
            placeholder="搜索故事"
            value={filterTitle}
            onChange={(e) => setFilterTitle(e.target.value)}
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
            sx={{ minWidth: 220 }}
          />
        </Box>
      )}

      {!filteredStories.length ? (
        <EmptyState
          title={stories?.length ? "无匹配故事" : "暂无故事"}
          description={stories?.length ? "尝试调整搜索关键词" : "创建故事，用章节和情节将世界事件编织成叙事"}
          action={
            stories?.length ? (
              <Button variant="outlined" onClick={() => setFilterTitle("")}>清除搜索</Button>
            ) : (
              <Button variant="outlined" onClick={openCreate}>创建故事</Button>
            )
          }
        />
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {filteredStories.map((story) => (
            <Accordion key={story.id} defaultExpanded={false}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box sx={{ display: "flex", alignItems: "center", flex: 1, mr: 2 }}>
                  <MenuBookIcon color="primary" sx={{ mr: 1.5 }} />
                  <Typography fontWeight="bold" sx={{ flex: 1 }}>
                    {story.title}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ mr: 2 }}>
                    {story.chapterIds.length} 章
                  </Typography>
                  <Tooltip title="编辑标题">
                    <IconButton
                      component="span"
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEdit(story);
                      }}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="删除故事">
                    <IconButton
                      component="span"
                      size="small"
                      color="error"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(story);
                      }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <StoryChapters story={story} worldId={worldId!} />
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingStory ? "编辑故事" : "创建故事"}</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "8px !important" }}>
          <TextField
            label="故事标题"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
            required
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>取消</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={!title.trim() || createStory.isPending || updateStory.isPending}
          >
            {editingStory ? "保存" : "创建"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="删除故事"
        message={`确定要删除故事「${deleteTarget?.title}」吗？所有章节和情节将一并删除。`}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </Box>
  );
}
