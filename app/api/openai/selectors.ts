'use server';

import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

/**
 * 搜索结果接口，包含原始内容和相似度分数
 */
export interface SimilaritySearchResult {
  id: string;
  content: string;
  similarity: number;
}

/**
 * 搜索参数接口
 */
export interface SimilaritySearchParams {
  queryEmbedding: number[]; // 查询向量
  threshold?: number; // 相似度阈值，默认为 0.7
  limit?: number; // 返回结果数量限制，默认为 10
}

/**
 * 数据库查询结果的类型定义
 */
interface DbQueryResult {
  id: string;
  content: string;
  similarity: string;
}

/**
 * ！！！！！基于向量嵌入的语义相似度搜索函数，
 * 人话就是：输入向量，根据对应的余弦相似度，从数据库中查询出相似度最高的N个结果
 *
 * @param params 搜索参数
 * @returns 相似度最高的 N 个结果，包含原始内容和相似度分数
 */
export async function vectorSimilaritySearch(params: SimilaritySearchParams): Promise<{
  success: boolean;
  results?: SimilaritySearchResult[];
  error?: string;
  totalMatches?: number;
}> {
  try {
    const { queryEmbedding, threshold = 0.7, limit = 10 } = params;

    // 验证输入参数
    if (!queryEmbedding || !Array.isArray(queryEmbedding) || queryEmbedding.length === 0) {
      return {
        success: false,
        error: '查询向量不能为空且必须是数组格式'
      };
    }

    if (queryEmbedding.length !== 1536) {
      return {
        success: false,
        error: '查询向量维度必须为 1536'
      };
    }

    if (threshold < -1 || threshold > 1) {
      return {
        success: false,
        error: '相似度阈值必须在 -1 到 1 之间'
      };
    }

    if (limit <= 0 || limit > 100) {
      return {
        success: false,
        error: '结果限制必须在 1 到 100 之间'
      };
    }

    // 将查询向量转换为 PostgreSQL 向量格式
    const queryVector = `[${queryEmbedding.join(',')}]`;

    // 使用原生 SQL 查询计算余弦相似度
    // 余弦相似度公式: 1 - (cosine_distance)
    // cosine_distance 使用 pgvector 的 <=> 操作符
    const results = await db.execute(sql`
      SELECT 
        id,
        content,
        (1 - (embedding <=> ${queryVector}::vector)) as similarity
      FROM open_ai_embeddings
      WHERE (1 - (embedding <=> ${queryVector}::vector)) >= ${threshold}
      ORDER BY similarity DESC
      LIMIT ${limit}
    `);

    // 处理查询结果
    const searchResults: SimilaritySearchResult[] = (results as unknown as DbQueryResult[]).map(
      (row) => ({
        id: row.id,
        content: row.content,
        similarity: parseFloat(row.similarity)
      })
    );

    return {
      success: true,
      results: searchResults,
      totalMatches: searchResults.length
    };
  } catch (error) {
    console.error('向量相似度搜索失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '未知错误'
    };
  }
}

/**
 * 获取最相似的单个结果
 *
 * @param queryEmbedding 查询向量
 * @param threshold 相似度阈值，默认为 0.7
 * @returns 最相似的单个结果
 */
export async function findMostSimilar(
  queryEmbedding: number[],
  threshold: number = 0.7
): Promise<{
  success: boolean;
  result?: SimilaritySearchResult;
  error?: string;
}> {
  const searchResult = await vectorSimilaritySearch({
    queryEmbedding,
    threshold,
    limit: 1
  });

  if (!searchResult.success) {
    return {
      success: false,
      error: searchResult.error
    };
  }

  return {
    success: true,
    result: searchResult.results?.[0]
  };
}

/**
 * 批量向量相似度搜索
 *
 * @param queries 多个查询向量
 * @param threshold 相似度阈值，默认为 0.7
 * @param limit 每个查询的结果限制，默认为 5
 * @returns 每个查询的搜索结果
 */
export async function batchVectorSearch(
  queries: number[][],
  threshold: number = 0.7,
  limit: number = 5
): Promise<{
  success: boolean;
  results?: SimilaritySearchResult[][];
  error?: string;
}> {
  try {
    // 并行执行多个搜索查询
    const searchPromises = queries.map((queryEmbedding) =>
      vectorSimilaritySearch({
        queryEmbedding,
        threshold,
        limit
      })
    );

    const searchResults = await Promise.all(searchPromises);

    // 检查是否有失败的查询
    const failedQueries = searchResults.filter((result) => !result.success);
    if (failedQueries.length > 0) {
      return {
        success: false,
        error: `有 ${failedQueries.length} 个查询失败`
      };
    }

    const allResults = searchResults.map((result) => result.results || []);

    return {
      success: true,
      results: allResults
    };
  } catch (error) {
    console.error('批量向量搜索失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '未知错误'
    };
  }
}

/**
 * 根据内容获取相似文档
 *
 * @param contentId 内容 ID
 * @param threshold 相似度阈值，默认为 0.7
 * @param limit 结果限制，默认为 10
 * @returns 相似的文档列表（不包含自身）
 */
export async function findSimilarDocuments(
  contentId: string,
  threshold: number = 0.7,
  limit: number = 10
): Promise<{
  success: boolean;
  results?: SimilaritySearchResult[];
  error?: string;
}> {
  try {
    // 首先获取指定内容的向量
    const targetDoc = await db.execute(sql`
      SELECT embedding FROM open_ai_embeddings WHERE id = ${contentId}
    `);

    if (targetDoc.length === 0) {
      return {
        success: false,
        error: '未找到指定的文档'
      };
    }

    const targetEmbedding = (targetDoc[0] as unknown as { embedding: number[] }).embedding;

    // 搜索相似文档，但排除自身
    const results = await db.execute(sql`
      SELECT 
        id,
        content,
        (1 - (embedding <=> ${`[${targetEmbedding.join(',')}]`}::vector)) as similarity
      FROM open_ai_embeddings
      WHERE id != ${contentId}
        AND (1 - (embedding <=> ${`[${targetEmbedding.join(',')}]`}::vector)) >= ${threshold}
      ORDER BY similarity DESC
      LIMIT ${limit}
    `);

    const searchResults: SimilaritySearchResult[] = (results as unknown as DbQueryResult[]).map(
      (row) => ({
        id: row.id,
        content: row.content,
        similarity: parseFloat(row.similarity)
      })
    );

    return {
      success: true,
      results: searchResults
    };
  } catch (error) {
    console.error('查找相似文档失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '未知错误'
    };
  }
}
