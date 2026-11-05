import { defineConfig } from 'vitest/config';

/** 生成スクリプト用（ふだんの テストでは うごかさない）。npx vitest run -c scripts/vitest.config.ts */
export default defineConfig({ test: { environment: 'node', include: ['scripts/**/*.test.ts'], testTimeout: 600000 } });
