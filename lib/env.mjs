/**
 * 环境变量配置文件
 *
 * 这个文件使用 @t3-oss/env-nextjs 库来创建类型安全的环境变量配置
 * 它会自动验证环境变量的存在性和格式，并提供 TypeScript 类型支持
 */

// 创建类型安全的环境变量配置，区分服务端和客户端，是nextjs中的环境变量的最佳实践。
import { createEnv } from '@t3-oss/env-nextjs';
// 这个库是用来创建类型安全的环境变量配置的
import { z } from 'zod';
// 这行导入是关键！dotenv/config 会自动加载 .env 文件中的环境变量到 process.env
import 'dotenv/config';

// 创建类型安全的环境变量配置
export const env = createEnv({
  // 服务端环境变量配置 - 只能在服务端访问，不会暴露给客户端
  server: {
    // Node.js 运行环境，默认为 development
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    // 数据库连接字符串，必填
    DATABASE_URL: z.string().min(1),
    // HTTP 代理设置，可选
    HTTP_AGENT: z.string().optional(),
    // 嵌入模型名称，必填
    EMBEDDING: z.string().min(1),
    // AI 服务的 API 密钥，必填
    AI_KEY: z.string().min(1),
    // AI 服务的基础 URL，必填
    AI_BASE_URL: z.string().min(1),
    // 默认使用的 AI 模型名称，必填
    MODEL: z.string().min(1)
  },
  // 客户端环境变量配置 - 可以在客户端访问，会暴露给浏览器
  // 注意：客户端环境变量必须以 NEXT_PUBLIC_ 开头
  client: {
    // 示例：NEXT_PUBLIC_PUBLISHABLE_KEY: z.string().min(1),
  },

  // Next.js 13.4.4 及以上版本的运行时环境配置
  // 这里指定哪些客户端变量需要在运行时可用
  experimental__runtimeEnv: {
    // 示例：NEXT_PUBLIC_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_PUBLISHABLE_KEY,
  }
});
