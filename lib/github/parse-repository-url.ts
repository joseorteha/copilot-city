export interface RepositoryCoordinates {
  owner: string;
  repo: string;
}

export class RepositoryUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RepositoryUrlError";
  }
}

const OWNER_PATTERN = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,38})$/;
const REPOSITORY_PATTERN = /^[a-zA-Z0-9._-]{1,100}$/;

export function parseRepositoryUrl(value: string): RepositoryCoordinates {
  const input = value.trim();
  if (!input) throw new RepositoryUrlError("Pega la URL de un repositorio público de GitHub.");

  let owner = "";
  let repo = "";

  if (/^[^/\s]+\/[^/\s]+$/.test(input)) {
    [owner, repo] = input.split("/");
  } else {
    let url: URL;

    try {
      url = new URL(input.startsWith("http") ? input : `https://${input}`);
    } catch {
      throw new RepositoryUrlError("La URL del repositorio no es válida.");
    }

    if (url.hostname !== "github.com" && url.hostname !== "www.github.com") {
      throw new RepositoryUrlError("Por ahora solo se admiten repositorios alojados en github.com.");
    }

    const segments = url.pathname.split("/").filter(Boolean);
    if (segments.length < 2) {
      throw new RepositoryUrlError("La URL debe incluir el propietario y el repositorio.");
    }

    [owner, repo] = segments;
  }

  repo = repo.replace(/\.git$/i, "");

  if (!OWNER_PATTERN.test(owner) || !REPOSITORY_PATTERN.test(repo)) {
    throw new RepositoryUrlError("El propietario o el nombre del repositorio no son válidos.");
  }

  return { owner, repo };
}
