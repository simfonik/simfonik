// The page's keys, registered with the SDK's shortcuts, and the list of them for the help popover.
import { shortcuts } from "@ui-sdk/react/shortcuts";

let listing = false;

/**
 * A shortcut's `when`: it stands aside while the keyboard's focus is somewhere the key already means
 * something (Space on a button presses it; an arrow on a slider moves it).
 *
 * The SDK asks the same question when it lists the shortcuts that can run now. The list is opened from a
 * button, so asked plainly, Space and M would never be on it. While the list is being read the answer is yes.
 */
export const awayFrom = (selector: string) => () => listing || !(document.activeElement as HTMLElement | null)?.closest(selector);

/** The page's shortcuts as the SDK has them, in the order given, each with its keys as this keyboard prints them. */
export function listKeys(order: string[]): { hint: string; description: string }[] {
  listing = true;
  try {
    const all = shortcuts.list();
    // The SDK draws the space bar as "␣", a sign no keyboard prints. It is named instead.
    return order.flatMap((keys) => all.filter((k) => k.keys === keys)).map((k) => ({ hint: k.keys === "space" ? "Space" : k.hint, description: k.description ?? "" }));
  } finally {
    listing = false;
  }
}
