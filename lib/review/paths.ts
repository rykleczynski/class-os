import { join } from "node:path";

/**
 * Root of the gitignored content/ directory. CLASSOS_CONTENT_DIR overrides it so a worktree can read the
 * main checkout's generated content without copying it.
 */
export const contentRoot = (repoRoot = process.cwd()) => process.env.CLASSOS_CONTENT_DIR || join(repoRoot, "content");

export const reviewsRoot = (repoRoot = process.cwd()) => join(contentRoot(repoRoot), "reviews");
