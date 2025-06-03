//创建openai embeddings表，这个地方就是来设置表结构及其对应字段的信息

import { index, pgTable, text, varchar, vector } from 'drizzle-orm/pg-core';
// 导入 nanoid 用于生成唯一 ID
import { nanoid } from 'nanoid';

// 定义 OpenAI embeddings 表结构
export const openAiEmbeddings = pgTable(
  // 表名
  'open_ai_embeddings',
  // 表字段定义
  {
    // id 字段: 主键，使用 nanoid 生成唯一标识符
    // 类型为 varchar(191)
    id: varchar('id', { length: 191 })
      .$defaultFn(() => nanoid()) // 默认值使用 nanoid() 函数生成
      .primaryKey(), // 设置为主键
    // content 字段: 存储文本内容
    // 类型为 text，不允许为空
    content: text('content').notNull(),
    // embedding 字段: 存储 OpenAI 生成的向量嵌入
    // 类型为向量，维度为 1536（OpenAI 的标准维度），不允许为空
    // 注意：在实际使用时，需要确保 PostgreSQL 安装了 pgvector 扩展
    // 并且需要使用适当的方式定义向量字段，这里使用字符串表示
    embedding: vector('embedding', { dimensions: 1536 }).notNull()
  },
  (t) => ({
    // 定义一个名为 'openai_embedding_index' 的向量索引
    // 这个索引使用 HNSW (Hierarchical Navigable Small World) 算法
    // 用于加速向量相似度搜索
    openaiEmbeddingIndex: index('openai_embedding_index').using(
      // 使用 HNSW 作为索引算法
      'hnsw',
      // 在 embedding 字段上创建索引
      // vector_cosine_ops 表示使用余弦相似度作为距离度量
      // 余弦相似度用于计算两个向量之间的相似程度
      t.embedding.op('vector_cosine_ops')
    )
  })
);
