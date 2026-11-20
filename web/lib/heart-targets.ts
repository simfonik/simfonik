// What a heart is given to (see lib/hearts.ts). A comment posted through the site goes by its id, here. One
// kept from the old site has no id and goes by what it is (lib/archived-target.ts, which only the server
// reads: it hashes, and the page in a browser must not be made to carry the means to).

/** A comment posted through the site, by its id. */
export const postedTarget = (id: number) => `c${id}`;
