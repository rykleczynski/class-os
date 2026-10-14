/** localStorage keys for lesson progress. A plain module, so server components can compute them too. */
export const OWNER_PROGRESS_KEY = "classos:progress:v1";

/** Guests keep progress in their own namespace, one key per shared course, apart from the owner's. */
export const guestProgressKey = (courseSlug: string) => `classos:guest:${courseSlug}`;
