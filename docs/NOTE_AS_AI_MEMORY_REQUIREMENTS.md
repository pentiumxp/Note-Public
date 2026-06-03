# Note As AI Memory Requirements

## 背景

Note 最初参考中国版印象笔记实现基础笔记体验，但在 Hermes Mobile 体系里，它的真实定位不是替代 Hermes Mobile，也不是成为新的总控台。

Hermes Mobile 是家庭 AI 中枢，负责：

- 对话入口；
- 话题和插件专用引用话题；
- 自然语言理解和多插件编排；
- 通过 MCP 调用各插件能力；
- 统一的 workspace、权限、插件安装和启动。

Note 是运行在 Hermes Mobile 上的独立插件，负责：

- 保存非结构化和半结构化笔记；
- 提供笔记创建、更新、查询、删除的 MCP 能力；
- 保存笔记与其他插件对象之间的引用关系；
- 让其他插件对象可以反查相关笔记；
- 为家庭 AI 提供生活语境、解释、经历、补充说明和回忆入口。

## 产品定位

Note 是家庭 AI 中枢里的“非结构化记忆插件”和“跨插件引用索引”。

它不取代账单、衣橱、人际关系、日程等结构化插件。结构化事实仍由各领域插件管理：

- 账单插件管理账单、分类、统计、流水；
- 衣橱插件管理衣服、套装、购买信息、穿搭历史；
- 人际关系插件管理人物、关系、互动记录；
- 日程插件管理事件、提醒、时间线；
- Note 管理自由文本、多元素记录、语境说明和跨插件引用。

## 核心原则

1. Hermes Mobile 是 AI 编排层，Note 不是第二个 Hermes。
2. 每个插件通过 MCP 提供自己的服务。
3. Note 通过 MCP 提供笔记能力和引用能力。
4. Note 不直接替其他插件做业务决策或写入结构化事实。
5. Note 可以保存到其他插件对象的引用，但不复制或接管对方完整数据。
6. 引用关系应支持双向发现：Note 能看到关联对象，其他插件也能查到相关笔记。
7. 所有数据仍按 Hermes workspace 映射到 Note workspace，并严格隔离。

## 用户场景

### 场景 1：自由输入同时产生结构化数据和笔记

用户输入：

```text
记录一下，今天穿灰色外套和张三吃饭，花了 238，感觉这套搭配不错。
```

Hermes Mobile 可通过 AI 编排：

1. 调用衣橱插件 MCP，识别或创建今日穿搭记录。
2. 调用人际关系插件 MCP，识别张三并记录一次互动。
3. 调用账单插件 MCP，创建或更新餐饮账单。
4. 调用 Note MCP，创建一篇自由文本笔记。
5. 调用 Note MCP，把衣橱对象、人物对象、账单对象和笔记建立引用。

Note 只保存笔记和引用。账单、人物、衣服、穿搭历史仍由各自插件管理。

### 场景 2：从笔记看到相关插件对象

用户打开一篇笔记，看到：

```text
关联对象：
- 人际关系 / 张三
- 账单 / 餐饮 238 元
- 衣橱 / 灰色外套
- 衣橱 / 2026-06-03 穿搭记录
```

用户可以从 Note 跳转到对应插件对象。

### 场景 3：从插件对象反查相关笔记

用户在衣橱插件里打开“灰色外套”，可以看到：

```text
相关笔记：
- 今天穿灰色外套和张三吃饭...
- 第一次穿这件外套的感受...
```

衣橱插件不需要保存笔记正文。它可以通过 Note MCP 查询 backlinks。

### 场景 4：AI 追问和回忆

用户问 Hermes Mobile：

```text
我最近和张三吃饭时穿了什么？
```

Hermes Mobile 可组合调用：

- 人际关系插件：解析张三；
- Note：查张三相关笔记；
- 衣橱插件：读取被引用的衣服和穿搭记录；
- 账单插件：补充餐饮时间和金额。

最终回答由 Hermes Mobile 生成，Note 只提供相关记忆和引用。

## 功能需求

### R1. 笔记基础能力

Note MCP 必须支持：

- 创建笔记；
- 更新笔记；
- 删除或归档笔记；
- 查询最近笔记；
- 搜索笔记；
- 获取单篇笔记正文；
- 列出标签。

### R2. 跨插件对象引用

Note 必须支持将一篇笔记关联到任意插件对象。

引用目标至少包含：

```text
plugin_id
object_type
object_id
```

引用关系至少包含：

```text
relation
label
created_at
created_by
```

### R3. 双向查询

Note 必须支持：

- 从 note 查询它关联的对象；
- 从插件对象查询相关 note；
- 按 relation 过滤引用；
- 按 plugin_id 过滤引用。

### R4. 引用摘要

引用可保存 bounded display snapshot，用于 UI 快速展示。

示例：

```json
{
  "title": "灰色外套",
  "subtitle": "衣橱 / 外套",
  "thumbnail_hint": "image"
}
```

Snapshot 只是展示缓存，不是权威数据。权威数据仍来自目标插件 MCP。

### R5. Workspace 隔离

所有笔记、引用、反向引用查询必须按 Note workspace 隔离。

Hermes workspace `owner` 映射到 `note:owner`，其他 workspace 映射到自己的 `note:<hermes_workspace_id>`。不得回退 Owner，不得跨 workspace 查询引用。

### R6. MCP 边界

Note 的引用能力必须通过 MCP 暴露，供 Hermes Mobile 编排。

Note 不应直接调用其他插件 MCP 做业务入库。跨插件流程由 Hermes Mobile AI 编排。

### R7. UI 展示

Note UI 应逐步增加“关联对象”面板：

- 显示当前笔记关联的插件对象；
- 支持跳转或请求 Hermes host 打开对应插件对象；
- 支持添加、删除、查看引用；
- 显示引用关系和来源。

## 非目标

- Note 不替代 Hermes Mobile 的聊天、话题、编排能力。
- Note 不直接把账单、衣服、人物、日程等结构化对象写入其他插件。
- Note 不复制其他插件的完整数据库。
- Note 不在引用里保存 raw key、launch token、cookie、插件私密数据或完整外部对象内容。
- Note 不以自动触发为默认行为。跨插件业务动作应由 Hermes Mobile 显式编排。

## 第一版验收标准

1. Note 文档明确其家庭 AI 记忆插件定位。
2. 数据模型包含跨插件引用表或等价结构。
3. MCP 暴露 link/backlink 工具。
4. 引用查询按 workspace 隔离。
5. Note UI 或 API 至少能列出某篇笔记的关联对象。
6. 其他插件可通过 Note MCP 反查对象相关笔记。
7. Harness 覆盖 Owner 和非 Owner workspace 的引用互不可见。
