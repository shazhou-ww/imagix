import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import {
  Box,
  Breadcrumbs,
  Chip,
  IconButton,
  Link as MuiLink,
  Typography,
} from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

interface BreadcrumbItem {
  label: string;
  to?: string;
}

interface DetailPageHeaderProps {
  /** 面包屑导航项 */
  breadcrumbs: BreadcrumbItem[];
  /** 页面标题（实体名称） */
  title: string;
  /** 副标题（如分类信息） */
  subtitle?: string;
  /** 状态标签 */
  status?: {
    label: string;
    color: "default" | "success" | "error" | "warning" | "info";
  };
  /** 右侧操作按钮插槽 */
  actions?: React.ReactNode;
}

/**
 * 详情页通用头部组件。
 * 包含面包屑导航、标题、状态标签和操作按钮。
 */
export default function DetailPageHeader({
  breadcrumbs,
  title,
  subtitle,
  status,
  actions,
}: DetailPageHeaderProps) {
  const backTo = [...breadcrumbs].reverse().find((b) => b.to)?.to;

  return (
    <Box sx={{ mb: 3 }}>
      {/* Breadcrumbs */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
        {backTo && (
          <IconButton
            component={RouterLink}
            to={backTo}
            size="small"
            sx={{ mr: 0.5 }}
          >
            <ArrowBackIcon fontSize="small" />
          </IconButton>
        )}
        <Breadcrumbs separator="›" sx={{ fontSize: "0.875rem" }}>
          {breadcrumbs.map((item, i) =>
            item.to && i < breadcrumbs.length - 1 ? (
              <MuiLink
                key={item.label}
                component={RouterLink}
                to={item.to}
                underline="hover"
                color="inherit"
                sx={{ fontSize: "0.875rem" }}
              >
                {item.label}
              </MuiLink>
            ) : (
              <Typography
                key={item.label}
                color="text.primary"
                sx={{ fontSize: "0.875rem" }}
              >
                {item.label}
              </Typography>
            ),
          )}
        </Breadcrumbs>
      </Box>

      {/* Title row */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 1,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Typography variant="h4" fontWeight="bold">
            {title}
          </Typography>
          {status && (
            <Chip
              label={status.label}
              color={status.color}
              size="small"
              sx={{ fontWeight: 500 }}
            />
          )}
        </Box>
        {actions && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {actions}
          </Box>
        )}
      </Box>

      {/* Subtitle */}
      {subtitle && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {subtitle}
        </Typography>
      )}
    </Box>
  );
}
