// embedding流程---将文本转换为向量

import OpenAI from 'openai';
import { env } from '../../../lib/env.mjs';

// 创建 OpenAI 客户端实例
const openai = new OpenAI({
  apiKey: env.AI_KEY,
  baseURL: env.AI_BASE_URL
});

// 定义返回结果的接口
interface EmbeddingResult {
  text: string;
  embedding: number[];
}

/**
 * 将文本转换为向量嵌入
 * @param text 输入文本
 * @param model 使用的嵌入模型，默认使用环境变量中配置的模型
 * @param chunkSeparator 文本分块的分隔符，如果提供则按此分隔符分块处理
 * @param chunkSize 每个文本块的最大长度，默认为 8000 个字符
 * @returns 包含原文本和对应向量的结果数组
 */
export async function getEmbeddings(
  text: string,
  model: string = env.EMBEDDING || 'text-embedding-ada-002',
  chunkSeparator: string = '-------split line-------',
  chunkSize: number = 8000
): Promise<EmbeddingResult[]> {
  try {
    // 如果文本为空，返回空数组
    if (!text || text.trim() === '') {
      return [];
    }

    // 文本分块处理
    let textChunks: string[] = [];

    if (chunkSeparator) {
      // 按分隔符分块
      textChunks = text.split(chunkSeparator).filter((chunk) => chunk.trim() !== '');
    } else {
      // 如果没有提供分隔符，将整个文本作为一个块
      textChunks = [text];
    }

    // 进一步处理过长的文本块
    const finalChunks: string[] = [];
    for (const chunk of textChunks) {
      if (chunk.length <= chunkSize) {
        finalChunks.push(chunk);
      } else {
        // 如果文本块超过最大长度，按字符数进一步分割
        let i = 0;
        while (i < chunk.length) {
          finalChunks.push(chunk.substring(i, i + chunkSize));
          i += chunkSize;
        }
      }
    }

    // 批量获取嵌入向量
    const embeddingResponse = await openai.embeddings.create({
      model,
      input: finalChunks
    });

    // 组合结果
    const results: EmbeddingResult[] = finalChunks.map((chunk, index) => ({
      text: chunk,
      embedding: embeddingResponse.data[index].embedding
    }));

    return results;
  } catch (error) {
    console.error('获取嵌入向量时出错:', error);
    throw error;
  }
}

/**
 * 计算两个向量之间的余弦相似度
 * @param vecA 向量A
 * @param vecB 向量B
 * @returns 余弦相似度值，范围为 -1 到 1
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error('向量维度不匹配');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
