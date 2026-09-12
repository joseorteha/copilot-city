import type { CommitInsight, ContributorInsight, PullRequestInsight, RepositoryInsights, RepositoryMetadata } from "@/types/repository";

interface GitHubRepositoryResponse {
  name: string;
  full_name: string;
  private: boolean;
  description: string | null;
  default_branch: string;
  html_url: string;
  stargazers_count: number;
  forks_count: number;
  language: string | null;
  size: number;
  updated_at: string;
  owner: { login: string };
}

export interface GitHubTreeItem {
  path: string;
  mode: string;
  type: "blob" | "tree" | "commit";
  sha: string;
  size?: number;
  url: string;
}

interface GitHubTreeResponse {
  sha: string;
  tree: GitHubTreeItem[];
  truncated: boolean;
}

interface GitHubCommitListItem {
  sha: string;
  html_url: string;
  commit: { message: string; author: { name: string; date: string } | null };
  author: { login: string; avatar_url: string } | null;
}

interface GitHubCommitDetail extends GitHubCommitListItem {
  files?: Array<{ filename: string; status: string; additions: number; deletions: number; changes: number; previous_filename?: string }>;
}

interface GitHubPullRequest {
  number: number;
  title: string;
  html_url: string;
  draft: boolean;
  updated_at: string;
  additions: number;
  deletions: number;
  changed_files: number;
  user: { login: string } | null;
}

interface GitHubContributor { login: string; avatar_url: string; html_url: string; contributions: number }
interface GitHubWorkflowRuns { workflow_runs: Array<{ status: string; conclusion: string | null; name: string; html_url: string; updated_at: string }> }

export class GitHubApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly rateLimitReset?: string,
  ) {
    super(message);
    this.name = "GitHubApiError";
  }
}

function githubHeaders() {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "Copilot-City",
  };

  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  return headers;
}

async function fetchGitHubJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: githubHeaders(),
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });

  if (!response.ok) {
    const reset = response.headers.get("x-ratelimit-reset") ?? undefined;

    if (response.status === 404) {
      throw new GitHubApiError("No encontramos ese repositorio público en GitHub.", 404);
    }

    if (response.status === 403 || response.status === 429) {
      throw new GitHubApiError(
        "GitHub limitó temporalmente las solicitudes. Prueba de nuevo más tarde o configura GITHUB_TOKEN.",
        response.status,
        reset,
      );
    }

    throw new GitHubApiError(`GitHub respondió con un error (${response.status}).`, response.status, reset);
  }

  return response.json() as Promise<T>;
}

export async function getPublicRepository(owner: string, repo: string) {
  const data = await fetchGitHubJson<GitHubRepositoryResponse>(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
  );

  if (data.private) {
    throw new GitHubApiError("El MVP solo puede analizar repositorios públicos.", 400);
  }

  const metadata: RepositoryMetadata = {
    owner: data.owner.login,
    name: data.name,
    fullName: data.full_name,
    description: data.description,
    defaultBranch: data.default_branch,
    htmlUrl: data.html_url,
    stars: data.stargazers_count,
    forks: data.forks_count,
    primaryLanguage: data.language,
    sizeKb: data.size,
    updatedAt: data.updated_at,
  };

  return metadata;
}

export async function getRepositoryTree(metadata: RepositoryMetadata) {
  const branch = encodeURIComponent(metadata.defaultBranch);
  const owner = encodeURIComponent(metadata.owner);
  const repo = encodeURIComponent(metadata.name);

  return fetchGitHubJson<GitHubTreeResponse>(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
  );
}

export async function getRawFile(
  metadata: RepositoryMetadata,
  path: string,
): Promise<string | null> {
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  const branch = encodeURIComponent(metadata.defaultBranch);
  const url = `https://raw.githubusercontent.com/${encodeURIComponent(metadata.owner)}/${encodeURIComponent(metadata.name)}/${branch}/${encodedPath}`;

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "Copilot-City" },
      cache: "no-store",
      signal: AbortSignal.timeout(7_000),
    });

    if (!response.ok) return null;

    const length = Number(response.headers.get("content-length") ?? 0);
    if (length > 180_000) return null;

    const content = await response.text();
    return content.length <= 180_000 ? content : null;
  } catch {
    return null;
  }
}

function coordinates(metadata: RepositoryMetadata) {
  return `${encodeURIComponent(metadata.owner)}/${encodeURIComponent(metadata.name)}`;
}

function normalizeStatus(status: string) {
  return (["added", "modified", "removed", "renamed"].includes(status) ? status : "unknown") as "added" | "modified" | "removed" | "renamed" | "unknown";
}

export async function getRepositoryInsights(metadata: RepositoryMetadata): Promise<RepositoryInsights> {
  const repo = coordinates(metadata);
  const empty: RepositoryInsights = { commits: [], pullRequests: [], contributors: [], ci: null };
  const commitDepth = process.env.GITHUB_TOKEN ? 8 : 4;
  const pullDepth = process.env.GITHUB_TOKEN ? 3 : 1;

  try {
    const [commitList, pullList, contributors, workflowRuns] = await Promise.all([
      fetchGitHubJson<GitHubCommitListItem[]>(`https://api.github.com/repos/${repo}/commits?per_page=${commitDepth}`),
      fetchGitHubJson<GitHubPullRequest[]>(`https://api.github.com/repos/${repo}/pulls?state=open&sort=updated&direction=desc&per_page=${pullDepth}`),
      fetchGitHubJson<GitHubContributor[]>(`https://api.github.com/repos/${repo}/contributors?per_page=8&anon=1`),
      fetchGitHubJson<GitHubWorkflowRuns>(`https://api.github.com/repos/${repo}/actions/runs?per_page=1`).catch(() => ({ workflow_runs: [] })),
    ]);

    const [commitDetails, pullFiles] = await Promise.all([
      Promise.all(commitList.slice(0, commitDepth).map((commit) => fetchGitHubJson<GitHubCommitDetail>(`https://api.github.com/repos/${repo}/commits/${commit.sha}`).catch(() => commit))),
      Promise.all(pullList.slice(0, pullDepth).map((pull) => fetchGitHubJson<GitHubCommitDetail["files"]>(`https://api.github.com/repos/${repo}/pulls/${pull.number}/files?per_page=100`).catch(() => []))),
    ]);

    const commits: CommitInsight[] = commitDetails.map((commit) => {
      const files = "files" in commit ? commit.files ?? [] : [];
      return {
        sha: commit.sha,
        message: commit.commit.message.split("\n")[0],
        author: commit.author?.login ?? commit.commit.author?.name ?? "Desconocido",
        avatarUrl: commit.author?.avatar_url ?? null,
        date: commit.commit.author?.date ?? new Date(0).toISOString(),
        htmlUrl: commit.html_url,
        files: files.map((file) => ({ path: file.filename, status: normalizeStatus(file.status), additions: file.additions, deletions: file.deletions, changes: file.changes })),
      };
    });

    const pullRequests: PullRequestInsight[] = pullList.slice(0, pullDepth).map((pull, index) => ({
      number: pull.number,
      title: pull.title,
      author: pull.user?.login ?? "Desconocido",
      htmlUrl: pull.html_url,
      draft: pull.draft,
      updatedAt: pull.updated_at,
      additions: pull.additions,
      deletions: pull.deletions,
      changedFiles: pull.changed_files,
      files: (pullFiles[index] ?? []).map((file) => ({ path: file.filename, status: normalizeStatus(file.status), additions: file.additions, deletions: file.deletions, changes: file.changes })),
    }));

    const normalizedContributors: ContributorInsight[] = contributors.filter((item) => item?.login).map((item) => ({ login: item.login, avatarUrl: item.avatar_url, htmlUrl: item.html_url, contributions: item.contributions }));
    const run = workflowRuns.workflow_runs[0];
    const ci = run ? { status: run.status, conclusion: run.conclusion, name: run.name, htmlUrl: run.html_url, updatedAt: run.updated_at } : null;
    return { commits, pullRequests, contributors: normalizedContributors, ci };
  } catch {
    return empty;
  }
}
