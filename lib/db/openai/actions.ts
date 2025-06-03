'use server';

// 保存embedding数据到数据库中

import { db } from '../index';
import { openAiEmbeddings } from './schema';

/**
 * 保存嵌入数据到数据库
 * @param embeddings 嵌入数据数组，每个元素包含 embedding 向量和 content 文本内容
 * @returns 保存的嵌入数据的 ID 数组
 */
export async function saveEmbeddings(embeddings: Array<{ embedding: number[]; content: string }>) {
  try {
    // 准备要插入的数据
    const embeddingsToInsert = embeddings.map((item) => ({
      content: item.content,
      embedding: item.embedding
    }));

    // 批量插入数据
    const result = await db
      .insert(openAiEmbeddings)
      .values(embeddingsToInsert)
      .returning({ id: openAiEmbeddings.id });

    // 返回插入的记录 ID 数组
    return {
      success: true,
      ids: result.map((r) => r.id),
      count: result.length
    };
  } catch (error) {
    console.error('保存嵌入数据失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '未知错误'
    };
  }
}
