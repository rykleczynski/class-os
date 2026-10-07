# Class OS Lesson Generator Routine

This routine processes Wispr Flow lecture transcripts into Lesson JSON and inserts them into Supabase.

## Procedure

### 1. Validate environment

Read `SUPABASE_URL` and `SUPABASE_SECRET_KEY` from environment variables.
- If either is missing, exit with error: "SUPABASE_URL and SUPABASE_SECRET_KEY must be set"
- Never print the secret key.

### 2. Find unprocessed Wispr meetings

Call Wispr-Flow MCP `search_meetings` to list meetings from the last 48 hours with:
- `finalized: true` (transcripts are locked)
- `has_transcript: true` (must have a transcript)
- Sort by `created_at` descending

Response includes `id` (wispr_meeting_id), `title`, `folder`, `starts_at`, `ends_at`, `duration_seconds`.

### 3. Check for duplicates

For each meeting, call Supabase POST `/rest/v1/lectures?select=wispr_meeting_id`:

```bash
curl -s -X GET "$SUPABASE_URL/rest/v1/lectures?select=wispr_meeting_id&wispr_meeting_id=eq.$WISPR_ID" \
  -H "apikey: $SUPABASE_SECRET_KEY" \
  -H "Authorization: Bearer $SUPABASE_SECRET_KEY"
```

If the response is non-empty (already processed), skip this meeting.

### 4. Match meeting to a course

Matching order:
1. **Wispr folder name**: The folder field from the meeting matches a course `aliases` entry (case-insensitive, trim whitespace).
   - Example: folder "Econ 106F" matches course with aliases `['Econ 106F', 'Econ 106F Lecture', 'ECON 106F Finance']`
2. **Title vs aliases**: If no folder match, check if the meeting title contains or closely matches any course alias.
3. **No match**: If no match found, insert the lecture with `status: 'unmatched'` and continue to the next meeting.

Course lookup (read-only):

```bash
curl -s -X GET "$SUPABASE_URL/rest/v1/courses?select=id,code,slug,aliases,generation_notes,term" \
  -H "apikey: $SUPABASE_SECRET_KEY" \
  -H "Authorization: Bearer $SUPABASE_SECRET_KEY"
```

Assume `term = 'Fall 2026'` for all current meetings.

### 5. Pull transcript and generate Lesson JSON

Call Wispr-Flow MCP `get_meeting` with `view_transcript: true` to fetch the full transcript.

Use Claude (via standard tool-use, not the Wispr-Flow MCP) to:
- Summarize the lecture into 3-7 steps (target 4-6)
- Each step: one title, 1-2 visual/interactive blocks (chart, slider, scenario, timeline, etc.), paired with prose under 120 words
- Include a 5-question quiz (mcq blocks), flashcards (3-12), and concepts (1+)
- Validate the structure against `lib/lesson/schema.ts`

Add 1-2 current-events tie-ins via WebSearch, cited in `inTheNews` blocks.

Model on fixture lessons in `lib/fixtures/lessons/`:
- Structure: `{ schema_version, title, hook, est_minutes, objectives, recap, steps, quiz, flashcards, concepts }`
- 3-7 steps, 5-question quiz, 3-12 flashcards
- Each step has blocks with types: prose, keyIdea, chart, slider, supplyDemand, timeline, compare, stepper, flip, mcq, sortOrMatch, scenario, inTheNews, custom

Reference `lib/lesson/schema.ts` for exact block and lesson contract.

Lesson ID: `{course-slug}-class{n}` where `n` is derived from `lectures.count() + 1` for that course (e.g., `econ106f-class4`).

### 6. Validate the JSON locally

Run (once per routine run):

```bash
npm ci --prefer-offline
npm run validate <path-to-lesson.json>
```

If validation fails, fix the JSON and retry validation until it passes.

### 7. Insert into Supabase

On successful validation, insert in three calls:

#### a. Insert lecture

```bash
curl -s -X POST "$SUPABASE_URL/rest/v1/lectures" \
  -H "apikey: $SUPABASE_SECRET_KEY" \
  -H "Authorization: Bearer $SUPABASE_SECRET_KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{
    "course_id": <course-id>,
    "wispr_meeting_id": "<wispr_id>",
    "starts_at": "<iso-timestamp>",
    "wispr_share_link": "<url>",
    "transcript": "<full-text>",
    "status": "generated"
  }'
```

Capture the returned `id` (lecture_id).

#### b. Insert lesson

```bash
curl -s -X POST "$SUPABASE_URL/rest/v1/lessons" \
  -H "apikey: $SUPABASE_SECRET_KEY" \
  -H "Authorization: Bearer $SUPABASE_SECRET_KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{
    "lecture_id": <lecture-id>,
    "lesson_id": "<lesson-slug>",
    "content": <lesson-json-object>
  }'
```

#### c. Insert concepts

For each concept in `lesson.concepts`:

```bash
curl -s -X POST "$SUPABASE_URL/rest/v1/concepts" \
  -H "apikey: $SUPABASE_SECRET_KEY" \
  -H "Authorization: Bearer $SUPABASE_SECRET_KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{
    "lesson_id": "<lesson-slug>",
    "term": "<concept-term>"
  }'
```

### 8. Error handling

If any insert fails, update the lecture status to `'failed'`:

```bash
curl -s -X PATCH "$SUPABASE_URL/rest/v1/lectures?id=eq.$LECTURE_ID" \
  -H "apikey: $SUPABASE_SECRET_KEY" \
  -H "Authorization: Bearer $SUPABASE_SECRET_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "status": "failed" }'
```

Log the error and continue to the next meeting.

### 9. Exit

If no new meetings were processed, exit silently. Otherwise, report:
- Count of meetings processed
- Count of successful inserts
- Any unmatched or failed meetings
