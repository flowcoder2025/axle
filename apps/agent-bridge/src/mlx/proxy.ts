/**
 * WI-117: OpenAI-Compatible Proxy
 *
 * Express router that forwards /v1/chat/completions (and related endpoints)
 * to the local MLX server, transforming the request/response to match
 * the OpenAI API format expected by callers.
 */

import { Router, type Request, type Response } from "express";
import { mlxBaseUrl } from "../config.js";
import { mlxServer } from "./server.js";

export const mlxProxyRouter = Router();

// ── Helper ───────────────────────────────────────────────────────────────────

async function proxyToMlx(
  req: Request,
  res: Response,
  mlxPath: string
): Promise<void> {
  if (mlxServer.state.status !== "running") {
    res.status(503).json({
      error: {
        message: "MLX server is not running",
        type: "service_unavailable",
        code: "mlx_not_ready",
        status: mlxServer.state.status,
      },
    });
    return;
  }

  const url = `${mlxBaseUrl()}${mlxPath}`;

  try {
    const upstream = await fetch(url, {
      method: req.method,
      headers: {
        "Content-Type": "application/json",
        Accept: req.headers.accept ?? "application/json",
        ...(req.headers.authorization
          ? { Authorization: req.headers.authorization }
          : {}),
      },
      body:
        req.method !== "GET" && req.method !== "HEAD"
          ? JSON.stringify(req.body)
          : undefined,
      signal: AbortSignal.timeout(120_000),
    });

    // Stream support: if the caller requested SSE / streaming, pipe the body
    const isStream =
      req.body?.stream === true ||
      upstream.headers.get("content-type")?.includes("text/event-stream");

    if (isStream && upstream.body) {
      res.setHeader(
        "Content-Type",
        upstream.headers.get("content-type") ?? "text/event-stream"
      );
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("X-Accel-Buffering", "no");
      res.status(upstream.status);

      const reader = upstream.body.getReader();
      const write = (): void => {
        reader.read().then(({ done, value }) => {
          if (done) {
            res.end();
            return;
          }
          res.write(value);
          write();
        });
      };
      write();
      return;
    }

    const data: unknown = await upstream.json();

    // Ensure the response contains the required OpenAI envelope fields
    const normalized = normalizeOpenAiResponse(data, mlxPath);
    res.status(upstream.status).json(normalized);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(502).json({
      error: {
        message: `Upstream MLX error: ${message}`,
        type: "upstream_error",
        code: "mlx_proxy_error",
      },
    });
  }
}

/**
 * Ensure the upstream response always has the shape OpenAI clients expect.
 * MLX servers should already be compatible, but we add defensive defaults.
 */
function normalizeOpenAiResponse(data: unknown, path: string): unknown {
  if (data === null || typeof data !== "object") return data;
  const obj = data as Record<string, unknown>;

  // Chat completions
  if (path.includes("/chat/completions")) {
    return {
      id: obj.id ?? `chatcmpl-local-${Date.now()}`,
      object: obj.object ?? "chat.completion",
      created: obj.created ?? Math.floor(Date.now() / 1000),
      model: obj.model ?? "mlx-local",
      choices: obj.choices ?? [],
      usage: obj.usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    };
  }

  // Models list
  if (path.includes("/models")) {
    return {
      object: obj.object ?? "list",
      data: obj.data ?? [],
    };
  }

  return data;
}

// ── Routes ───────────────────────────────────────────────────────────────────

/** POST /v1/chat/completions */
mlxProxyRouter.post("/v1/chat/completions", (req, res) => {
  proxyToMlx(req, res, "/v1/chat/completions");
});

/** GET /v1/models */
mlxProxyRouter.get("/v1/models", (req, res) => {
  proxyToMlx(req, res, "/v1/models");
});

/** GET /v1/models/:model */
mlxProxyRouter.get("/v1/models/:model", (req, res) => {
  proxyToMlx(req, res, `/v1/models/${req.params.model}`);
});

/** POST /v1/completions (legacy) */
mlxProxyRouter.post("/v1/completions", (req, res) => {
  proxyToMlx(req, res, "/v1/completions");
});
