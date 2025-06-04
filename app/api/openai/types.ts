import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

// openai 请求参数类型
export type OpenAIRequest = {
  message: ChatCompletionMessageParam[];
};
