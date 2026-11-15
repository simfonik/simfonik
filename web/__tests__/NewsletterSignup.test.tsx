import React from 'react';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NewsletterInline, useNewsletterForm } from '../components/NewsletterSignup';

// The header holds the form's state and hands it to the sign-up; this stands in for the header.
function Signup() {
  const form = useNewsletterForm();
  return <NewsletterInline form={form} />;
}

const answer = (status: number, body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));

describe('the newsletter sign-up', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    document.body.innerHTML = '';
    fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const field = () => screen.getByRole('textbox', { name: 'Email address' });
  const button = () => screen.getByRole('button', { name: /subscribe/i });

  it('answers an empty or malformed address itself, on its own line, without asking the server', async () => {
    const user = userEvent.setup();
    render(<Signup />);

    await user.click(button());
    expect(screen.getByRole('alert')).toHaveTextContent('Enter your email address.');
    expect(field()).toHaveFocus();
    expect(field()).toHaveAttribute('aria-invalid', 'true');

    await user.type(field(), 'foo');
    await user.click(button());
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid email address.');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('says what the server said, gives the field back, and drops the complaint once the address is changed', async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation(() => answer(400, { error: 'Invalid email address.' }));
    render(<Signup />);

    await user.type(field(), 'someone@example.com');
    await user.click(button());

    expect(screen.getByRole('alert')).toHaveTextContent('Invalid email address.');
    expect(field()).toHaveFocus();
    expect(field()).toHaveValue('someone@example.com');

    await user.type(field(), 'x');
    expect(screen.getByRole('alert')).toBeEmptyDOMElement();
    expect(field()).toHaveAttribute('aria-invalid', 'false');
  });

  it('keeps the button in place while sending, and sends once however often it is pressed', async () => {
    const user = userEvent.setup();
    let finish: (response: Response) => void = () => {};
    fetchMock.mockImplementation(() => new Promise<Response>((resolve) => { finish = resolve; }));
    render(<Signup />);

    await user.type(field(), '  someone@example.com ');
    await user.click(button());

    // Marked disabled, not made so: it still has the keyboard.
    expect(button()).toHaveAttribute('aria-disabled', 'true');
    expect(button()).not.toBeDisabled();
    expect(button()).toHaveFocus();

    await user.click(button());
    await user.type(field(), '{Enter}');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ email: 'someone@example.com' });

    await act(async () => {
      finish(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    });
  });

  it('puts the thanks where a screen reader is already listening, and the keyboard on it', async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation(() => answer(200, { ok: true }));
    render(<Signup />);

    // The place for the thanks is there from the start, empty.
    const thanks = screen.getByRole('status');
    expect(thanks).toBeEmptyDOMElement();

    await user.type(field(), 'someone@example.com');
    await user.click(button());

    expect(thanks).toHaveTextContent('You’re subscribed.');
    expect(thanks).toHaveFocus();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });
});
