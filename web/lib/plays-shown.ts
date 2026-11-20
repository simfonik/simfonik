/**
 * Whether tape pages show a mix's plays (lib/plays.ts, components/TapeStats.tsx).
 *
 * Off since 20 November 2026, at Jason's word, to be looked at again (SIM-63): mixes added since the relaunch
 * showed no number until they had a hundred plays, and he would rather show none than some. Every play is
 * still saved, and the starts in data/play-starts.json are kept. While this is off the plays are not counted
 * up either, so the database is not woken for a number nobody sees.
 */
export const PLAYS_SHOWN: boolean = false;
