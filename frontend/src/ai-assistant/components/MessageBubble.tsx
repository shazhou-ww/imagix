// ---------------------------------------------------------------------------
// AI Assistant – Message bubble component
// ---------------------------------------------------------------------------

import BuildIcon from "@mui/icons-material/Build";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import {
  Avatar,
  Box,
  Chip,
  Collapse,
  IconButton,
  Paper,
  Tooltip,
} from "@mui/material";
import { useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatMessage } from "../types";

interface MessageBubbleProps {
  message: ChatMessage;
  /** Streaming text to append (only for the last assistant message) */
  streamingText?: string;
}

export default function MessageBubble({
  message,
  streamingText,
}: MessageBubbleProps) {
  const isUser = message.role === "user";
  const isTool = message.role === "tool";
  const [copied, setCopied] = useState(false);
  const [toolExpanded, setToolExpanded] = useState(false);

  // Tool result messages rendered inline
  if (isTool) {
    return (
      <Box sx={{ mb: 1, ml: 5 }}>
        <Chip
          icon={
            message.content.startsWith("错误") ||
            message.content.startsWith("工具调用失败") ? (
              <ErrorOutlineIcon />
            ) : (
              <CheckCircleOutlineIcon />
            )
          }
          label={`${message.toolName ?? "tool"} 结果`}
          size="small"
          variant="outlined"
          onClick={() => setToolExpanded(!toolExpanded)}
          sx={{ cursor: "pointer" }}
        />
        <Collapse in={toolExpanded}>
          <Paper
            variant="outlined"
            sx={{
              mt: 0.5,
              p: 1,
              maxHeight: 200,
              overflow: "auto",
              bgcolor: "grey.50",
              fontSize: "0.75rem",
              fontFamily: "monospace",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {message.content}
          </Paper>
        </Collapse>
      </Box>
    );
  }

  const displayContent =
    streamingText !== undefined && message.role === "assistant"
      ? streamingText || message.content
      : message.content;

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: isUser ? "row-reverse" : "row",
        alignItems: "flex-start",
        gap: 1,
        mb: 1.5,
      }}
    >
      {/* Avatar */}
      {!isUser && (
        <Avatar
          sx={{
            width: 28,
            height: 28,
            bgcolor: "primary.main",
            mt: 0.5,
          }}
        >
          <SmartToyIcon sx={{ fontSize: 16 }} />
        </Avatar>
      )}

      {/* Bubble */}
      <Box
        sx={{
          maxWidth: "85%",
          position: "relative",
          "&:hover .copy-btn": { opacity: 1 },
        }}
      >
        <Paper
          elevation={0}
          sx={{
            px: 1.5,
            py: 1,
            borderRadius: 2,
            bgcolor: isUser ? "primary.light" : "grey.100",
            color: "text.primary",
          }}
        >
          {/* Tool calls indicator */}
          {message.toolCalls && message.toolCalls.length > 0 && (
            <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mb: 0.5 }}>
              {message.toolCalls.map((tc) => (
                <Chip
                  key={tc.id}
                  icon={<BuildIcon />}
                  label={tc.name}
                  size="small"
                  color="secondary"
                  variant="outlined"
                  sx={{ fontSize: "0.7rem" }}
                />
              ))}
            </Box>
          )}

          {/* Content */}
          {displayContent ? (
            <Box
              sx={{
                "& p": { m: 0, mb: 0.5 },
                "& p:last-child": { mb: 0 },
                "& pre": {
                  bgcolor: "grey.900",
                  color: "grey.100",
                  borderRadius: 1,
                  p: 1,
                  overflow: "auto",
                  fontSize: "0.8rem",
                  my: 0.5,
                },
                "& code": {
                  bgcolor: "grey.200",
                  borderRadius: 0.5,
                  px: 0.5,
                  fontSize: "0.85em",
                },
                "& pre code": {
                  bgcolor: "transparent",
                  p: 0,
                },
                "& table": {
                  borderCollapse: "collapse",
                  width: "100%",
                  my: 0.5,
                  fontSize: "0.85rem",
                },
                "& th, & td": {
                  border: "1px solid",
                  borderColor: "divider",
                  px: 1,
                  py: 0.5,
                },
                "& ul, & ol": { pl: 2, my: 0.5 },
                fontSize: "0.9rem",
                lineHeight: 1.6,
              }}
            >
              <Markdown remarkPlugins={[remarkGfm]}>{displayContent}</Markdown>
            </Box>
          ) : null}
        </Paper>

        {/* Copy button — assistant only */}
        {!isUser && message.content && (
          <Tooltip title={copied ? "已复制" : "复制"}>
            <IconButton
              className="copy-btn"
              size="small"
              onClick={handleCopy}
              sx={{
                position: "absolute",
                right: -4,
                bottom: -4,
                opacity: 0,
                transition: "opacity 0.2s",
                bgcolor: "background.paper",
                boxShadow: 1,
                width: 24,
                height: 24,
              }}
            >
              <ContentCopyIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Tooltip>
        )}
      </Box>
    </Box>
  );
}
