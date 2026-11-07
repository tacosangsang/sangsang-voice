import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import { createApp } from './server/app';
import type { GeminiClient } from './server/app';
import { recordingsConfig } from './server/recordingsConfig';
import { DEFAULT_SCRIPT_PAGE_ID, NotionScriptSource } from './server/notionScriptSource';
import { BundledScriptSource } from './src/script/bundledSource';
import type { ScriptSource } from './src/script/source';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const portArgIndex = process.argv.indexOf('--port');
const parsedArgPort = portArgIndex !== -1 ? parseInt(process.argv[portArgIndex + 1], 10) : NaN;
// AI Studio Cloud Run의 Nginx는 8080 포트로 받고 3000 포트로 전달한다.
const PORT = !isNaN(parsedArgPort)
  ? parsedArgPort
  : Number(process.env.PORT) === 8080
    ? 3000
    : Number(process.env.PORT) || 3000;

// 환경 변수가 나중에 채워지는 경우도 요청 시점에 클라이언트를 만든다.
function getAiClient(): GeminiClient | undefined {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return undefined;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const bundledScript = new BundledScriptSource();
const notionScript: ScriptSource | undefined = process.env.NOTION_TOKEN
  ? new NotionScriptSource(process.env.NOTION_TOKEN, process.env.NOTION_SCRIPT_PAGE_ID || DEFAULT_SCRIPT_PAGE_ID)
  : undefined;

const { repo: recordings, problem: recordingsProblem } = recordingsConfig(process.env);
const app = createApp({ notionScript, bundledScript, recordings, recordingsProblem, getAiClient });

// Vite 또는 정적 파일 미들웨어를 연결하고 서버를 시작한다.
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
    console.log(`  ➜  Local:   http://localhost:${PORT}/`);
  });

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use.`);
    } else {
      console.error('Server encountered error:', err);
    }
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
