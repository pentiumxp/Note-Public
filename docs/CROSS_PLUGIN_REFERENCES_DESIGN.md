# Cross-Plugin References Design

## 设计目标

在 Hermes Mobile 插件体系中，Note 需要保存非结构化笔记，并为笔记和其他插件对象建立稳定引用。

设计目标：

- Note 作为非结构化记忆插件；
- Hermes Mobile 作为 AI 中枢和 MCP 编排层；
- 其他插件继续管理自己的结构化对象；
- 引用关系可双向发现；
- 引用不泄露 secret，不复制对方完整数据；
- 引用和笔记都按 workspace 隔离。

## 系统边界

```text
Hermes Mobile
  - 自然语言理解
  - 话题和插件专用引用话题
  - 多插件 MCP 编排
  - 插件启动和 workspace 授权

Note Plugin
  - 笔记 CRUD/search
  - 非结构化内容
  - 跨插件对象引用
  - 反向引用查询

Domain Plugins
  - 账单、衣橱、人际关系、日程等结构化事实
  - 各自 MCP 工具
  - 各自数据和权限
```

Note 不直接持有其他插件业务逻辑。Note 的引用层只记录“某篇笔记和某个插件对象有关”。

## 对象引用格式

推荐统一对象标识：

```text
<plugin_id>:<object_type>:<object_id>
```

示例：

```text
billing:bill:bill_456
wardrobe:item:coat_123
wardrobe:wear_log:wear_789
people:person:person_zhangsan
note:note:note_001
```

在数据库中拆字段保存：

```text
target_plugin_id
target_object_type
target_object_id
```

这样便于索引、权限检查和反向查询。

## 引用关系类型

第一版关系类型保持少量、可解释：

| Relation | 含义 | 示例 |
| --- | --- | --- |
| `mentions` | 笔记中提到该对象 | 笔记提到灰色外套 |
| `context_for` | 笔记为对象提供上下文 | 穿搭记录关联一篇感受笔记 |
| `created_from` | 对象由笔记触发创建 | 账单由自由输入笔记触发 |
| `evidence_for` | 笔记作为依据 | 报销笔记作为账单凭据 |
| `explains` | 笔记解释对象 | 说明为什么买这件衣服 |
| `same_event` | 笔记和对象属于同一事件 | 聚餐笔记和餐饮账单 |
| `followup_to` | 后续记录 | 事后补充说明 |

关系类型应稳定、有限，不要让模型自由发明大量 relation。

## 数据模型

建议新增 `note_links` 表：

```sql
create table note_links (
  id text primary key,
  workspace_id text not null,
  note_id text not null,
  target_plugin_id text not null,
  target_object_type text not null,
  target_object_id text not null,
  relation text not null,
  label text,
  display_snapshot_json text not null,
  created_by text not null,
  created_at text not null,
  deleted_at text
);
```

建议索引：

```sql
create index idx_note_links_note on note_links(workspace_id, note_id, deleted_at);
create index idx_note_links_target on note_links(workspace_id, target_plugin_id, target_object_type, target_object_id, deleted_at);
create index idx_note_links_relation on note_links(workspace_id, relation, deleted_at);
```

`display_snapshot_json` 只能保存 bounded 展示摘要，例如：

```json
{
  "title": "灰色外套",
  "subtitle": "衣橱 / 外套",
  "thumbnail_hint": "image"
}
```

它不是权威对象数据。对象详情需要 Hermes Mobile 调目标插件 MCP 获取。

## MCP 工具契约

现有 Note MCP 工具保留：

```text
notes_search
notes_recent
notes_get
notes_create
notes_update
notes_delete
notes_tags_list
```

建议新增引用工具：

```text
notes_link_create(note_id, target_plugin_id, target_object_type, target_object_id, relation, label?, display_snapshot?)
notes_links_list(note_id, relation?, target_plugin_id?)
notes_backlinks_list(target_plugin_id, target_object_type, target_object_id, relation?, limit?)
notes_link_delete(link_id)
notes_reference_search(query, target_plugin_id?, relation?, limit?)
```

Hermes Agent 最终看到的 callable 名称由 MCP server 名 `note` 自动加前缀：

```text
mcp_note_notes_link_create
mcp_note_notes_links_list
mcp_note_notes_backlinks_list
mcp_note_notes_link_delete
mcp_note_notes_reference_search
```

Wrapper 返回的工具名仍必须是本地名，不要返回 `mcp_note_*`。

## 编排流程

### 创建多元素生活记录

```text
用户自然语言
  -> Hermes Mobile 分析意图和实体
  -> 调用账单 MCP 创建账单
  -> 调用衣橱 MCP 创建穿搭记录
  -> 调用人际关系 MCP 记录互动
  -> 调用 Note MCP 创建笔记
  -> 调用 Note MCP 创建 note_links
```

Note 不负责判断是否应该创建账单或穿搭记录。它只负责笔记和引用。

### 从结构化对象查相关笔记

```text
用户在衣橱打开 item
  -> Hermes Mobile 调 Note MCP notes_backlinks_list
  -> Note 返回 bounded note summaries
  -> Hermes Mobile 或衣橱插件展示相关笔记入口
```

### 从笔记打开目标对象

```text
用户打开 Note
  -> Note UI 查询 links
  -> 显示 display_snapshot
  -> 用户点击对象
  -> Note 向 Hermes host 发 bounded navigation request
  -> Hermes Mobile 打开对应插件对象
```

## 权限和隔离

所有引用 API 必须：

- 通过 workspace-local key 校验；
- 使用 `workspace_id` 过滤；
- 不允许模型参数覆盖 workspace；
- 不回退 Owner；
- 不跨 workspace 查询 backlink。

如果目标插件对象属于另一个 Hermes workspace，Note 不应保存或展示跨 workspace 引用，除非未来有明确共享授权模型。

## 隐私和安全

引用中禁止保存：

- raw access key；
- launch token；
- cookie；
- DB path；
- 完整外部对象正文或私密详情；
- 大批量 note body；
- 其他插件 secret。

日志只记录 bounded metadata：

```text
workspace_id
note_id
target_plugin_id
target_object_type
relation
status/error code
```

## UI 设计方向

Note 编辑页增加“关联对象”面板：

```text
关联对象
- 衣橱 / 灰色外套 / mentions
- 账单 / 餐饮 238 元 / same_event
- 人际关系 / 张三 / context_for
```

对象行需要：

- 插件名；
- 对象类型；
- 展示标题；
- relation；
- 删除引用；
- 打开目标对象。

未来其他插件也可以展示“相关笔记”区块，但应通过 Note MCP backlink 查询，而不是复制 Note 数据。

## Harness 要求

第一版实现时至少覆盖：

1. `notes_link_create` 创建引用。
2. `notes_links_list` 只返回当前 workspace 的 note links。
3. `notes_backlinks_list` 只返回当前 workspace 的相关笔记。
4. Owner workspace 和非 Owner workspace 的同名对象互不可见。
5. relation 不在允许列表时返回 bounded error。
6. display snapshot 超长时被截断或拒绝。
7. MCP tools/list 返回本地名，不返回 `mcp_note_*`。
8. Privacy scan 不允许 raw key/token/cookie/DB path 出现在引用、日志、docs 或测试输出。

## 后续扩展

后续可以考虑：

- 插件 capability registry，让 Hermes Mobile 知道哪些插件对象适合被 Note 引用；
- entity extraction result，只作为候选，不自动写其他插件；
- 引用置信度和用户确认状态；
- note-to-note links；
- event timeline 聚合；
- 家庭记忆图谱查询。

这些扩展仍应保持 Hermes Mobile 编排、Note 存笔记和引用、领域插件存结构化事实的边界。
