import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

// openai 请求参数类型
export type OpenAIRequest = {
  message: ChatCompletionMessageParam[];
  imageUrl?: string; // 添加可选的图片URL字段
};
