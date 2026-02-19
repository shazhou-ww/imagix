import type { Story, Chapter } from "@imagix/shared";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemText,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { useParams } from "react-router-dom";
import {
  useStories,
  useCreateStory,
  useUpdateStory,
  useDeleteStory,
  useChapters,
  useCreateChapter,
  useDeleteChapter,
} from "@/api/hooks/useStories";
import ConfirmDialog from "@/components/ConfirmDialog";
import EmptyState from "@/components/EmptyState";

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
        <List dense disablePadding>
          {chapters.map((ch) => (
            <ListItem
              key={ch.id}
              secondaryAction={
                <Tooltip title="删除章节">
                  <IconButton edge="end" size="small" color="error" onClick={() => setDeleteTarget(ch)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              }
            >
              <ListItemText
                primary={ch.title}
                secondary={`情节: ${ch.plotIds.length} 个`}
              />
            </ListItem>
          ))}
        </List>
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
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3 }}>
        <Typography variant="h4" fontWeight="bold">
          故事
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          创建故事
        </Button>
      </Box>

      {!stories?.length ? (
        <EmptyState
          title="暂无故事"
          description="创建故事，用章节和情节将世界事件编织成叙事"
          action={
            <Button variant="outlined" onClick={openCreate}>
              创建故事
            </Button>
          }
        />
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {stories.map((story) => (
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
