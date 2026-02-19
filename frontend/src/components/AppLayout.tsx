import AccountTreeIcon from "@mui/icons-material/AccountTree";
import AutoStoriesIcon from "@mui/icons-material/AutoStories";
import CableTwoToneIcon from "@mui/icons-material/CableTwoTone";
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
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { type ReactNode, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";

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
    { label: "角色", icon: <PersonIcon />, path: `${base}/characters` },
    { label: "事物", icon: <PlaceIcon />, path: `${base}/things` },
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
  const { worldId } = useParams<{ worldId: string }>();
  const { authState, signOut } = useAuth();

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

      {/* World nav */}
      <List sx={{ flex: 1, px: 1 }}>
        <ListItemButton
          selected={location.pathname === "/worlds"}
          onClick={() => handleNav("/worlds")}
          sx={{ borderRadius: 2, mb: 0.5 }}
        >
          <ListItemIcon>
            <PublicIcon />
          </ListItemIcon>
          <ListItemText primary="我的世界" />
        </ListItemButton>

        {worldId && (
          <>
            <Divider sx={{ my: 1 }} />
            {getWorldNavItems(worldId).map((item) => (
              <ListItemButton
                key={item.path}
                selected={location.pathname.startsWith(item.path)}
                onClick={() => handleNav(item.path)}
                sx={{ borderRadius: 2, mb: 0.5 }}
              >
                <ListItemIcon>{item.icon}</ListItemIcon>
                <ListItemText primary={item.label} />
              </ListItemButton>
            ))}
          </>
        )}
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
    </Box>
  );
}
