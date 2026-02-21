# Imagix API 参考文档

> 版本：当前（2026-02）  
> 基础路径：`/api`  
> 认证方式：Bearer JWT（AWS Cognito）  
> 内容类型：`application/json`

---

## 目录

- [概述](#概述)
- [认证](#认证)
- [ID 格式](#id-格式)
- [错误处理](#错误处理)
- [API 端点](#api-端点)
  - [Health Check](#health-check)
  - [World（世界）](#world世界)
  - [Taxonomy（分类体系）](#taxonomy分类体系)
  - [Attribute Definition（属性定义）](#attribute-definition属性定义)
  - [Character（角色）](#character角色)
  - [Thing（事物）](#thing事物)
  - [Place（地点）](#place地点)
  - [Relationship（关系）](#relationship关系)
  - [Entity Relationships（实体关系查询）](#entity-relationships实体关系查询)
  - [Event（事件）](#event事件)
  - [Event Link（事件关联）](#event-link事件关联)
  - [Entity State（实体状态）](#entity-state实体状态)
  - [Entity Events（实体事件）](#entity-events实体事件)
  - [Story（故事）](#story故事)
  - [Chapter（章节）](#chapter章节)
  - [Plot（情节）](#plot情节)
- [数据模型](#数据模型)

---

## 概述

Imagix 是一个故事世界建模平台。核心设计理念是**事件溯源（Event Sourcing）**：

- 所有实体（角色、事物、关系）的**可变状态**由事件驱动推算
- 实体本身只存储静态不变的元数据
- 任意时间点的实体状态可通过回放事件链计算得出

### 核心概念

| 概念 | 说明 |
|------|------|
| **World** | 顶层容器，包含一切实体与事件 |
| **Taxonomy** | 三棵分类树（角色 / 事物 / 关系类型），支持继承和时间派生公式 |
| **Attribute Definition** | 世界级别的属性术语字典，确保属性名统一 |
| **Character** | 有主观能动性的行为体（人、动物、神仙等） |
| **Thing** | 无主观能动性的实体（道具、势力等） |
| **Place** | 空间层级结构（国 → 城 → 街 → 建筑） |
| **Relationship** | 实体间的有向二元关系 |
| **Event** | 时间轴上的事件，是所有可变状态的唯一变更源 |
| **Event Link** | 事件间的无向关联 |
| **Story / Chapter / Plot** | 叙事层：故事 → 章节 → 情节，情节是事件的文学化展开 |

---

## 认证

所有 API 请求需在 `Authorization` 头携带 JWT：

```
Authorization: Bearer <jwt_token>
```

Token 由 AWS Cognito 签发，后端从 JWT 的 `sub` 字段提取用户 ID。未认证请求将以 `anonymous` 身份处理。

---

## ID 格式

所有实体 ID 采用**带前缀的 ULID**格式，固定 30 个字符：

```
pfx_crockford_base32(128bit)
```

| 前缀 | 实体 | 示例 |
|------|------|------|
| `wld` | World | `wld_01h5...` |
| `txn` | TaxonomyNode | `txn_01h5...` |
| `adf` | AttributeDefinition | `adf_01h5...` |
| `chr` | Character | `chr_01h5...` |
| `thg` | Thing | `thg_01h5...` |
| `plc` | Place | `plc_01h5...` |
| `rel` | Relationship | `rel_01h5...` |
| `evt` | Event | `evt_01h5...` |
| `sty` | Story | `sty_01h5...` |
| `chp` | Chapter | `chp_01h5...` |
| `plt` | Plot | `plt_01h5...` |

---

## 错误处理

所有错误返回统一格式：

```json
{ "error": "错误描述信息" }
```

常见状态码：

| 状态码 | 含义 |
|--------|------|
| `400` | 请求参数无效 |
| `403` | 无权限（如操作他人的世界） |
| `404` | 资源不存在 |
| `409` | 冲突（如删除有子节点的地点） |
| `500` | 服务器内部错误 |

---

## API 端点

### Health Check

```
GET /api/health
```

**响应** `200`

```json
{ "status": "ok", "service": "imagix-api" }
```

---

### World（世界）

#### 创建世界

```
POST /api/worlds
```

**请求体**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | ✅ | 世界名称 |
| `description` | string | - | 世界描述 |
| `settings` | string | - | 世界设定（物理法则、力量体系等） |
| `epoch` | string | ✅ | 纪元描述，如"盘古开天辟地" |

创建时自动执行：
- 创建 time=0 的纪元事件
- 创建三棵分类树的根节点（CHAR / THING / REL），含 age 时间派生公式
- 创建关系方向子节点（from→to / to→from）
- 创建系统属性定义（`$age`、`$name`、`$alive`）

**响应** `201` → `World`

#### 列出世界

```
GET /api/worlds
```

返回当前用户的所有世界。

**响应** `200` → `World[]`

#### 获取世界

```
GET /api/worlds/:worldId
```

**响应** `200` → `World`

#### 更新世界

```
PUT /api/worlds/:worldId
```

**请求体** — `CreateWorldBody` 的任意子集

**响应** `200` → `World`

#### 删除世界

```
DELETE /api/worlds/:worldId
```

**响应** `200` → `{ "ok": true }`

#### 导出世界

```
GET /api/worlds/:worldId/export
```

导出世界的全部数据（实体、事件、分类树等），用于备份或迁移。

**响应** `200` → 完整世界数据 JSON

#### 导入世界数据

```
POST /api/worlds/:worldId/import
```

**请求体** — 导出格式的 JSON

**响应** `200` → `{ "ok": true }`

---

### Taxonomy（分类体系）

基础路径：`/api/worlds/:worldId/taxonomy`

每个世界包含三棵独立的分类树：

| 树类型 | 路径参数 `tree` | 说明 |
|--------|----------------|------|
| 角色分类 | `CHAR` | 角色的分类层级与属性 Schema |
| 事物分类 | `THING` | 事物的分类层级与属性 Schema |
| 关系类型 | `REL` | 关系的类型层级与属性 Schema |

#### 获取分类树

```
GET /api/worlds/:worldId/taxonomy/:tree
```

**响应** `200` → `TaxonomyNode[]`

#### 创建分类节点

```
POST /api/worlds/:worldId/taxonomy/:tree
```

**请求体**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | ✅ | 分类名称，如"修仙者" |
| `parentId` | txnId \| null | - | 父节点 ID，null 为根节点（默认 null） |
| `timeFormula` | string | - | JSONata 时间派生公式 |

**时间派生公式说明**：在事件溯源回放时，每个事件应用前先执行此公式，推算时间流逝导致的属性变化。

输入上下文：`{ attributes, lastTime, currentTime }`  
输出：`Record<string, any>`（需要变更的属性名 → 新值映射）  
示例：`{ "$age": attributes.$age + (currentTime - lastTime) }`

**响应** `201` → `TaxonomyNode`

#### 更新分类节点

```
PUT /api/worlds/:worldId/taxonomy/:tree/:nodeId
```

系统预置节点不可编辑。

**响应** `200` → `TaxonomyNode`

#### 删除分类节点

```
DELETE /api/worlds/:worldId/taxonomy/:tree/:nodeId
```

系统预置节点不可删除。

**响应** `200` → `{ "ok": true }`

---

### Attribute Definition（属性定义）

基础路径：`/api/worlds/:worldId/attribute-definitions`

属性定义是世界级别的属性术语字典，所有实体的属性值以此为准。

#### 列出属性定义

```
GET /api/worlds/:worldId/attribute-definitions
```

**响应** `200` → `AttributeDefinition[]`

#### 创建属性定义

```
POST /api/worlds/:worldId/attribute-definitions
```

**请求体**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | ✅ | 属性名称，如"修为境界" |
| `type` | enum | ✅ | `string` \| `number` \| `boolean` \| `enum` \| `timestamp` \| `timespan` |
| `enumValues` | string[] | 当 type=enum | 可选值列表（至少 1 项） |
| `description` | string | - | 属性说明 |

**响应** `201` → `AttributeDefinition`

#### 更新属性定义

```
PUT /api/worlds/:worldId/attribute-definitions/:adfId
```

系统属性不可编辑。

**响应** `200` → `AttributeDefinition`

#### 删除属性定义

```
DELETE /api/worlds/:worldId/attribute-definitions/:adfId
```

系统属性不可删除。

**响应** `200` → `{ "ok": true }`

---

### Character（角色）

基础路径：`/api/worlds/:worldId/characters`

角色是有主观能动性的行为体。仅存储静态元数据，可变属性由事件溯源推算。

#### 创建角色

```
POST /api/worlds/:worldId/characters
```

**请求体**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | ✅ | 角色名称 |
| `categoryNodeId` | txnId | ✅ | 角色分类节点 ID（来自 CHAR 树） |
| `birthTime` | number | ✅ | 诞生时间（纪元毫秒偏移） |

自动创建诞生事件，初始属性：`$age=0`、`$name=名称`、`$alive=true`。

**响应** `201` → `Character`

#### 列出角色

```
GET /api/worlds/:worldId/characters
```

返回所有未删除的角色。

**响应** `200` → `Character[]`

#### 获取角色

```
GET /api/worlds/:worldId/characters/:charId
```

**响应** `200` → `Character`

#### 更新角色

```
PUT /api/worlds/:worldId/characters/:charId
```

**响应** `200` → `Character`

#### 删除角色

```
DELETE /api/worlds/:worldId/characters/:charId
```

软删除（设置 `deletedAt`）。

**响应** `200` → `{ "ok": true }`

#### 标记角色消亡

```
POST /api/worlds/:worldId/characters/:charId/end
```

**请求体**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `time` | number | ✅ | 消亡时间（必须晚于诞生时间） |
| `content` | string | - | 消亡事件内容（可选，默认自动生成） |
| `causeEventId` | evtId | - | 导致消亡的因果事件 ID |

创建消亡事件，设置 `$alive=false`。

**响应** `200` → `Character`

#### 撤销消亡

```
DELETE /api/worlds/:worldId/characters/:charId/end
```

移除消亡事件，清除 `endEventId`。

**响应** `200` → `Character`

---

### Thing（事物）

基础路径：`/api/worlds/:worldId/things`

事物是无主观能动性的实体。API 结构与角色完全对称。

#### 创建事物

```
POST /api/worlds/:worldId/things
```

**请求体**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | ✅ | 事物名称 |
| `categoryNodeId` | txnId | ✅ | 事物分类节点 ID（来自 THING 树） |
| `creationTime` | number | ✅ | 创建时间（纪元毫秒偏移） |

自动创建"创建"事件，初始属性：`$age=0`、`$name=名称`、`$alive=true`。

**响应** `201` → `Thing`

#### 列出事物

```
GET /api/worlds/:worldId/things
```

**响应** `200` → `Thing[]`

#### 获取事物

```
GET /api/worlds/:worldId/things/:thingId
```

**响应** `200` → `Thing`

#### 更新事物

```
PUT /api/worlds/:worldId/things/:thingId
```

**响应** `200` → `Thing`

#### 删除事物

```
DELETE /api/worlds/:worldId/things/:thingId
```

软删除。

**响应** `200` → `{ "ok": true }`

#### 标记事物消亡

```
POST /api/worlds/:worldId/things/:thingId/end
```

**请求体** — 同 `EndEntityBody`

**响应** `200` → `Thing`

#### 撤销消亡

```
DELETE /api/worlds/:worldId/things/:thingId/end
```

**响应** `200` → `Thing`

---

### Place（地点）

基础路径：`/api/worlds/:worldId/places`

地点是永恒的空间概念，具有层级包含关系，不参与生命周期机制。

#### 创建地点

```
POST /api/worlds/:worldId/places
```

**请求体**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | ✅ | 地点名称 |
| `parentId` | plcId \| null | - | 父地点 ID，null 为顶层（默认 null） |
| `description` | string | - | 地点描述 |

**响应** `201` → `Place`

#### 列出地点

```
GET /api/worlds/:worldId/places
```

**响应** `200` → `Place[]`

#### 获取地点

```
GET /api/worlds/:worldId/places/:placeId
```

**响应** `200` → `Place`

#### 更新地点

```
PUT /api/worlds/:worldId/places/:placeId
```

自动检测循环父引用。

**响应** `200` → `Place`

#### 删除地点

```
DELETE /api/worlds/:worldId/places/:placeId
```

硬删除。如果地点有子节点则操作失败。

**响应** `200` → `{ "ok": true }`

---

### Relationship（关系）

基础路径：`/api/worlds/:worldId/relationships`

关系是实体间的有向二元关系，支持：角色→角色、角色→事物、事物→事物。  
关系属性按 from→to 和 to→from 两个方向分别持有值。

#### 创建关系

```
POST /api/worlds/:worldId/relationships
```

**请求体**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `typeNodeId` | txnId | ✅ | 关系类型节点 ID（来自 REL 树） |
| `fromId` | entityId | ✅ | 源实体 ID |
| `toId` | entityId | ✅ | 目标实体 ID（不能与 fromId 相同） |
| `establishTime` | number | ✅ | 建立时间（纪元毫秒偏移） |

自动创建"建立"事件，初始属性：`$age=0`、`$name="类型·源·目标"`、`$alive=true`。

**响应** `201` → `Relationship`

#### 列出关系

```
GET /api/worlds/:worldId/relationships
```

**响应** `200` → `Relationship[]`

#### 获取关系

```
GET /api/worlds/:worldId/relationships/:relId
```

**响应** `200` → `Relationship`

#### 删除关系

```
DELETE /api/worlds/:worldId/relationships/:relId
```

软删除。

**响应** `200` → `{ "ok": true }`

#### 解除关系

```
POST /api/worlds/:worldId/relationships/:relId/end
```

**请求体** — 同 `EndEntityBody`

**响应** `200` → `Relationship`

#### 撤销解除

```
DELETE /api/worlds/:worldId/relationships/:relId/end
```

**响应** `200` → `Relationship`

---

### Entity Relationships（实体关系查询）

```
GET /api/worlds/:worldId/entities/:entityId/relationships
```

查询与指定实体相关的所有关系（无论是 `fromId` 还是 `toId`）。

**响应** `200` → `Relationship[]`

---

### Event（事件）

基础路径：`/api/worlds/:worldId/events`

事件是所有可变状态的唯一变更源（Single Source of Truth）。

#### 创建事件

```
POST /api/worlds/:worldId/events
```

**请求体**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `time` | number | ✅ | 事件时间（纪元毫秒偏移） |
| `duration` | number | - | 持续时间（毫秒），默认 0（瞬时） |
| `placeId` | plcId \| null | - | 事件发生地点 |
| `content` | string | ✅ | 事件内容（关键梗概） |
| `impacts` | StateImpact | - | 状态影响声明 |

`impacts` 结构：

```json
{
  "attributeChanges": [
    { "entityId": "chr_...", "attribute": "修为境界", "value": "金丹期" }
  ],
  "relationshipAttributeChanges": [
    { "relationshipId": "rel_...", "attribute": "称谓", "direction": "from_to", "value": "师父" }
  ]
}
```

验证规则：
- 所有引用的实体必须存在且存活
- `$` 前缀的系统属性不可由用户事件修改

**响应** `201` → `Event`

#### 列出事件

```
GET /api/worlds/:worldId/events
```

**查询参数**

| 参数 | 类型 | 说明 |
|------|------|------|
| `timeFrom` | number | 起始时间（含） |
| `timeTo` | number | 截止时间（含） |

**响应** `200` → `Event[]`

#### 获取事件

```
GET /api/worlds/:worldId/events/:eventId
```

**响应** `200` → `Event`

#### 更新事件

```
PUT /api/worlds/:worldId/events/:eventId
```

系统事件（诞生/消亡/纪元）不可编辑。

**响应** `200` → `Event`

#### 删除事件

```
DELETE /api/worlds/:worldId/events/:eventId
```

系统事件不可删除。

**响应** `200` → `{ "ok": true }`

---

### Event Link（事件关联）

基础路径：`/api/worlds/:worldId/event-links`

事件关联是无向的（A-B 等同于 B-A），ID 自动排序去重。

#### 创建事件关联

```
POST /api/worlds/:worldId/event-links
```

**请求体**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `eventIdA` | evtId | ✅ | 事件 A |
| `eventIdB` | evtId | ✅ | 事件 B |
| `description` | string | - | 关联说明 |

**响应** `201` → `EventLink`

#### 列出事件关联

```
GET /api/worlds/:worldId/event-links
```

**响应** `200` → `EventLink[]`

#### 删除事件关联

```
DELETE /api/worlds/:worldId/event-links
```

**请求体**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `eventIdA` | evtId | ✅ | 事件 A |
| `eventIdB` | evtId | ✅ | 事件 B |

**响应** `200` → `{ "ok": true }`

---

### Entity State（实体状态）

```
GET /api/worlds/:worldId/entities/:entityId/state
```

通过事件溯源回放计算指定实体在指定时间点的状态。

**查询参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `time` | number | ✅ | 查询时间点（纪元毫秒偏移） |
| `forEvent` | string | - | 排除该事件的影响（用于计算"事件发生前"的状态） |

**计算逻辑**：
1. 获取实体所有事件，按时间排序
2. 从初始状态开始依次回放
3. 每两个事件之间应用分类节点的时间派生公式（如年龄自增）
4. 如果实体已消亡且查询时间超过消亡时间，状态截止到消亡时刻

**响应** `200`

```json
{
  "entityId": "chr_...",
  "time": 86400000,
  "attributes": {
    "$name": "张三丰",
    "$age": 86400000,
    "$alive": true,
    "修为境界": "金丹期"
  }
}
```

---

### Entity Events（实体事件）

```
GET /api/worlds/:worldId/entities/:entityId/events
```

列出影响指定实体的所有事件，按时间正序排列。

**查询参数**

| 参数 | 类型 | 说明 |
|------|------|------|
| `timeFrom` | number | 起始时间（含） |
| `timeTo` | number | 截止时间（含） |

**响应** `200` → `Event[]`

---

### Story（故事）

#### 世界级故事

基础路径：`/api/worlds/:worldId/stories`

##### 创建故事

```
POST /api/worlds/:worldId/stories
```

**请求体**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `title` | string | ✅ | 故事标题 |

**响应** `201` → `Story`

##### 列出故事

```
GET /api/worlds/:worldId/stories
```

**响应** `200` → `Story[]`

##### 获取故事

```
GET /api/worlds/:worldId/stories/:storyId
```

**响应** `200` → `Story`

##### 更新故事

```
PUT /api/worlds/:worldId/stories/:storyId
```

**请求体**

| 字段 | 类型 | 说明 |
|------|------|------|
| `title` | string | 故事标题 |
| `chapterIds` | string[] | 章节排序 |

**响应** `200` → `Story`

##### 删除故事

```
DELETE /api/worlds/:worldId/stories/:storyId
```

**响应** `200` → `{ "ok": true }`

#### 用户故事

```
GET /api/stories
```

列出当前用户在所有世界中创建的故事。

**响应** `200` → `Story[]`

---

### Chapter（章节）

基础路径：`/api/stories/:storyId/chapters`

#### 创建章节

```
POST /api/stories/:storyId/chapters
```

**请求体**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `title` | string | ✅ | 章节标题 |

自动追加到所属故事的 `chapterIds` 列表末尾。

**响应** `201` → `Chapter`

#### 列出章节

```
GET /api/stories/:storyId/chapters
```

**响应** `200` → `Chapter[]`

#### 获取章节

```
GET /api/stories/:storyId/chapters/:chapterId
```

**响应** `200` → `Chapter`

#### 更新章节

```
PUT /api/stories/:storyId/chapters/:chapterId
```

**请求体**

| 字段 | 类型 | 说明 |
|------|------|------|
| `title` | string | 章节标题 |
| `plotIds` | string[] | 情节排序 |

**响应** `200` → `Chapter`

#### 删除章节

```
DELETE /api/stories/:storyId/chapters/:chapterId
```

同时从故事的 `chapterIds` 中移除。

**响应** `200` → `{ "ok": true }`

---

### Plot（情节）

情节是对单个事件的文学化展开，一个事件可生成多个不同版本的情节。

#### 创建情节

```
POST /api/stories/:storyId/chapters/:chapterId/plots
```

**请求体**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `eventId` | evtId | ✅ | 关联的事件 ID |
| `perspectiveCharacterId` | chrId \| null | - | 视角角色 ID（null 为上帝视角） |
| `style` | string | - | 文学风格 |
| `content` | string | - | 文学化文本 |

自动追加到所属章节的 `plotIds` 列表末尾。

**响应** `201` → `Plot`

#### 列出情节

```
GET /api/stories/:storyId/chapters/:chapterId/plots
```

**响应** `200` → `Plot[]`

#### 获取情节

```
GET /api/stories/:storyId/plots/:plotId
```

**响应** `200` → `Plot`

#### 更新情节

```
PUT /api/stories/:storyId/plots/:plotId
```

**请求体**

| 字段 | 类型 | 说明 |
|------|------|------|
| `perspectiveCharacterId` | chrId \| null | 视角角色 |
| `style` | string | 文学风格 |
| `content` | string | 文学化文本 |

**响应** `200` → `Plot`

#### 删除情节

```
DELETE /api/stories/:storyId/plots/:plotId
```

同时从章节的 `plotIds` 中移除。

**响应** `200` → `{ "ok": true }`

---

## 数据模型

### World

```typescript
{
  id: string           // wld_...
  userId: string       // 创建者 ID
  name: string
  description: string
  settings: string     // 世界设定
  epoch: string        // 纪元描述
  createdAt: string    // ISO 时间
  updatedAt: string
}
```

### TaxonomyNode

```typescript
{
  id: string           // txn_...
  worldId: string      // wld_...
  tree: "CHAR" | "THING" | "REL"
  name: string
  parentId: string | null
  timeFormula?: string // JSONata 时间派生公式
  system: boolean      // 系统预置，不可编辑/删除
}
```

### AttributeDefinition

```typescript
{
  id: string           // adf_...
  worldId: string
  name: string
  type: "string" | "number" | "boolean" | "enum" | "timestamp" | "timespan"
  enumValues?: string[]
  description?: string
  system: boolean
  createdAt: string
  updatedAt: string
}
```

### Character

```typescript
{
  id: string           // chr_...
  worldId: string
  name: string
  categoryNodeId: string  // txn_...
  endEventId?: string     // evt_... 消亡事件
  createdAt: string
  updatedAt: string
  deletedAt?: string      // 软删除
}
```

### Thing

```typescript
{
  id: string           // thg_...
  worldId: string
  name: string
  categoryNodeId: string
  endEventId?: string
  createdAt: string
  updatedAt: string
  deletedAt?: string
}
```

### Place

```typescript
{
  id: string           // plc_...
  worldId: string
  name: string
  parentId: string | null
  description: string
  createdAt: string
  updatedAt: string
}
```

### Relationship

```typescript
{
  id: string           // rel_...
  worldId: string
  typeNodeId: string   // txn_... 关系类型节点
  fromId: string       // 源实体
  toId: string         // 目标实体
  endEventId?: string
  createdAt: string
  updatedAt: string
  deletedAt?: string
}
```

### Event

```typescript
{
  id: string           // evt_...
  worldId: string
  time: number         // 纪元毫秒偏移
  duration: number     // 持续时间（毫秒）
  placeId: string | null
  content: string      // 事件梗概
  impacts: {
    attributeChanges: [{
      entityId: string
      attribute: string
      value: string | number | boolean
    }]
    relationshipAttributeChanges: [{
      relationshipId: string
      attribute: string
      direction: "from_to" | "to_from"
      value: string | number | boolean
    }]
  }
  system: boolean
  createdAt: string
  updatedAt: string
}
```

### EventLink

```typescript
{
  worldId: string
  eventIdA: string     // evt_...
  eventIdB: string     // evt_...
  description: string
}
```

### Story

```typescript
{
  id: string           // sty_...
  worldId: string
  userId: string
  title: string
  chapterIds: string[] // 有序章节 ID
  createdAt: string
  updatedAt: string
}
```

### Chapter

```typescript
{
  id: string           // chp_...
  storyId: string      // sty_...
  title: string
  plotIds: string[]    // 有序情节 ID
  createdAt: string
  updatedAt: string
}
```

### Plot

```typescript
{
  id: string           // plt_...
  storyId: string
  chapterId: string
  eventId: string      // evt_... 关联事件
  perspectiveCharacterId: string | null
  style: string        // 文学风格
  content: string      // 文学化文本
  createdAt: string
  updatedAt: string
}
```

---

## 端点统计

| 模块 | 端点数 |
|------|--------|
| World（世界） | 7 |
| Taxonomy（分类体系） | 4 |
| Attribute Definition（属性定义） | 4 |
| Character（角色） | 7 |
| Thing（事物） | 7 |
| Place（地点） | 5 |
| Relationship（关系） | 6 |
| Entity Relationships | 1 |
| Event（事件） | 5 |
| Event Link（事件关联） | 3 |
| Entity State（实体状态） | 1 |
| Entity Events（实体事件） | 1 |
| Story（故事） | 6 |
| Chapter（章节） | 5 |
| Plot（情节） | 5 |
| Health Check | 1 |
| **合计** | **68** |
