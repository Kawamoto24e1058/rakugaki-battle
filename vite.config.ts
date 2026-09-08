import type { IncomingMessage, ServerResponse } from 'node:http'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { loadEnv, type Connect, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { analyzeImage } from './server/analyzeHandler.ts'

/** 画像 → AI Vision 解析の API を dev / preview サーバーに生やす小さなプラグイン。 */
function aiAnalyzePlugin(): Plugin {
  const handler = async (
    req: IncomingMessage,
    res: ServerResponse,
    next: Connect.NextFunction,
  ): Promise<void> => {
    if (req.url !== '/api/analyze' || req.method !== 'POST') {
      next()
      return
    }
    try {
      const chunks: Buffer[] = []
      for await (const c of req) chunks.push(c as Buffer)
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
      const result = await analyzeImage(body)
      res.setHeader('content-type', 'application/json')
      res.statusCode = result.ok ? 200 : 502
      res.end(JSON.stringify(result))
    } catch (e) {
      res.setHeader('content-type', 'application/json')
      res.statusCode = 400
      res.end(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e), fallback: true }))
    }
  }
  return {
    name: 'rakugaki-ai-analyze',
    configureServer(s) {
      s.middlewares.use(handler)
    },
    configurePreviewServer(s) {
      s.middlewares.use(handler)
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // .env / .env.local の（VITE_ 以外も含む）変数をサーバー側 process.env へ。
  // ANTHROPIC_API_KEY などをミドルウェアで読めるようにする。
  const env = loadEnv(mode, process.cwd(), '')
  for (const k of ['GROQ_API_KEY', 'GEMINI_API_KEY', 'RAKUGAKI_AI_MODEL', 'RAKUGAKI_AI_MOCK']) {
    if (env[k] && !process.env[k]) process.env[k] = env[k]
  }

  return {
  // 5173 は別プロジェクト（ローグライクカード対戦）が使うので、専用ポートに固定。
  server: { port: 5273, strictPort: true },
  preview: { port: 5273, strictPort: true },
  plugins: [
    aiAnalyzePlugin(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'ラクガキバトル',
        short_name: 'ラクガキバトル',
        description: '描いた落書きがキャラになって戦う',
        theme_color: '#ef5a2a',
        background_color: '#fbf7f0',
        display: 'fullscreen',
        orientation: 'any',
        icons: [
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        maximumFileSizeToCacheInBytes: 12 * 1024 * 1024,
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
  }
})
