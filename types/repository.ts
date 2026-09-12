export interface RepositoryMetadata {
  owner: string;
  name: string;
  fullName: string;
  description: string | null;
  defaultBranch: string;
  htmlUrl: string;
  stars: number;
  forks: number;
  primaryLanguage: string | null;
  sizeKb: number;
  updatedAt: string;
}

export interface RepositoryFile {
  id: string;
  sha: string;
  name: string;
  path: string;
  extension: string;
  language: string;
  size: number;
  lines: number;
  complexity: number;
  codePreview: string | null;
  district: string;
  dependencies: string[];
  dependents: string[];
}

export interface DependencyEdge {
  source: string;
  target: string;
  specifier: string;
  type: "import" | "require" | "dynamic-import";
}

export interface CommitFileChange {
  path: string;
  status: "added" | "modified" | "removed" | "renamed" | "unknown";
  additions: number;
  deletions: number;
  changes: number;
}

export interface CommitInsight {
  sha: string;
  message: string;
  author: string;
  avatarUrl: string | null;
  date: string;
  htmlUrl: string;
  files: CommitFileChange[];
}

export interface PullRequestInsight {
  number: number;
  title: string;
  author: string;
  htmlUrl: string;
  draft: boolean;
  updatedAt: string;
  additions: number;
  deletions: number;
  changedFiles: number;
  files: CommitFileChange[];
}

export interface ContributorInsight {
  login: string;
  avatarUrl: string;
  htmlUrl: string;
  contributions: number;
}

export interface RepositoryInsights {
  commits: CommitInsight[];
  pullRequests: PullRequestInsight[];
  contributors: ContributorInsight[];
  ci: {
    status: string;
    conclusion: string | null;
    name: string;
    htmlUrl: string;
    updatedAt: string;
  } | null;
}

export interface AnalysisDiagnostics {
  totalTreeFiles: number;
  visibleFiles: number;
  sourceFilesAnalyzed: number;
  dependenciesFound: number;
  truncated: boolean;
  dependencyMode: "full" | "partial" | "structure-only";
}

export interface RepositoryAnalysis {
  repository: RepositoryMetadata;
  files: RepositoryFile[];
  edges: DependencyEdge[];
  districts: string[];
  diagnostics: AnalysisDiagnostics;
}
