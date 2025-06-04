'use client';

import { useState } from 'react';
import { ChatMessages } from '../components/ChatMessages';
import { Message, MessageContent } from '../components/ChatMessages/interface';
import { nanoid } from 'nanoid';

// 定义检索结果的类型
interface RetrievalResult {
  id: string;
  content: string;
  score: number;
}

// API 返回的原始数据格式
interface APIRetrievalResult {
  id: string;
  content: string;
  similarity: number;
}

// 定义请求体的类型
interface RequestBody {
  message: Array<{
    role: string;
    content: string | MessageContent[];
    imageUrl?: string;
  }>;
  imageUrl?: string;
}

// 定义流式响应数据结构
interface StreamChunk {
  type: 'content' | 'retrieval' | 'error' | 'done';
  data: {
    status?: string;
    message?: string;
    results?: APIRetrievalResult[];
    count?: number;
    content?: string;
    accumulated?: string;
    totalLength?: number;
    retrievalCount?: number;
  };
}

const Home = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messageImgUrl, setMessageImgUrl] = useState('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: nanoid(),
      role: 'user',
      content: input,
      ...(messageImgUrl && { imageUrl: messageImgUrl })
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const requestBody: RequestBody = {
        message: messages.concat(userMessage).map(({ role, content, imageUrl }) => ({
          role,
          content,
          ...(imageUrl && { imageUrl })
        })),
        ...(messageImgUrl && { imageUrl: messageImgUrl })
      };

      const response = await fetch('/api/openai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error('Failed to fetch response');
      }

      setMessageImgUrl('');

      const reader = response.body?.getReader();
      if (!reader) return;

      let accumulatedContent = '';
      let references: RetrievalResult[] = [];
      let buffer = '';
      const SSE_PATTERN = /^data: ({.+}|\[DONE\])\n\n/m;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = new TextDecoder().decode(value);
        buffer += chunk;

        while (true) {
          const match = SSE_PATTERN.exec(buffer);
          if (!match) break;

          const data = match[1];
          if (data === '[DONE]') {
            buffer = buffer.slice(match[0].length);
            continue;
          }

          try {
            const parsed: StreamChunk = JSON.parse(data);
            console.log(parsed, '---parsed');

            // 处理不同类型的消息
            switch (parsed.type) {
              case 'content':
                // 处理内容消息
                if (parsed.data.content) {
                  accumulatedContent += parsed.data.content;
                }
                break;

              case 'retrieval':
                // 处理检索结果
                if (parsed.data.results) {
                  references = parsed.data.results.map((result: APIRetrievalResult) => ({
                    id: result.id,
                    content: result.content,
                    score: result.similarity
                  }));
                }
                break;

              case 'error':
                console.error('Server error:', parsed.data.message);
                break;

              case 'done':
                console.log('Stream completed:', parsed.data.message);
                break;
            }

            // 更新消息状态
            setMessages((prev) => {
              const lastMessage = prev[prev.length - 1];
              if (lastMessage?.role === 'assistant') {
                return [
                  ...prev.slice(0, -1),
                  { ...lastMessage, content: accumulatedContent, ragDocs: references }
                ];
              } else {
                return [
                  ...prev,
                  {
                    id: nanoid(),
                    role: 'assistant',
                    content: accumulatedContent,
                    ragDocs: references
                  }
                ];
              }
            });
          } catch (e) {
            console.error('Error parsing SSE data:', e);
          }

          buffer = buffer.slice(match[0].length);
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      // Handle error appropriately
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetry = async (messageId: string) => {
    const messageIndex = messages.findIndex((msg) => msg.id === messageId);
    if (messageIndex === -1) return;

    const messagesToKeep = messages.slice(0, messageIndex);
    setMessages(messagesToKeep);
    setIsLoading(true);

    // 重新触发提交，使用当前的 input 值
    await handleSubmit({
      preventDefault: () => {}
    } as React.FormEvent);
  };

  return (
    <ChatMessages
      messages={messages}
      input={input}
      handleInputChange={handleInputChange}
      onSubmit={handleSubmit}
      isLoading={isLoading}
      messageImgUrl={messageImgUrl}
      setMessagesImgUrl={setMessageImgUrl}
      onRetry={handleRetry}
    />
  );
};

export default Home;
