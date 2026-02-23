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
  Chip,
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
  const { loadedSkillIds, autoSkillIds, pinnedSkillIds, unpinnedSkillIds, toggleSkill } = useChat();

  /** Determine the badge label for a skill */
  const getBadge = (skillId: string): { label: string; color: "success" | "info" | "default" } | null => {
    const isLoaded = loadedSkillIds.includes(skillId);
    const isAuto = autoSkillIds.includes(skillId);
    const isPinned = pinnedSkillIds.includes(skillId);
    const isUnpinned = unpinnedSkillIds.includes(skillId);

    if (!isLoaded) {
      if (isUnpinned) return { label: "已屏蔽", color: "default" };
      return null;
    }
    if (isPinned) return { label: "已固定", color: "info" };
    if (isAuto) return { label: "自动", color: "success" };
    return null;
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
          sx: { width: 320, maxHeight: 400 },
        },
      }}
    >
      <Box sx={{ p: 1.5, pb: 0.5 }}>
        <Typography variant="subtitle2" fontWeight="bold">
          技能管理
        </Typography>
        <Typography variant="caption" color="text.secondary">
          技能根据当前页面自动加载，也可手动固定或屏蔽
        </Typography>
      </Box>

      <List dense>
        {ALL_SKILLS.map((skill) => {
          const isLoaded = loadedSkillIds.includes(skill.id);
          const badge = getBadge(skill.id);
          return (
            <ListItem key={skill.id} sx={{ pr: 1 }}>
              <ListItemIcon sx={{ minWidth: 36 }}>
                {ICON_MAP[skill.icon ?? ""] ?? <CategoryIcon />}
              </ListItemIcon>
              <ListItemText
                primary={
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    <span>{skill.name}</span>
                    {badge && (
                      <Chip
                        label={badge.label}
                        size="small"
                        color={badge.color}
                        variant="outlined"
                        sx={{ height: 18, fontSize: "0.65rem", "& .MuiChip-label": { px: 0.5 } }}
                      />
                    )}
                  </Box>
                }
                secondary={`${skill.description} (${skill.allowedTools.length} 工具)`}
                primaryTypographyProps={{ fontSize: "0.85rem" }}
                secondaryTypographyProps={{ fontSize: "0.7rem" }}
              />
              <Switch
                edge="end"
                size="small"
                checked={isLoaded}
                onChange={() => toggleSkill(skill.id)}
              />
            </ListItem>
          );
        })}
      </List>
    </Popover>
  );
}
