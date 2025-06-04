import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { env } from '../../../lib/env.mjs';
import { searchRetrieval } from './embedding';
import { OpenAIRequest } from './types';
import { getSystemPrompt } from '../../../lib/prompt';

// 创建 OpenAI 客户端实例
const openai = new OpenAI({
  apiKey: env.AI_KEY,
  baseURL: env.AI_BASE_URL
});

// 定义流式响应数据结构
interface StreamChunk {
  type: 'content' | 'retrieval' | 'error' | 'done';
  data: {
    status?: string;
    message?: string;
    results?: Array<{
      id: string;
      content: string;
      similarity: number;
    }>;
    count?: number;
    content?: string;
    accumulated?: string;
    totalLength?: number;
    retrievalCount?: number;
  };
}

// 创建流式响应辅助函数
function createStreamResponse(encoder: TextEncoder, controller: ReadableStreamDefaultController) {
  return {
    writeChunk: (chunk: StreamChunk) => {
      const data = `data: ${JSON.stringify(chunk)}\n\n`;
      controller.enqueue(encoder.encode(data));
    },
    close: () => {
      controller.close();
    }
  };
}

export async function POST(request: NextRequest) {
  try {
    // 解析请求体
    const { message: messages }: OpenAIRequest = await request.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: '请提供有效的对话消息' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 获取最后一条用户消息
    const lastMessage = messages[messages.length - 1];
    const userQuery =
      typeof lastMessage.content === 'string'
        ? lastMessage.content
        : Array.isArray(lastMessage.content)
        ? lastMessage.content.find((item) => item.type === 'text')?.text || ''
        : '';

    // 创建流式响应
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        const stream = createStreamResponse(encoder, controller);

        try {
          // 步骤1：基于用户查询进行向量检索
          stream.writeChunk({
            type: 'retrieval',
            data: { status: 'searching', message: '正在搜索相关内容...' }
          });

          const retrievalResult = await searchRetrieval(userQuery, 5);

          if (!retrievalResult.success) {
            stream.writeChunk({
              type: 'error',
              data: { message: `检索失败: ${retrievalResult.error}` }
            });
            stream.close();
            return;
          }

          // 发送检索到的相关内容
          stream.writeChunk({
            type: 'retrieval',
            data: {
              status: 'found',
              results: retrievalResult.results,
              count: retrievalResult.results?.length || 0
            }
          });

          // 步骤2：构建系统提示词，整合相关内容
          const relevantContent =
            retrievalResult.results
              ?.map((result, index) => `[参考内容${index + 1}]\n${result.content}`)
              .join('\n\n') || '';

          // 使用 getSystemPrompt 函数生成系统提示词，将检索到的相关内容作为参考
          const systemPrompt = getSystemPrompt(relevantContent);

          // 构建完整的消息历史
          const fullMessages = [{ role: 'system' as const, content: systemPrompt }, ...messages];

          // 步骤3：创建 OpenAI 流式对话补全
          const completion = await openai.chat.completions.create({
            model: env.MODEL || 'gpt-3.5-turbo',
            messages: fullMessages,
            stream: true,
            temperature: 0.7,
            max_tokens: 2000
          });

          // 步骤4：流式返回 AI 响应
          let fullResponse = '';
          for await (const chunk of completion) {
            const delta = chunk.choices[0]?.delta;

            if (delta?.content) {
              fullResponse += delta.content;
              stream.writeChunk({
                type: 'content',
                data: {
                  content: delta.content,
                  accumulated: fullResponse
                }
              });
            }
          }

          // 发送完成信号
          stream.writeChunk({
            type: 'done',
            data: {
              message: '对话完成',
              totalLength: fullResponse.length,
              retrievalCount: retrievalResult.results?.length || 0
            }
          });
        } catch (error) {
          console.error('流式对话处理错误:', error);
          stream.writeChunk({
            type: 'error',
            data: {
              message: error instanceof Error ? error.message : '处理请求时发生未知错误'
            }
          });
        } finally {
          stream.close();
        }
      }
    });

    // 返回 SSE 格式的流式响应
    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
  } catch (error) {
    console.error('API 路由错误:', error);
    return new Response(
      JSON.stringify({
        error: '服务器内部错误',
        details: error instanceof Error ? error.message : '未知错误'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// 处理 OPTIONS 请求（用于 CORS 预检）
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
