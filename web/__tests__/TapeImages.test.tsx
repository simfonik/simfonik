import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach } from 'vitest';
import { TapeImages, widthInViewer, widthOnPage } from '../components/TapeImages';

const cover = { src: '/media/tapes/tape-1/cover.jpg', label: 'Tape 1 mixtape by DJ One', width: 1000, height: 2000 };
const sideA = { src: '/media/tapes/tape-1/sides/a.jpg', label: 'Tape 1 – Side A image', width: 1013, height: 641 };
const wide = { src: '/media/tapes/tape-2/cover.jpg', label: 'Tape 2 mixtape by DJ Two', width: 3000, height: 1000 };

describe('TapeImages', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  // The sizes are worked out here and handed to the browser as CSS, which this test's DOM doesn't lay out.
  it('holds a tall picture to its greatest height, and leaves a wide one to the width of its column', () => {
    // 460px tall at one wide to two tall is 230px wide.
    expect(widthOnPage(cover)).toBe(230);
    // Three wide to one tall would be 1380px at that height: far wider than any column, which is what holds it.
    expect(widthOnPage(wide)).toBe(1380);
  });

  it('shows an image in the viewer at half the size it was scanned at, and never wider than half the widest file there is of it', () => {
    expect(widthInViewer(cover)).toBe(500);
    expect(widthInViewer(sideA)).toBe(506.5);
    // A 3000px scan is served 1200px wide.
    expect(widthInViewer(wide)).toBe(600);
  });

  it('says how many images there are only when there is more than one', () => {
    const { rerender } = render(<TapeImages images={[cover, sideA]} />);
    expect(screen.getByText('2 images')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tape 1 mixtape by DJ One. View all 2 images larger' })).toBeInTheDocument();

    rerender(<TapeImages images={[cover]} />);
    expect(screen.queryByText(/images$/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tape 1 mixtape by DJ One. View it larger' })).toBeInTheDocument();
  });

  it('opens every image, with the keyboard on the way out', async () => {
    const user = userEvent.setup();
    render(<TapeImages images={[cover, sideA, wide]} />);
    expect(document.querySelector('dialog')).toBeNull();

    await user.click(screen.getByRole('button', { name: /View all 3 images larger/ }));
    const dialog = document.querySelector('dialog')!;
    expect(dialog.open).toBe(true);
    expect(dialog.querySelectorAll('.image-viewer-picture')).toHaveLength(3);
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close' }));
  });

  it('is gone again once it is shut', async () => {
    const user = userEvent.setup();
    render(<TapeImages images={[cover, sideA]} />);
    await user.click(screen.getByRole('button', { name: /View all 2 images larger/ }));
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(document.querySelector('dialog')).toBeNull();
  });
});
