/**
 * Vercel Serverless Functions（Node runtime）向けの最小限の型。
 * `@vercel/node` は依存に含めない（脆弱な推移的依存が付いてくるため）。
 * 実際に渡ってくるオブジェクトは Node の IncomingMessage/ServerResponse に
 * `query`/`body`（req）と `status()`/`json()`（res）が足された形。
 */
import type { IncomingMessage, ServerResponse } from 'node:http';

export interface VercelReq extends IncomingMessage {
  query: Record<string, string | string[] | undefined>;
  body: unknown;
}

export interface VercelRes extends ServerResponse {
  status(code: number): VercelRes;
  json(body: unknown): void;
}
