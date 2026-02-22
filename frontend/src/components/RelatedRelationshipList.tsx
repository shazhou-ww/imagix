import type { TaxonomyNode } from "@imagix/shared";
import {
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Typography,
} from "@mui/material";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useEntityRelationships } from "@/api/hooks/useRelationships";
import { useTaxonomyTree } from "@/api/hooks/useTaxonomy";
import EntityLink from "@/components/EntityLink";

interface RelatedRelationshipListProps {
  worldId: string;
  entityId: string;
}

/**
 * 关联关系列表组件。
 * 展示某实体的所有关系（含方向标识）。
 */
export default function RelatedRelationshipList({
  worldId,
  entityId,
}: RelatedRelationshipListProps) {
  const { data: relationships, isLoading } = useEntityRelationships(
    worldId,
    entityId,
  );
  const { data: relNodes } = useTaxonomyTree(worldId, "REL");
  const navigate = useNavigate();

  const nodeMap = useMemo(() => {
    const map = new Map<string, TaxonomyNode>();
    for (const n of relNodes ?? []) map.set(n.id, n);
    return map;
  }, [relNodes]);

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (!relationships?.length) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
        暂无关系
      </Typography>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      {relationships.map((rel) => {
        const isFrom = rel.fromId === entityId;
        const otherId = isFrom ? rel.toId : rel.fromId;
        const typeName = nodeMap.get(rel.typeNodeId)?.name ?? "未知类型";
        const isEnded = !!rel.endEventId;

        return (
          <Card
            key={rel.id}
            variant="outlined"
            sx={{
              cursor: "pointer",
              "&:hover": {
                borderColor: "primary.main",
                bgcolor: "action.hover",
              },
              opacity: isEnded ? 0.6 : 1,
            }}
            onClick={() =>
              navigate(`/worlds/${worldId}/relationships/${rel.id}`)
            }
          >
            <CardContent sx={{ py: 1, px: 2, "&:last-child": { pb: 1 } }}>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  flexWrap: "wrap",
                }}
              >
                <Chip
                  label={typeName}
                  size="small"
                  color="warning"
                  variant="outlined"
                  sx={{ height: 22, fontSize: "0.75rem" }}
                />
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ fontSize: "0.8rem" }}
                >
                  {isFrom ? "→" : "←"}
                </Typography>
                <EntityLink entityId={otherId} worldId={worldId} size="small" />
                {isEnded && (
                  <Chip
                    label="已解除"
                    size="small"
                    color="error"
                    variant="outlined"
                    sx={{ height: 18, fontSize: "0.7rem" }}
                  />
                )}
              </Box>
            </CardContent>
          </Card>
        );
      })}
    </Box>
  );
}
