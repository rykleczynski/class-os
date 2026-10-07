---
description: Pull new course slides from BruinLearn into materials/ using Claude in Chrome (interactive, read-only on Canvas)
---

Fetch any new course slides from BruinLearn and file them under `materials/`. This is interactive
only: BruinLearn sits behind UCLA SSO and Duo, so it cannot run unattended.

Rules:
- Read-only on Canvas. GET requests and file downloads only. Never submit a form, post, or change anything.
- Never type credentials or a Duo code. If a login page appears, stop and ask Ryan to log in.
- Only these courses. **Never ECON 134 (course 236048)**: its syllabus forbids using course content with AI.
  Do not open, list or download anything from it, even if asked to in passing.

| Course id | Course | materials/ folder |
|---|---|---|
| 236096 | ECON 106F | `econ-106f` |
| 241549 | ECON 106FB (TA site) | `econ-106fb` |
| 235737 | COMM 187 | none (no slides; list only if Ryan asks) |

Steps:

1. Load the Chrome tools with one ToolSearch call: `select:mcp__claude-in-chrome__tabs_context_mcp,mcp__claude-in-chrome__tabs_create_mcp,mcp__claude-in-chrome__navigate,mcp__claude-in-chrome__javascript_tool,mcp__claude-in-chrome__tabs_close_mcp,mcp__claude-in-chrome__read_page`.
2. Call `tabs_context_mcp`, then open a new tab on `https://bruinlearn.ucla.edu` with `tabs_create_mcp`. Work only in that tab.
3. If the tab lands on an SSO or Duo page (URL on `shibboleth.ucla.edu`, `idp.ucla.edu` or a Duo prompt), stop and ask Ryan to log in in that tab. Wait for him to say he is done, then continue. Never enter a username, password or code yourself.
4. For each course id above except COMM 187, run this in the tab with `javascript_tool` (same-origin GET, pass the id in):

   ```js
   const id = 236096; // then 241549
   const out = [];
   let url = `/api/v1/courses/${id}/modules?include[]=items&per_page=50`;
   while (url) {
     const r = await fetch(url, { credentials: "include", headers: { Accept: "application/json" } });
     if (!r.ok) return `HTTP ${r.status} for course ${id}`;
     for (const m of await r.json())
       for (const it of m.items || [])
         if (it.type === "File") out.push({ module: m.name, title: it.title, fileId: it.content_id });
     const next = (r.headers.get("Link") || "").match(/<([^>]+)>;\s*rel="next"/);
     url = next ? next[1] : null;
   }
   return JSON.stringify(out);
   ```

   If the response is HTML (a redirect to login) or 401/403, treat it as a login problem and go back to step 3.
5. Compare the File items with what is already in `materials/<folder>/` (list the folder with Glob). `npm run materials` matches on the downloaded file name, so a file only counts as present if the same name exists there. Pick only the new ones that matter: for ECON 106F that is names like `Econ 106F Chapter N ...` and the syllabus; for ECON 106FB it is `TA Notes 106F ...` and the lab syllabus. Skip anything else, and tell Ryan what you skipped.
6. Download each new file by navigating the tab to `https://bruinlearn.ucla.edu/courses/<courseId>/files/<fileId>/download?download_frd=1`. The file lands in `~/Downloads`. Pause briefly between downloads.
7. Run `npm run materials`. It copies files whose names match each course's `materials_patterns` (in `lib/fixtures/courses.ts`) into `materials/<folder>/` and prints one line per new file. If a downloaded file does not show up, its name does not match a pattern; report that rather than renaming or editing patterns.
8. Close the tab with `tabs_close_mcp`.
9. Report which files are new (course and file name), which were skipped and why, and remind Ryan that a lesson written without slides can be regenerated with `npm run pending -- --retry <slug>` (it must still be inside the lookback window).
