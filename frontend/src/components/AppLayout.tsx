import AccountTreeIcon from "@mui/icons-material/AccountTree";
import AddIcon from "@mui/icons-material/Add";
import AssignmentIcon from "@mui/icons-material/Assignment";
import AutoStoriesIcon from "@mui/icons-material/AutoStories";
import CableTwoToneIcon from "@mui/icons-material/CableTwoTone";
import CategoryIcon from "@mui/icons-material/Category";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import LinkIcon from "@mui/icons-material/Link";
import LogoutIcon from "@mui/icons-material/Logout";
import MenuIcon from "@mui/icons-material/Menu";
import PersonIcon from "@mui/icons-material/Person";
import PlaceIcon from "@mui/icons-material/Place";
import PublicIcon from "@mui/icons-material/Public";
import SettingsIcon from "@mui/icons-material/Settings";
import TimelineIcon from "@mui/icons-material/Timeline";
import {
  AppBar,
  Avatar,
  Box,
  Button,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  TextField,
  Toolbar,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { type ReactNode, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { useCreateWorld, useWorlds } from "@/api/hooks/useWorlds";

const DRAWER_WIDTH = 240;

interface NavItem {
  label: string;
  icon: ReactNode;
  path: string;
}

function getWorldNavItems(worldId: string): NavItem[] {
  const base = `/worlds/${worldId}`;
  return [
    {
      label: "分类体系",
      icon: <AccountTreeIcon />,
      path: `${base}/taxonomy/CHAR`,
    },
    {
      label: "属性词典",
      icon: <AssignmentIcon />,
      path: `${base}/attributes`,
    },
    { label: "角色", icon: <PersonIcon />, path: `${base}/characters` },
    { label: "事物", icon: <CategoryIcon />, path: `${base}/things` },
    { label: "地点", icon: <PlaceIcon />, path: `${base}/places` },
    { label: "关系", icon: <LinkIcon />, path: `${base}/relationships` },
    { label: "事件", icon: <TimelineIcon />, path: `${base}/events` },
    {
      label: "事件关联",
      icon: <CableTwoToneIcon />,
      path: `${base}/event-links`,
    },
    { label: "故事", icon: <AutoStoriesIcon />, path: `${base}/stories` },
    { label: "世界设定", icon: <SettingsIcon />, path: `${base}/settings` },
  ];
}

export default function AppLayout({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  // Extract worldId from pathname since AppLayout wraps <Routes> and isn't inside a :worldId route
  const worldIdMatch = location.pathname.match(/^\/worlds\/([^/]+)/);
  const worldId = worldIdMatch?.[1];
  const { authState, signOut } = useAuth();
  const { data: worlds } = useWorlds();
  const createWorld = useCreateWorld();

  // Create world dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newEpoch, setNewEpoch] = useState("");

  const handleCreateWorld = () => {
    if (!newName.trim() || !newEpoch.trim()) return;
    createWorld.mutate(
      { name: newName.trim(), description: newDesc.trim() || undefined, epoch: newEpoch.trim() },
      {
        onSuccess: (world) => {
          setCreateOpen(false);
          setNewName("");
          setNewDesc("");
          setNewEpoch("");
          navigate(`/worlds/${world.id}`);
        },
      },
    );
  };

  const handleNav = (path: string) => {
    navigate(path);
    if (isMobile) setMobileOpen(false);
  };

  const drawerContent = (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Logo / Home */}
      <Toolbar>
        <Typography
          variant="h6"
          fontWeight="bold"
          sx={{ cursor: "pointer", color: "primary.main" }}
          onClick={() => handleNav("/worlds")}
        >
          Imagix
        </Typography>
      </Toolbar>
      <Divider />

      {/* World list + sub-nav */}
      <List sx={{ flex: 1, px: 1, overflowY: "auto" }}>
        {(worlds ?? []).map((world) => {
          const isActive = worldId === world.id;
          const basePath = `/worlds/${world.id}`;
          return (
            <Box key={world.id}>
              <ListItemButton
                selected={isActive && location.pathname === basePath}
                onClick={() => handleNav(basePath)}
                sx={{ borderRadius: 2, mb: 0.5 }}
              >
                <ListItemIcon>
                  <PublicIcon />
                </ListItemIcon>
                <ListItemText
                  primary={world.name}
                  primaryTypographyProps={{
                    noWrap: true,
                    fontSize: "0.9rem",
                  }}
                />
                {isActive ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
              </ListItemButton>

              <Collapse in={isActive} timeout="auto" unmountOnExit>
                <List disablePadding>
                  {getWorldNavItems(world.id).map((item) => (
                    <ListItemButton
                      key={item.path}
                      selected={location.pathname.startsWith(item.path)}
                      onClick={() => handleNav(item.path)}
                      sx={{ borderRadius: 2, mb: 0.25, pl: 4 }}
                    >
                      <ListItemIcon sx={{ minWidth: 32 }}>{item.icon}</ListItemIcon>
                      <ListItemText
                        primary={item.label}
                        primaryTypographyProps={{ fontSize: "0.85rem" }}
                      />
                    </ListItemButton>
                  ))}
                </List>
              </Collapse>
            </Box>
          );
        })}

        {/* Create world button */}
        <Button
          size="small"
          startIcon={<AddIcon />}
          onClick={() => setCreateOpen(true)}
          sx={{ mt: 1, ml: 1, justifyContent: "flex-start", textTransform: "none" }}
          fullWidth
        >
          创建世界
        </Button>
      </List>

      {/* User / Sign out */}
      <Divider />
      <List sx={{ px: 1 }}>
        {authState.status === "authenticated" && (
          <ListItemButton onClick={() => signOut()} sx={{ borderRadius: 2 }}>
            <ListItemIcon>
              <LogoutIcon />
            </ListItemIcon>
            <ListItemText primary="退出登录" />
          </ListItemButton>
        )}
      </List>
    </Box>
  );

  return (
    <Box
      sx={{
        display: "flex",
        minHeight: "100vh",
        bgcolor: "background.default",
      }}
    >
      {/* AppBar – mobile */}
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          display: { md: "none" },
          bgcolor: "background.paper",
          borderBottom: 1,
          borderColor: "divider",
        }}
      >
        <Toolbar>
          <IconButton edge="start" onClick={() => setMobileOpen(true)}>
            <MenuIcon />
          </IconButton>
          <Typography
            variant="h6"
            fontWeight="bold"
            sx={{ color: "primary.main", ml: 1 }}
          >
            Imagix
          </Typography>
          <Box sx={{ flex: 1 }} />
          {authState.status === "authenticated" && (
            <Avatar
              sx={{
                width: 32,
                height: 32,
                bgcolor: "primary.main",
                fontSize: 14,
              }}
            >
              {(authState.user.username ?? "U")[0].toUpperCase()}
            </Avatar>
          )}
        </Toolbar>
      </AppBar>

      {/* Drawer – mobile (temporary) */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: "block", md: "none" },
          "& .MuiDrawer-paper": { width: DRAWER_WIDTH },
        }}
      >
        {drawerContent}
      </Drawer>

      {/* Drawer – desktop (permanent) */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: "none", md: "block" },
          "& .MuiDrawer-paper": {
            width: DRAWER_WIDTH,
            borderRight: 1,
            borderColor: "divider",
            bgcolor: "background.paper",
          },
        }}
        open
      >
        {drawerContent}
      </Drawer>

      {/* Main content */}
      <Box
        component="main"
        sx={{
          flex: 1,
          p: { xs: 2, md: 3 },
          mt: { xs: 7, md: 0 },
          ml: { md: `${DRAWER_WIDTH}px` },
          maxWidth: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
        }}
      >
        {children}
      </Box>

      {/* Create World Dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>创建世界</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "8px !important" }}>
          <TextField
            label="世界名称"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            autoFocus
            required
          />
          <TextField
            label="世界描述"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            multiline
            rows={3}
          />
          <TextField
            label="纪元描述"
            value={newEpoch}
            onChange={(e) => setNewEpoch(e.target.value)}
            required
            helperText="定义世界的时间原点（t=0），如「盘古开天辟地」。创建后会自动生成纪元事件。"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>取消</Button>
          <Button
            variant="contained"
            onClick={handleCreateWorld}
            disabled={!newName.trim() || !newEpoch.trim() || createWorld.isPending}
          >
            创建
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
