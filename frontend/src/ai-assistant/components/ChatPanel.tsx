// ---------------------------------------------------------------------------
// AI Assistant – Main floating chat panel
// ---------------------------------------------------------------------------

import AddCommentIcon from "@mui/icons-material/AddComment";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import HistoryIcon from "@mui/icons-material/History";
import PsychologyIcon from "@mui/icons-material/Psychology";
import SendIcon from "@mui/icons-material/Send";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import StopIcon from "@mui/icons-material/Stop";
import {
  Badge,
  Box,
  CircularProgress,
  Divider,
  Fab,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Popover,
  TextField,
  Tooltip,
  Typography,
  Zoom,
} from "@mui/material";
import { useEffect, useRef, useState } from "react";
import { useChat } from "../ChatContext";
import MessageBubble from "./MessageBubble";
import ModelSelector from "./ModelSelector";
import SkillPanel from "./SkillPanel";

const PANEL_WIDTH = 420;
const PANEL_HEIGHT = 560;

export default function ChatPanel() {
  const {
    ready,
    config,
    sessions,
    activeSession,
    panelOpen,
    loadedSkillIds,
    isStreaming,
    streamingText,
    activeToolCallName,
    setPanelOpen,
    createSession,
    switchSession,
    removeSession,
    sendUserMessage,
    abortStreaming,
  } = useChat();

  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Popover anchors
  const [skillAnchor, setSkillAnchor] = useState<HTMLElement | null>(null);
  const [historyAnchor, setHistoryAnchor] = useState<HTMLElement | null>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeSession?.messages, streamingText]);

  if (!ready) return null;

  const handleSend = () => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput("");
    sendUserMessage(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const hasModel = config.activeModelId !== null;
  const messages = activeSession?.messages ?? [];

  // ── Collapsed: FAB button ───────────────────────────────────────────────
  if (!panelOpen) {
    return (
      <Zoom in>
        <Fab
          color="primary"
          aria-label="AI 助手"
          onClick={() => setPanelOpen(true)}
          sx={{
            position: "fixed",
            bottom: 24,
            right: 24,
            zIndex: 1300,
          }}
        >
          <SmartToyIcon />
        </Fab>
      </Zoom>
    );
  }

  // ── Expanded: Chat panel ────────────────────────────────────────────────
  return (
    <Paper
      elevation={8}
      sx={{
        position: "fixed",
        bottom: 24,
        right: 24,
        width: { xs: "calc(100vw - 32px)", sm: PANEL_WIDTH },
        height: { xs: "calc(100vh - 100px)", sm: PANEL_HEIGHT },
        display: "flex",
        flexDirection: "column",
        borderRadius: 3,
        overflow: "hidden",
        zIndex: 1300,
      }}
    >
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.5,
          px: 1.5,
          py: 1,
          bgcolor: "primary.main",
          color: "white",
          minHeight: 48,
        }}
      >
        <SmartToyIcon sx={{ fontSize: 20 }} />
        <Typography variant="subtitle2" fontWeight="bold" sx={{ mr: 0.5 }}>
          AI 助手
        </Typography>

        <Box sx={{ flex: 1 }} />

        {/* Model selector */}
        <Box
          sx={{
            bgcolor: "rgba(255,255,255,0.15)",
            borderRadius: 1,
            px: 0.5,
          }}
        >
          <ModelSelector />
        </Box>

        {/* Skill toggle */}
        <Tooltip title="技能管理">
          <IconButton
            size="small"
            sx={{ color: "white" }}
            onClick={(e) => setSkillAnchor(e.currentTarget)}
          >
            <Badge badgeContent={loadedSkillIds.length} color="secondary">
              <PsychologyIcon sx={{ fontSize: 20 }} />
            </Badge>
          </IconButton>
        </Tooltip>

        {/* History */}
        <Tooltip title="历史对话">
          <IconButton
            size="small"
            sx={{ color: "white" }}
            onClick={(e) => setHistoryAnchor(e.currentTarget)}
          >
            <HistoryIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </Tooltip>

        {/* New chat */}
        <Tooltip title="新对话">
          <IconButton
            size="small"
            sx={{ color: "white" }}
            onClick={createSession}
          >
            <AddCommentIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </Tooltip>

        {/* Collapse */}
        <Tooltip title="收起">
          <IconButton
            size="small"
            sx={{ color: "white" }}
            onClick={() => setPanelOpen(false)}
          >
            <ExpandLessIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* ── Messages area ────────────────────────────────────────────────── */}
      <Box
        sx={{
          flex: 1,
          overflowY: "auto",
          px: 1.5,
          py: 1,
          bgcolor: "background.default",
        }}
      >
        {messages.length === 0 && !isStreaming && (
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              color: "text.secondary",
              textAlign: "center",
              gap: 1,
            }}
          >
            <SmartToyIcon sx={{ fontSize: 48, opacity: 0.3 }} />
            <Typography variant="body2">
              你好！我是 Imagix 创作助手。
            </Typography>
            <Typography variant="caption">
              {hasModel
                ? "有什么我可以帮你的吗？"
                : "请先在设置中配置 AI 模型。"}
            </Typography>
          </Box>
        )}

        {messages.map((msg, idx) => {
          // Show streaming text on the last assistant message while streaming
          const isLastAssistant =
            isStreaming &&
            msg.role === "assistant" &&
            idx === messages.length - 1;
          return (
            <MessageBubble
              key={msg.id}
              message={msg}
              streamingText={isLastAssistant ? streamingText : undefined}
            />
          );
        })}

        {/* Streaming indicator when LLM is still generating and no assistant
            message has been appended yet */}
        {isStreaming && messages[messages.length - 1]?.role !== "assistant" && (
          <Box sx={{ mb: 1.5 }}>
            {activeToolCallName ? (
              <Typography
                variant="caption"
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0.5,
                  ml: 5,
                  color: "text.disabled",
                  fontSize: "0.7rem",
                }}
              >
                <CircularProgress size={10} sx={{ color: "text.disabled" }} />
                {activeToolCallName}
              </Typography>
            ) : streamingText ? (
              <MessageBubble
                message={{
                  id: "__streaming__",
                  role: "assistant",
                  content: streamingText,
                  timestamp: Date.now(),
                }}
              />
            ) : (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, ml: 5 }}>
                <CircularProgress size={16} />
                <Typography variant="caption" color="text.secondary">
                  思考中…
                </Typography>
              </Box>
            )}
          </Box>
        )}

        <div ref={messagesEndRef} />
      </Box>

      <Divider />

      {/* ── Input area ───────────────────────────────────────────────────── */}
      <Box
        sx={{
          display: "flex",
          alignItems: "flex-end",
          gap: 0.5,
          p: 1,
          bgcolor: "background.paper",
        }}
      >
        <TextField
          fullWidth
          multiline
          maxRows={4}
          size="small"
          placeholder={hasModel ? "输入消息…" : "请先配置模型"}
          disabled={!hasModel}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          sx={{
            "& .MuiInputBase-root": {
              borderRadius: 2,
              fontSize: "0.9rem",
            },
          }}
        />
        {isStreaming ? (
          <Tooltip title="停止">
            <IconButton color="error" onClick={abortStreaming} size="small">
              <StopIcon />
            </IconButton>
          </Tooltip>
        ) : (
          <Tooltip title="发送">
            <span>
              <IconButton
                color="primary"
                onClick={handleSend}
                disabled={!input.trim() || !hasModel}
                size="small"
              >
                <SendIcon />
              </IconButton>
            </span>
          </Tooltip>
        )}
      </Box>

      {/* ── Skill popover ────────────────────────────────────────────────── */}
      <SkillPanel
        anchorEl={skillAnchor}
        onClose={() => setSkillAnchor(null)}
      />

      {/* ── History popover ──────────────────────────────────────────────── */}
      <Popover
        open={Boolean(historyAnchor)}
        anchorEl={historyAnchor}
        onClose={() => setHistoryAnchor(null)}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
        transformOrigin={{ vertical: "bottom", horizontal: "center" }}
        slotProps={{
          paper: { sx: { width: 280, maxHeight: 350 } },
        }}
      >
        <Box sx={{ p: 1.5, pb: 0.5 }}>
          <Typography variant="subtitle2" fontWeight="bold">
            历史对话
          </Typography>
        </Box>
        {sessions.length === 0 ? (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ px: 1.5, pb: 1.5, display: "block" }}
          >
            暂无历史对话
          </Typography>
        ) : (
          <List dense sx={{ maxHeight: 280, overflow: "auto" }}>
            {sessions.map((s) => (
              <ListItemButton
                key={s.id}
                selected={s.id === activeSession?.id}
                onClick={() => {
                  switchSession(s.id);
                  setHistoryAnchor(null);
                }}
                sx={{ borderRadius: 1, mx: 0.5 }}
              >
                <ListItemText
                  primary={s.title}
                  secondary={new Date(s.updatedAt).toLocaleString("zh-CN")}
                  primaryTypographyProps={{
                    fontSize: "0.85rem",
                    noWrap: true,
                  }}
                  secondaryTypographyProps={{ fontSize: "0.7rem" }}
                />
                <IconButton
                  size="small"
                  edge="end"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeSession(s.id);
                  }}
                  sx={{ opacity: 0.5, "&:hover": { opacity: 1 } }}
                >
                  <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </ListItemButton>
            ))}
          </List>
        )}
      </Popover>
    </Paper>
  );
}
