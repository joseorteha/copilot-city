import { NextResponse } from "next/server";
import { z } from "zod";

import { analyzeRepositoryTree } from "@/lib/analyzer/analyze-repository";
import { generateCity } from "@/lib/city/generate-city";
import {
  getPublicRepository,
  getRawFile,
  getRepositoryInsights,
  getRepositoryTree,
  GitHubApiError,
} from "@/lib/github/github-client";
import { parseRepositoryUrl, RepositoryUrlError } from "@/lib/github/parse-repository-url";
import type { AnalyzeRepositoryResponse } from "@/types/city";

export const runtime = "nodejs";
export const maxDuration = 30;

const requestSchema = z.object({
  url: z.string().trim().min(1).max(300),
});

const analysisCache = new Map<string, { expiresAt: number; response: AnalyzeRepositoryResponse }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function POST(request: Request) {
  try {
    const payload = requestSchema.safeParse(await request.json());

    if (!payload.success) {
      return NextResponse.json(
        { error: "Pega una URL válida de un repositorio público de GitHub." },
        { status: 400 },
      );
    }

    const { owner, repo } = parseRepositoryUrl(payload.data.url);
    // A token-backed response carries a deeper history than an anonymous one, so the two
    // must never share an entry.
    const depth = process.env.GITHUB_TOKEN ? "deep" : "shallow";
    const cacheKey = `${depth}:${owner.toLowerCase()}/${repo.toLowerCase()}`;
    const cached = analysisCache.get(cacheKey);
    if (cached && cached.expiresAt <= Date.now()) analysisCache.delete(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return NextResponse.json(cached.response, {
        headers: { "Cache-Control": "private, max-age=60", "X-Copilot-City-Cache": "HIT" },
      });
    }

    const metadata = await getPublicRepository(owner, repo);
    const [tree, insights] = await Promise.all([
      getRepositoryTree(metadata),
      getRepositoryInsights(metadata),
    ]);
    const analysis = await analyzeRepositoryTree(metadata, tree, getRawFile);

    if (analysis.files.length === 0) {
      return NextResponse.json(
        { error: "El repositorio no contiene archivos compatibles para construir una ciudad." },
        { status: 422 },
      );
    }

    const response: AnalyzeRepositoryResponse = {
      city: generateCity(analysis, insights),
    };
    analysisCache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, response });

    if (analysisCache.size > 30) {
      const oldestKey = analysisCache.keys().next().value;
      if (oldestKey) analysisCache.delete(oldestKey);
    }

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "private, max-age=60",
        "X-Copilot-City-Cache": "MISS",
      },
    });
  } catch (error) {
    if (error instanceof RepositoryUrlError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (error instanceof GitHubApiError) {
      return NextResponse.json(
        { error: error.message, rateLimitReset: error.rateLimitReset },
        { status: error.status >= 500 ? 502 : error.status },
      );
    }

    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "La solicitud no contiene JSON válido." }, { status: 400 });
    }

    console.error("Repository analysis failed", error);
    return NextResponse.json(
      { error: "No pudimos analizar el repositorio. Inténtalo de nuevo en unos segundos." },
      { status: 500 },
    );
  }
}
