import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { CommentBody, splitDiscogsLinks } from '@/components/CommentBody';

describe('splitDiscogsLinks', () => {
  it('leaves plain text as a single run', () => {
    expect(splitDiscogsLinks('great mix')).toEqual([{ type: 'text', content: 'great mix' }]);
  });

  it('splits Discogs links out of surrounding text', () => {
    expect(splitDiscogsLinks('see https://www.discogs.com/release/1 and https://discogs.com/artist/2!')).toEqual([
      { type: 'text', content: 'see ' },
      { type: 'link', content: 'https://www.discogs.com/release/1' },
      { type: 'text', content: ' and ' },
      { type: 'link', content: 'https://discogs.com/artist/2!' },
    ]);
  });
});

describe('CommentBody', () => {
  it('renders Discogs links as anchors', () => {
    const { container } = render(<CommentBody content="track id: https://www.discogs.com/release/1" />);
    const a = container.querySelector('a');
    expect(a?.getAttribute('href')).toBe('https://www.discogs.com/release/1');
    expect(a?.getAttribute('rel')).toContain('noopener');
  });

  it('renders markup in comment text literally', () => {
    const { container } = render(<CommentBody content={'<img src=x onerror="alert(1)"> hi'} />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toBe('<img src=x onerror="alert(1)"> hi');
  });

  it('does not let a crafted Discogs URL inject attributes', () => {
    const payload = 'https://www.discogs.com/a"onmouseover="alert(1)"style="position:fixed;inset:0';
    const { container } = render(<CommentBody content={payload} />);
    expect(container.querySelectorAll('[onmouseover],[style]')).toHaveLength(0);
    expect(container.querySelector('a')?.getAttribute('href')).toBe('https://www.discogs.com/a');
    expect(container.textContent).toBe(payload);
  });
});
