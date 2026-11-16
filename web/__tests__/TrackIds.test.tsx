// The blanks an ID is typed into, the sheet they are on a phone, and the tray: how they open, what they ask
// for, what they refuse and where the keyboard goes. What an ID does to the page once it is made is in
// TrackIdStates.test.tsx.
import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { old, tapePage } from './tape';

const artist = () => screen.getByRole('textbox', { name: 'Artist' });
const title = () => screen.getByRole('textbox', { name: 'Title' });
const yourName = () => screen.getByRole('textbox', { name: 'Your name' });
const ASK = 'Know this track? ID it';
const KNOWN = [{ by: 'Josh', says: '[0:00] Orbital - Chime' }];
// Ten tracks on a side of 40 minutes.
const TEN = ['Orbital - Chime', 'Moby - Go', 'Joey Beltram - Energy Flash', 'LFO - LFO', 'Altern 8 - Infiltrate 202', 'The Prodigy - Charly', 'SL2 - DJs Take Control', 'Bizarre Inc - Playing With Knives', 'Rhythm Section - Feel The Rhythm', 'Shut Up And Dance - Raving'];
const LISTED = [{ position: 'A', tracks: TEN.map((name) => ({ artist: name.split(' - ')[0], title: name.split(' - ')[1] })) }];

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the blanks, in the line under the player', () => {
  it('ask a first-time visitor’s name as a second step, post under it at the moment they were opened, and don’t ask again', async () => {
    const page = tapePage({ sides: [{ position: 'A' }, { position: 'B' }], name: null });
    await page.read();
    await page.at(754.6, { side: 1 });
    await page.user.click(page.button(ASK));
    expect(artist()).toHaveFocus();
    // The tape plays on; the blanks stay on the moment they were opened for.
    await page.at(790, { side: 1 });
    await page.user.type(artist(), '808 State');
    await page.user.type(title(), 'Cubik{Enter}');

    // Nothing is posted yet: the line now asks who is saying so.
    expect(page.posts()).toEqual([]);
    expect(yourName()).toHaveFocus();
    expect(screen.queryByRole('textbox', { name: 'Artist' })).not.toBeInTheDocument();
    await page.user.type(yourName(), 'Dana{Enter}');
    await waitFor(() => expect(page.posts()).toEqual(['[B 12:34] 808 State - Cubik']));
    await waitFor(() => expect(screen.queryByRole('form', { name: /^ID the track/ })).not.toBeInTheDocument());
    expect(window.localStorage.getItem('simfonik:id-name')).toBe('Dana');
    expect(screen.getAllByRole('status')[0]).toHaveTextContent('Posted. Thanks.');

    await page.at(900, { side: 1 });
    await page.user.click(page.button(/^New ID/));
    await page.user.type(artist(), 'LFO');
    await page.user.type(title(), 'LFO{Enter}');
    await waitFor(() => expect(page.posts()).toHaveLength(2));
  });

  it('start from what a known ID says, and from nothing for a new one or a spot with no name', async () => {
    const page = tapePage({ posted: [...KNOWN, { by: 'Josh', says: '[5:00] ? - ?' }] });
    await page.read();
    await page.at(60);
    await page.user.click(page.button('Now playing: Orbital — Chime. Correct this ID'));
    expect(artist()).toHaveValue('Orbital');
    expect(title()).toHaveValue('Chime');
    await page.user.keyboard('{Escape}');

    await page.user.click(page.button(/^New ID/));
    expect(artist()).toHaveValue('');
    await page.user.keyboard('{Escape}');

    await page.at(320);
    await page.user.click(page.button('Unknown track. Know it? ID it'));
    expect(artist()).toHaveValue('');
  });

  it('ask for what is missing on a line of its own, drop the complaint once it is being put right, and shut on Escape with the keyboard back on the line', async () => {
    const page = tapePage({ name: null });
    await page.read();
    await page.at(200);
    await page.user.click(page.button(ASK));
    await page.user.click(page.button(/post/i));
    expect(screen.getByRole('alert')).toHaveTextContent('Enter the artist or the title.');
    expect(artist()).toHaveFocus();

    await page.user.type(artist(), 'Moby');
    expect(screen.getByRole('alert')).toBeEmptyDOMElement();
    await page.user.keyboard('{Enter}');
    await page.user.keyboard('{Enter}');
    expect(screen.getByRole('alert')).toHaveTextContent('Enter your name.');
    expect(yourName()).toHaveFocus();
    expect(page.posts()).toEqual([]);

    await page.user.keyboard('{Escape}');
    expect(screen.queryByRole('form', { name: /^ID the track/ })).not.toBeInTheDocument();
    expect(page.button(ASK)).toHaveFocus();
  });

  it('say what the server said when it refuses, and keep what was typed', async () => {
    const page = tapePage();
    await page.read();
    await page.at(200);
    page.server.refuse = 'Too many requests. Please try again later.';
    await page.user.click(page.button(ASK));
    await page.user.type(artist(), 'Moby');
    await page.user.type(title(), 'Go{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent('Too many requests. Please try again later.');
    expect(artist()).toHaveValue('Moby');
    expect(artist()).toHaveFocus();
    expect(page.rows()).toEqual([]);
  });

  it('ask a first-time visitor’s name before taking a mark away, in a step whose one button says what it will do', async () => {
    const page = tapePage({ posted: KNOWN, name: null });
    await page.read();
    await page.at(60);
    await page.user.click(page.button('Now playing: Orbital — Chime. Correct this ID'));
    await page.user.click(page.button('Remove this ID'));
    expect(page.posts()).toEqual([]);
    expect(yourName()).toHaveFocus();
    const blanks = screen.getByRole('form', { name: 'ID the track at 0:00:00' });
    expect(within(blanks).getByRole('button', { name: /^Remove/ })).toBeInTheDocument();
    expect(within(blanks).queryByRole('button', { name: /post/i })).not.toBeInTheDocument();
    await page.user.type(yourName(), 'Dana{Enter}');
    await waitFor(() => expect(page.posts()).toEqual(['[0:00] no track starts here']));
  });

  it('offer no move in a track’s first moments, or to a moment another track starts within a moment of', async () => {
    const page = tapePage({ posted: [...KNOWN, { by: 'Josh', says: '[5:00] LFO - LFO' }] });
    await page.read();
    await page.at(3);
    await page.user.click(page.button('Now playing: Orbital — Chime. Correct this ID'));
    expect(page.has(/instead$/)).toBe(false);
    await page.user.keyboard('{Escape}');
    await page.at(297);
    await page.user.click(page.button('Now playing: Orbital — Chime. Correct this ID'));
    expect(page.has(/instead$/)).toBe(false);
    await page.user.keyboard('{Escape}');
    await page.at(100);
    await page.user.click(page.button('Now playing: Orbital — Chime. Correct this ID'));
    expect(page.has('Starts at 0:01:40 instead')).toBe(true);
  });

  describe('on a side with a list of its tracks', () => {
    it('offer the two lines likeliest to be the track, and write the one pressed into the blanks', async () => {
      const page = tapePage({ sides: LISTED, length: 2400 });
      await page.read();
      // Half way through the side is where the sixth track would start.
      await page.at(1200);
      await page.user.click(page.button(ASK));
      const offers = screen.getByRole('group', { name: 'From the tape’s tracklist' });
      expect(within(offers).getAllByRole('button').map((b) => b.textContent)).toEqual(['5Altern 8 — Infiltrate 202', '6The Prodigy — Charly']);
      await page.user.click(within(offers).getByRole('button', { name: /Charly/ }));
      expect(artist()).toHaveValue('The Prodigy');
      expect(title()).toHaveValue('Charly');
      await page.user.click(within(screen.getByRole('form', { name: 'ID the track at 0:20:00' })).getByRole('button', { name: /post/i }));
      await waitFor(() => expect(page.posts()).toEqual(['[20:00] The Prodigy - Charly']));
      await waitFor(() => expect(page.rows()[5]).toBe('0:20:00The Prodigy — Charly'));
    });

    it('offer none for an ID being put right, and say whose list it is where a visitor kept it', async () => {
      const page = tapePage({ archive: [old('Side 1\n1. Orbital - Chime\n2. Moby - Go\n3. LFO - LFO', 'Josh')], posted: KNOWN });
      await page.read();
      await page.at(60);
      await page.user.click(page.button('Now playing: Orbital — Chime. Correct this ID'));
      expect(screen.queryByRole('group', { name: /^From/ })).not.toBeInTheDocument();
      await page.user.keyboard('{Escape}');
      // Past the ten minutes the track before is taken to play.
      await page.at(700);
      await page.user.click(page.button(ASK));
      expect(within(screen.getByRole('group', { name: 'From Josh’s list' })).getAllByRole('button')).toHaveLength(2);
    });
  });

  it('open for a row of the tracklist when the tracklist asks, once the player has loaded the side the row is on', async () => {
    const page = tapePage({ sides: [{ position: 'A' }, { position: 'B' }], posted: [{ by: 'Josh', says: '[B 5:00] ? - ?' }] });
    await page.read();
    await page.at(12);
    await page.user.click(page.button('ID the unknown track at B 0:05:00'));
    expect(page.went).toHaveBeenCalledWith('B', 300);
    // The blanks belong to the side loaded. Side A's are not the ones asked for.
    expect(screen.queryByRole('form', { name: /^ID the track/ })).not.toBeInTheDocument();
    await page.at(300, { side: 1 });
    expect(await screen.findByRole('form', { name: 'ID the track at B 0:05:00' })).toBeInTheDocument();
    expect(page.has('Remove this mark')).toBe(true);
  });
});

describe('the sheet, on a phone', () => {
  it('takes the ID over the page, asks a first-time visitor’s name in the same sheet, and posts', async () => {
    const page = tapePage({ phone: true, name: null });
    await page.read();
    await page.at(200);
    await page.user.click(within(page.tray() as HTMLElement).getByRole('button', { name: 'ID it' }));
    const sheet = screen.getByRole('dialog', { name: 'ID the track at 0:03:20' });
    expect(within(sheet).getByRole('textbox', { name: 'Artist' })).toHaveFocus();
    expect(within(sheet).getByRole('textbox', { name: 'Your name' })).toBeInTheDocument();

    // The keyboard's Next key goes on to the next blank, and doesn't post half an ID.
    await page.user.type(within(sheet).getByRole('textbox', { name: 'Artist' }), 'Moby{Enter}');
    expect(within(sheet).getByRole('textbox', { name: 'Title' })).toHaveFocus();
    await page.user.type(within(sheet).getByRole('textbox', { name: 'Title' }), 'Go{Enter}');
    expect(within(sheet).getByRole('textbox', { name: 'Your name' })).toHaveFocus();
    expect(page.posts()).toEqual([]);
    await page.user.type(within(sheet).getByRole('textbox', { name: 'Your name' }), 'Dana{Enter}');
    await waitFor(() => expect(page.posts()).toEqual(['[3:20] Moby - Go']));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('says who a returning visitor is posting as, and lets them change it', async () => {
    const page = tapePage({ phone: true });
    await page.read();
    await page.at(200);
    await page.user.click(within(page.tray() as HTMLElement).getByRole('button', { name: 'ID it' }));
    const sheet = screen.getByRole('dialog');
    expect(sheet).toHaveTextContent('Posting as Dana');
    expect(within(sheet).queryByRole('textbox', { name: 'Your name' })).not.toBeInTheDocument();
    await page.user.click(within(sheet).getByRole('button', { name: 'Change' }));
    expect(within(sheet).getByRole('textbox', { name: 'Your name' })).toHaveFocus();
  });

  it('offers the list’s likeliest lines first, and has what can be done with a mark below the blanks', async () => {
    const page = tapePage({ sides: LISTED, length: 2400, phone: true, posted: [{ by: 'Josh', says: '[0:00] Orbital - Chime' }] });
    await page.read();
    await page.at(1200);
    await page.user.click(within(page.tray() as HTMLElement).getByRole('button', { name: 'ID it' }));
    expect(within(within(screen.getByRole('dialog')).getByRole('group', { name: 'From the tape’s tracklist' })).getAllByRole('button')).toHaveLength(2);
    await page.user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await page.at(100);
    await page.user.click(within(page.tray() as HTMLElement).getByRole('button', { name: 'Edit ID' }));
    const sheet = screen.getByRole('dialog', { name: 'ID the track at 0:00:00' });
    expect(within(sheet).getByRole('button', { name: 'Remove this ID' })).toBeInTheDocument();
    expect(within(sheet).getByRole('button', { name: 'Starts at 0:01:40 instead' })).toBeInTheDocument();
  });
});

describe('the tray, on a phone', () => {
  it('is not there before the tape is played, nor on a wide screen, and stays once the tape has been played', async () => {
    const wide = tapePage({ posted: KNOWN });
    await wide.read();
    await wide.at(60);
    expect(wide.tray()).toBeNull();
    wide.unmount();

    const page = tapePage({ posted: KNOWN, phone: true });
    await page.read();
    expect(page.tray()).toBeNull();
    await page.at(60.4);
    expect(page.tray()).toHaveTextContent('Orbital0:01:00Chime');
    // Paused and back at its start, the tape is still one the visitor is listening to.
    await page.at(0, { played: false });
    expect(page.tray()).not.toBeNull();
  });

  it('plays and pauses, and opens the sheet for the track playing, with the keyboard back on its button after', async () => {
    const page = tapePage({ posted: KNOWN, phone: true });
    await page.read();
    await page.at(60);
    const tray = () => page.tray() as HTMLElement;
    await page.user.click(within(tray()).getByRole('button', { name: 'Pause' }));
    expect(page.toggled).toHaveBeenCalledTimes(1);
    await page.at(60, { played: false });
    expect(within(tray()).getByRole('button', { name: 'Play' })).toBeInTheDocument();

    await page.user.click(within(tray()).getByRole('button', { name: 'Edit ID' }));
    const sheet = screen.getByRole('dialog', { name: 'ID the track at 0:00:00' });
    expect(within(sheet).getByRole('textbox', { name: 'Artist' })).toHaveValue('Orbital');
    await page.user.click(within(sheet).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(within(tray()).getByRole('button', { name: 'Edit ID' })).toHaveFocus();
  });

  it('keeps New track in its place, marked unavailable within a moment of a track’s start', async () => {
    const page = tapePage({ posted: KNOWN, phone: true });
    await page.read();
    await page.at(3);
    const unknown = () => within(page.tray() as HTMLElement).getByRole('button', { name: /^New track/ });
    expect(unknown()).toHaveAttribute('aria-disabled', 'true');
    await page.user.click(unknown());
    expect(page.shared().unposted).toEqual([]);
    await page.at(200);
    expect(unknown()).toHaveAttribute('aria-disabled', 'false');
  });
});
