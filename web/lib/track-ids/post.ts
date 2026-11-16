// What the tape page's ways of posting an ID share: the visitor's name, kept on this device, and the post
// itself. An ID is posted as an ordinary comment, through the same route as any comment. Browser only.

// A visitor's name is asked for once and offered back the next time, on this device only.
const NAME_KEY = 'simfonik:id-name';

export const rememberedName = () => {
  try {
    return window.localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
};

const FAILED = 'That didn’t post. Please try again.';

export { LONGEST_COMMENT } from './compose';

/**
 * Posts lines in the site's own form (compose.ts) as one comment under the visitor's name. Gives back
 * nothing when it posted, and otherwise what to tell the visitor.
 */
export async function postIds(tapeId: string, name: string, content: string): Promise<string | null> {
  try {
    const response = await fetch('/api/comments/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tapeId, authorName: name.trim(), authorEmail: '', content, website: '' }),
    });
    const data = await response.json();
    if (!response.ok) return data.error || FAILED;
  } catch {
    return FAILED;
  }
  try {
    window.localStorage.setItem(NAME_KEY, name.trim());
  } catch {
    // Storage is off in this browser: the name is asked for again next time.
  }
  return null;
}
