import { describe, expect, it } from "vitest";

import { parseRepositoryUrl, RepositoryUrlError } from "@/lib/github/parse-repository-url";

describe("parseRepositoryUrl", () => {
  it("accepts the shorthand form", () => {
    expect(parseRepositoryUrl("vercel/next.js")).toEqual({ owner: "vercel", repo: "next.js" });
  });

  it("accepts full URLs with and without protocol", () => {
    expect(parseRepositoryUrl("https://github.com/vercel/next.js")).toEqual({
      owner: "vercel",
      repo: "next.js",
    });
    expect(parseRepositoryUrl("github.com/vercel/next.js")).toEqual({ owner: "vercel", repo: "next.js" });
    expect(parseRepositoryUrl("https://www.github.com/vercel/next.js")).toEqual({
      owner: "vercel",
      repo: "next.js",
    });
  });

  it("ignores deep links into the repository", () => {
    expect(parseRepositoryUrl("https://github.com/vercel/next.js/tree/canary/packages")).toEqual({
      owner: "vercel",
      repo: "next.js",
    });
    expect(parseRepositoryUrl("https://github.com/vercel/next.js/pull/1234")).toEqual({
      owner: "vercel",
      repo: "next.js",
    });
  });

  it("strips a trailing .git", () => {
    expect(parseRepositoryUrl("https://github.com/vercel/next.js.git").repo).toBe("next.js");
  });

  it("tolerates surrounding whitespace", () => {
    expect(parseRepositoryUrl("  vercel/next.js  ")).toEqual({ owner: "vercel", repo: "next.js" });
  });

  it("rejects other hosts", () => {
    expect(() => parseRepositoryUrl("https://gitlab.com/vercel/next.js")).toThrow(RepositoryUrlError);
    // A lookalike host must not pass as github.com.
    expect(() => parseRepositoryUrl("https://github.com.evil.test/vercel/next.js")).toThrow(
      RepositoryUrlError,
    );
  });

  it("rejects incomplete and malformed coordinates", () => {
    expect(() => parseRepositoryUrl("")).toThrow(RepositoryUrlError);
    expect(() => parseRepositoryUrl("https://github.com/vercel")).toThrow(RepositoryUrlError);
    expect(() => parseRepositoryUrl("-bad/repo")).toThrow(RepositoryUrlError);
    expect(() => parseRepositoryUrl("owner/re po")).toThrow(RepositoryUrlError);
  });
});
