import { NextResponse } from "next/server";
import { z } from "zod";

import { exportRepositoryMarkdown } from "@/lib/export/repository-markdown";
import {
  getPublicRepository,
  getRawFile,
  getRepositoryTree,
  GitHubApiError,
} from "@/lib/github/github-client";
import { parseRepositoryUrl, RepositoryUrlError } from "@/lib/github/parse-repository-url";

export const runtime = "nodejs";
export const maxDuration = 60;

const requestSchema = z.object({ url: z.string().trim().min(1).max(300) });

export async function POST(request: Request) {
  try {
    const payload = requestSchema.safeParse(await request.json());
    if (!payload.success)
      return NextResponse.json({ error: "Pega una URL válida de GitHub." }, { status: 400 });
    const { owner, repo } = parseRepositoryUrl(payload.data.url);
    const metadata = await getPublicRepository(owner, repo);
    const tree = await getRepositoryTree(metadata);
    const result = await exportRepositoryMarkdown(metadata, tree, getRawFile);
    if (!result.filesIncluded)
      return NextResponse.json({ error: "No encontramos archivos textuales exportables." }, { status: 422 });

    return new NextResponse(result.markdown, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${result.filename}"`,
        "Cache-Control": "private, no-store",
        "X-Files-Included": String(result.filesIncluded),
        "X-Files-Skipped": String(result.filesSkipped),
        "X-Estimated-Tokens": String(result.estimatedTokens),
        "X-Export-Truncated": String(result.truncated),
      },
    });
  } catch (error) {
    if (error instanceof RepositoryUrlError)
      return NextResponse.json({ error: error.message }, { status: 400 });
    if (error instanceof GitHubApiError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status >= 500 ? 502 : error.status },
      );
    return NextResponse.json({ error: "No pudimos preparar el contexto Markdown." }, { status: 500 });
  }
}
