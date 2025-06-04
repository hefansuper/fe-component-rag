# 流式 AI 对话 API

基于 Next.js 的流式 AI 对话 API 路由处理器，集成了 OpenAI API 和向量嵌入检索功能，实现了 RAG（检索增强生成）模式的智能对话系统。

## 🚀 功能特性

- **流式响应**：使用 Server-Sent Events (SSE) 实现实时流式对话
- **RAG 检索**：基于向量嵌入进行相关内容检索
- **专业提示词**：集成专门的前端业务组件开发专家提示词系统
- **多阶段反馈**：实时显示检索状态和 AI 响应进度
- **类型安全**：完整的 TypeScript 类型定义
- **错误处理**：完善的错误处理和用户反馈

## 📁 文件结构

```
app/api/openai/
├── route.ts              # 主要的 API 路由处理器
├── types.ts              # 类型定义
├── embedding.ts          # 向量嵌入相关功能
├── selectors.ts          # 数据库查询选择器
├── test-client.ts        # Node.js 测试客户端
└── README.md            # 本文档
```

## 🔧 API 使用方法

### 请求格式

**POST** `/api/openai`

```typescript
{
  "message": [
    {
      "role": "user",
      "content": "您的问题内容"
    }
  ]
}
```

### 响应格式

API 返回 `text/event-stream` 格式的流式响应，每个数据块格式如下：

```
data: {"type": "retrieval", "data": {"status": "searching", "message": "正在搜索相关内容..."}}

data: {"type": "retrieval", "data": {"status": "found", "results": [...], "count": 3}}

data: {"type": "content", "data": {"content": "AI回复片段", "accumulated": "累积回复内容"}}

data: {"type": "done", "data": {"message": "对话完成", "totalLength": 150, "retrievalCount": 3}}
```

### 响应数据类型

#### 1. 检索状态 (retrieval)
```typescript
{
  type: 'retrieval',
  data: {
    status: 'searching' | 'found',
    message?: string,
    results?: Array<{
      id: string,
      content: string,
      similarity: number
    }>,
    count?: number
  }
}
```

#### 2. 内容流 (content)
```typescript
{
  type: 'content',
  data: {
    content: string,        // 当前片段
    accumulated: string     // 累积内容
  }
}
```

#### 3. 错误信息 (error)
```typescript
{
  type: 'error',
  data: {
    message: string
  }
}
```

#### 4. 完成信号 (done)
```typescript
{
  type: 'done',
  data: {
    message: string,
    totalLength: number,
    retrievalCount: number
  }
}
```

## 💻 客户端实现示例

### React 前端组件

参考 `app/components/StreamingChat.tsx` 文件，这是一个完整的 React 前端实现，包含：

- 实时消息显示
- 流式响应处理
- 检索状态展示
- 用户交互界面

### Node.js 客户端

参考 `test-client.ts` 文件中的 `StreamingChatClient` 类：

```typescript
import { StreamingChatClient } from './test-client';

const client = new StreamingChatClient();

await client.sendMessage([{
  role: 'user',
  content: '请介绍一下 React Hooks'
}], {
  onRetrievalUpdate: (data) => {
    console.log('检索状态:', data);
  },
  onContentChunk: (content, accumulated) => {
    process.stdout.write(content);
  },
  onError: (error) => {
    console.error('错误:', error);
  },
  onDone: (summary) => {
    console.log('完成:', summary);
  }
});
```

### JavaScript/Fetch 客户端

```javascript
async function sendMessage(messages) {
  const response = await fetch('/api/openai', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message: messages })
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = JSON.parse(line.slice(6));
        console.log('收到数据:', data);
      }
    }
  }
}
```

## 🔧 配置要求

### 环境变量

确保在 `.env` 文件中配置以下环境变量：

```env
# OpenAI API 配置
AI_KEY=your_openai_api_key
AI_BASE_URL=https://api.openai.com/v1
MODEL=gpt-3.5-turbo

# 嵌入模型配置
EMBEDDING=text-embedding-3-small

# 数据库配置（用于向量存储）
DATABASE_URL=postgresql://...
```

### 依赖包

项目需要以下主要依赖：

```json
{
  "openai": "^4.71.1",
  "@ai-sdk/openai": "^1.0.5",
  "drizzle-orm": "^0.31.2"
}
```

## 🚦 工作流程

1. **接收请求**：API 接收包含对话历史的 POST 请求
2. **提取查询**：从最后一条用户消息中提取查询内容
3. **向量检索**：使用 `searchRetrieval` 函数进行相似度搜索
4. **构建提示**：使用 `getSystemPrompt` 函数将检索结果整合为专业的系统提示词
5. **流式生成**：调用 OpenAI API 进行流式文本生成
6. **实时推送**：通过 SSE 实时推送响应片段给客户端

## 🛠️ 自定义配置

### 修改检索参数

在 `route.ts` 中修改检索配置：

```typescript
const retrievalResult = await searchRetrieval(userQuery, 5); // topK=5
```

### 调整 AI 模型参数

```typescript
const completion = await openai.chat.completions.create({
  model: env.MODEL || 'gpt-3.5-turbo',
  messages: fullMessages,
  stream: true,
  temperature: 0.7,    // 调整创造性
  max_tokens: 2000     // 调整最大长度
});
```

### 自定义系统提示词

系统提示词现在通过 `lib/prompt.ts` 中的 `getSystemPrompt` 函数生成。这个函数专门为前端业务组件开发场景定制，包含：

- **专业角色定义**：前端业务组件开发专家
- **明确目标**：理解需求并生成符合规范的组件代码
- **约束条件**：使用指定的组件库和 API 规范
- **工作流程**：结构化的组件开发流程

如需修改提示词，请编辑 `lib/prompt.ts` 文件：

```typescript
// lib/prompt.ts
export const getSystemPrompt = (reference?: string) => `
# Role: 前端业务组件开发专家
// ... 其他配置
${reference ? `使用以下内容作为参考: ${reference}` : ''}
`;
```

检索到的相关内容会自动作为 `reference` 参数传递给提示词生成器。

## 🐛 错误处理

API 包含完善的错误处理机制：

- **请求验证**：检查消息格式和内容
- **检索错误**：处理向量检索失败的情况
- **AI 服务错误**：处理 OpenAI API 调用失败
- **流式错误**：在流式响应中返回错误信息

## 📊 性能优化建议

1. **数据库索引**：为向量列添加适当的索引
2. **缓存策略**：对频繁查询的结果进行缓存
3. **并发控制**：限制同时处理的请求数量
4. **错误重试**：实现指数退避的重试机制

## 🔒 安全考虑

1. **API 密钥保护**：确保 OpenAI API 密钥安全存储
2. **请求验证**：验证请求来源和内容
3. **速率限制**：实施适当的速率限制策略
4. **内容过滤**：对用户输入进行适当的内容过滤

## 📝 更新日志

- **v1.0.0**：初始版本，支持基本的流式对话和 RAG 检索
- 支持多种响应类型（检索、内容、错误、完成）
- 完整的 TypeScript 类型定义
- React 前端组件示例 