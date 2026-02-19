import type { TaxonomyTree } from "@imagix/shared";
import { Box, Tab, Tabs, Typography } from "@mui/material";
import { useNavigate, useParams } from "react-router-dom";

const TREES: { value: TaxonomyTree; label: string }[] = [
  { value: "CHAR", label: "角色分类" },
  { value: "THING", label: "事物分类" },
  { value: "REL", label: "关系类型" },
];

export default function TaxonomyPage() {
  const { worldId, tree } = useParams<{ worldId: string; tree: string }>();
  const navigate = useNavigate();
  const currentTree = (tree as TaxonomyTree) ?? "CHAR";

  return (
    <Box>
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        分类体系
      </Typography>
      <Tabs
        value={currentTree}
        onChange={(_, v) => navigate(`/worlds/${worldId}/taxonomy/${v}`)}
        sx={{ mb: 3 }}
      >
        {TREES.map((t) => (
          <Tab key={t.value} value={t.value} label={t.label} />
        ))}
      </Tabs>
      <Typography color="text.secondary">
        即将推出 — 管理 {TREES.find((t) => t.value === currentTree)?.label} 树
      </Typography>
    </Box>
  );
}
