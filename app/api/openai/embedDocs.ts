// 执行embedding的脚本文件，会在package.json中配置。
// 读取basic-components.txt文件，进行embedding，并保存到数据库中

import { getEmbeddings } from './embedding';
import { saveEmbeddings } from '../../../lib/db/openai/actions';
import fs from 'fs';

// 获取嵌入向量
export async function embedDocs() {
  const docs = fs.readFileSync('./ai-docs/basic-components.txt', 'utf-8');

  const embeddings = await getEmbeddings(docs);

  // 将 EmbeddingResult[] 转换为 saveEmbeddings 所需的格式
  const formattedEmbeddings = embeddings.map((item) => ({
    embedding: item.embedding,
    content: item.text
  }));

  // 保存嵌入向量
  await saveEmbeddings(formattedEmbeddings);

  console.log('save embeddings done');

  // 退出
  process.exit(0);
}

embedDocs();
