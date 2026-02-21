import type { WorldTemplate } from "@imagix/shared";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import AddIcon from "@mui/icons-material/Add";
import AssignmentIcon from "@mui/icons-material/Assignment";
import AutoStoriesIcon from "@mui/icons-material/AutoStories";
import CableTwoToneIcon from "@mui/icons-material/CableTwoTone";
import CategoryIcon from "@mui/icons-material/Category";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import LinkIcon from "@mui/icons-material/Link";
import MenuIcon from "@mui/icons-material/Menu";
import NoteAddIcon from "@mui/icons-material/NoteAdd";
import PersonIcon from "@mui/icons-material/Person";
import PlaceIcon from "@mui/icons-material/Place";
import PublicIcon from "@mui/icons-material/Public";
import SettingsIcon from "@mui/icons-material/Settings";
import TimelineIcon from "@mui/icons-material/Timeline";
import TuneIcon from "@mui/icons-material/Tune";
import {
  AppBar,
  Avatar,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  Grid,
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
import {
  useCreateWorldFromTemplate,
  useTemplates,
} from "@/api/hooks/useTemplates";
import { useCreateWorld, useWorlds } from "@/api/hooks/useWorlds";
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

// ---------------------------------------------------------------------------
// Create World Dialog — two-step: template selection → detail form
// ---------------------------------------------------------------------------

function CreateWorldDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (worldId: string) => void;
}) {
  const { data: templates } = useTemplates();
  const createWorld = useCreateWorld();
  const createWorldFromTemplate = useCreateWorldFromTemplate();

  const [step, setStep] = useState<"select" | "details">("select");
  const [selectedTemplate, setSelectedTemplate] =
    useState<WorldTemplate | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [epoch, setEpoch] = useState("");

  const reset = () => {
    setStep("select");
    setSelectedTemplate(null);
    setName("");
    setDescription("");
    setEpoch("");
  };

  const handleClose = () => {
    onClose();
    setTimeout(reset, 200);
  };

  const handleSelectEmpty = () => {
    setSelectedTemplate(null);
    setName("");
    setDescription("");
    setEpoch("");
    setStep("details");
  };

  const handleSelectTemplate = (tpl: WorldTemplate) => {
    setSelectedTemplate(tpl);
    setName(tpl.snapshot.world.name);
    setDescription(tpl.snapshot.world.description);
    setEpoch(tpl.snapshot.world.epoch);
    setStep("details");
  };

  const handleCreate = () => {
    if (selectedTemplate) {
      createWorldFromTemplate.mutate(
        {
          templateId: selectedTemplate.id,
          body: {
            name: name.trim() || undefined,
            description: description.trim() || undefined,
            epoch: epoch.trim() || undefined,
          },
        },
        {
          onSuccess: (world) => {
            handleClose();
            onCreated(world.id);
          },
        },
      );
    } else {
      if (!name.trim() || !epoch.trim()) return;
      createWorld.mutate(
        {
          name: name.trim(),
          description: description.trim() || undefined,
          epoch: epoch.trim(),
        },
        {
          onSuccess: (world) => {
            handleClose();
            onCreated(world.id);
          },
        },
      );
    }
  };

  const isPending = createWorld.isPending || createWorldFromTemplate.isPending;
  const userTemplates = templates ?? [];

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth={step === "select" ? "md" : "sm"}
      fullWidth
      TransitionProps={{ onExited: reset }}
    >
      {step === "select" ? (
        <>
          <DialogTitle>选择模板</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              选择一个模板快速开始，或从空白世界创建。模板可在用户设置中管理。
            </Typography>
            <Grid container spacing={2}>
              {/* Empty world card */}
              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <Card
                  variant="outlined"
                  sx={{
                    height: "100%",
                    borderStyle: "dashed",
                    borderColor: "primary.main",
                    "&:hover": {
                      borderColor: "primary.dark",
                      bgcolor: "action.hover",
                    },
                  }}
                >
                  <CardActionArea
                    onClick={handleSelectEmpty}
                    sx={{ height: "100%" }}
                  >
                    <CardContent
                      sx={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        py: 4,
                      }}
                    >
                      <NoteAddIcon
                        sx={{ fontSize: 40, color: "primary.main", mb: 1 }}
                      />
                      <Typography variant="subtitle1" fontWeight="bold">
                        空白世界
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        从零开始构建
                      </Typography>
                    </CardContent>
                  </CardActionArea>
                </Card>
              </Grid>

              {/* User templates */}
              {userTemplates.map((tpl) => (
                <Grid size={{ xs: 12, sm: 6, md: 4 }} key={tpl.id}>
                  <Card
                    variant="outlined"
                    sx={{
                      height: "100%",
                      "&:hover": {
                        borderColor: "primary.main",
                        bgcolor: "action.hover",
                      },
                    }}
                  >
                    <CardActionArea
                      onClick={() => handleSelectTemplate(tpl)}
                      sx={{ height: "100%" }}
                    >
                      <CardContent>
                        <Typography
                          variant="subtitle1"
                          fontWeight="bold"
                          gutterBottom
                        >
                          {tpl.name}
                        </Typography>
                        {tpl.description && (
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                              mb: 1,
                            }}
                          >
                            {tpl.description}
                          </Typography>
                        )}
                        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                          <Typography variant="caption" color="text.secondary">
                            分类: {tpl.snapshot.taxonomy.length}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            属性: {tpl.snapshot.attributeDefinitions.length}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            地点: {tpl.snapshot.places.length}
                          </Typography>
                        </Box>
                      </CardContent>
                    </CardActionArea>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClose}>取消</Button>
          </DialogActions>
        </>
      ) : (
        <>
          <DialogTitle>
            {selectedTemplate
              ? `基于「${selectedTemplate.name}」创建世界`
              : "创建空白世界"}
          </DialogTitle>
          <DialogContent
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: 2,
              pt: "8px !important",
            }}
          >
            <TextField
              label="世界名称"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              required
            />
            <TextField
              label="世界描述"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              multiline
              rows={3}
            />
            <TextField
              label="纪元描述"
              value={epoch}
              onChange={(e) => setEpoch(e.target.value)}
              required={!selectedTemplate}
              helperText="定义世界的时间原点（t=0），如「盘古开天辟地」。创建后会自动生成纪元事件。"
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setStep("select")} disabled={isPending}>
              返回
            </Button>
            <Box sx={{ flex: 1 }} />
            <Button onClick={handleClose} disabled={isPending}>
              取消
            </Button>
            <Button
              variant="contained"
              onClick={handleCreate}
              disabled={
                isPending ||
                (!selectedTemplate && (!name.trim() || !epoch.trim()))
              }
            >
              创建
            </Button>
          </DialogActions>
        </>
      )}
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Main layout
// ---------------------------------------------------------------------------

export default function AppLayout({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  // Extract worldId from pathname since AppLayout wraps <Routes> and isn't inside a :worldId route
  const worldIdMatch = location.pathname.match(/^\/worlds\/([^/]+)/);
  const worldId = worldIdMatch?.[1];
  const { authState } = useAuth();
  const { data: worlds } = useWorlds();

  // Create world dialog state
  const [createOpen, setCreateOpen] = useState(false);

  const handleNav = (path: string) => {
    navigate(path);
    if (isMobile) setMobileOpen(false);
  };

  const username =
    authState.status === "authenticated" ? authState.displayName : "";

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
        {/* Create world button */}
        <Button
          size="small"
          startIcon={<AddIcon />}
          onClick={() => setCreateOpen(true)}
          sx={{
            mb: 1,
            ml: 1,
            justifyContent: "flex-start",
            textTransform: "none",
          }}
          fullWidth
        >
          创建世界
        </Button>

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
                {isActive ? (
                  <ExpandLessIcon fontSize="small" />
                ) : (
                  <ExpandMoreIcon fontSize="small" />
                )}
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
                      <ListItemIcon sx={{ minWidth: 32 }}>
                        {item.icon}
                      </ListItemIcon>
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
      </List>

      {/* User settings */}
      <Divider />
      <List sx={{ px: 1 }}>
        {authState.status === "authenticated" && (
          <ListItemButton
            selected={location.pathname === "/settings"}
            onClick={() => handleNav("/settings")}
            sx={{ borderRadius: 2 }}
          >
            <ListItemIcon>
              <TuneIcon />
            </ListItemIcon>
            <ListItemText
              primary={username}
              primaryTypographyProps={{ noWrap: true, fontSize: "0.9rem" }}
            />
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
              {(username || "U")[0].toUpperCase()}
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

      {/* Create World Dialog — two-step */}
      <CreateWorldDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(id) => navigate(`/worlds/${id}`)}
      />
    </Box>
  );
}
