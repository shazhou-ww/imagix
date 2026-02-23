// ---------------------------------------------------------------------------
// AI Assistant – Skill management panel (popover)
// ---------------------------------------------------------------------------

import AccountTreeIcon from "@mui/icons-material/AccountTree";
import AutoStoriesIcon from "@mui/icons-material/AutoStories";
import CategoryIcon from "@mui/icons-material/Category";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import LinkIcon from "@mui/icons-material/Link";
import NavigationIcon from "@mui/icons-material/Navigation";
import PersonIcon from "@mui/icons-material/Person";
import PublicIcon from "@mui/icons-material/Public";
import TimelineIcon from "@mui/icons-material/Timeline";
import {
  Box,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Popover,
  Switch,
  Typography,
} from "@mui/material";
import type { ReactNode } from "react";
import { useChat } from "../ChatContext";
import { ALL_SKILLS } from "../skills/registry";

interface SkillPanelProps {
  anchorEl: HTMLElement | null;
  onClose: () => void;
}

/** Map skill icon names to MUI icons */
const ICON_MAP: Record<string, ReactNode> = {
  Public: <PublicIcon />,
  Person: <PersonIcon />,
  Link: <LinkIcon />,
  Timeline: <TimelineIcon />,
  AutoStories: <AutoStoriesIcon />,
  AccountTree: <AccountTreeIcon />,
  ContentCopy: <ContentCopyIcon />,
  Navigation: <NavigationIcon />,
  Category: <CategoryIcon />,
};

export default function SkillPanel({ anchorEl, onClose }: SkillPanelProps) {
  const { loadedSkillIds, setLoadedSkills } = useChat();

  const handleToggle = (skillId: string) => {
    const isLoaded = loadedSkillIds.includes(skillId);
    const next = isLoaded
      ? loadedSkillIds.filter((id) => id !== skillId)
      : [...loadedSkillIds, skillId];
    setLoadedSkills(next);
  };

  return (
    <Popover
      open={Boolean(anchorEl)}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: "top", horizontal: "center" }}
      transformOrigin={{ vertical: "bottom", horizontal: "center" }}
      slotProps={{
        paper: {
          sx: { width: 300, maxHeight: 400 },
        },
      }}
    >
      <Box sx={{ p: 1.5, pb: 0.5 }}>
        <Typography variant="subtitle2" fontWeight="bold">
          技能管理
        </Typography>
        <Typography variant="caption" color="text.secondary">
          启用的技能决定 AI 助手可以使用哪些工具
        </Typography>
      </Box>

      <List dense>
        {ALL_SKILLS.map((skill) => {
          const isLoaded = loadedSkillIds.includes(skill.id);
          return (
            <ListItem key={skill.id} sx={{ pr: 1 }}>
              <ListItemIcon sx={{ minWidth: 36 }}>
                {ICON_MAP[skill.icon ?? ""] ?? <CategoryIcon />}
              </ListItemIcon>
              <ListItemText
                primary={skill.name}
                secondary={`${skill.description} (${skill.allowedTools.length} 工具)`}
                primaryTypographyProps={{ fontSize: "0.85rem" }}
                secondaryTypographyProps={{ fontSize: "0.7rem" }}
              />
              <Switch
                edge="end"
                size="small"
                checked={isLoaded}
                onChange={() => handleToggle(skill.id)}
              />
            </ListItem>
          );
        })}
      </List>
    </Popover>
  );
}
