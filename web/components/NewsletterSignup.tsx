'use client';

import { useState, useLayoutEffect, useRef, FormEvent, Ref, useCallback } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

export function useNewsletterForm() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus('loading');
    setErrorMessage('');

    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus('error');
        setErrorMessage(data.error || 'Something went wrong.');
        return;
      }

      setStatus('success');
      setEmail('');
    } catch {
      setStatus('error');
      setErrorMessage('Something went wrong. Please try again.');
    }
  }

  return { email, setEmail, status, errorMessage, handleSubmit };
}

type NewsletterFormState = ReturnType<typeof useNewsletterForm>;

/**
 * The email field, the Subscribe button and the line that says what went wrong: the same wherever the sign-up
 * appears. `className` lays the field and button out for the place; the line's room is always kept, so
 * nothing moves when it has something to say.
 */
function NewsletterForm({
  form,
  className,
  messageClassName = 'text-center',
  fieldRef,
}: {
  form: NewsletterFormState;
  className: string;
  messageClassName?: string;
  fieldRef?: Ref<HTMLInputElement>;
}) {
  const { email, setEmail, status, errorMessage, handleSubmit } = form;
  return (
    <>
      <form onSubmit={handleSubmit} className={className}>
        <input
          type="email"
          placeholder="you@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          ref={fieldRef}
          aria-label="Email address"
          autoComplete="email"
          className="text-field font-mono h-11 w-full min-w-0 sm:flex-1 border-[1.5px] border-[var(--text)] bg-[var(--bg)] px-4 text-sm text-[var(--text)] placeholder:text-[var(--muted)]"
        />
        <button type="submit" disabled={status === 'loading'} className="poster-btn h-11 whitespace-nowrap">
          {status === 'loading' ? 'Subscribing\u2026' : 'Subscribe'}
        </button>
      </form>
      <p
        className={`mt-3 font-mono text-[10px] uppercase tracking-[0.18em] h-4 transition-opacity ${messageClassName} ${status === 'error' ? 'text-red-500 opacity-100' : 'opacity-0'}`}
      >
        {errorMessage || '\u00A0'}
      </p>
    </>
  );
}

export function NewsletterModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const form = useNewsletterForm();
  const { status } = form;
  const dialog = useRef<HTMLDialogElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const pressedOutside = useRef(false);

  // The browser's own modal dialog: it keeps Tab inside, makes the page behind unreachable, closes on Escape
  // and hands the keyboard back to whatever opened it. It is opened in a layout effect so that the field
  // takes focus inside the press that asked for the window, which is what lets a phone bring its keyboard up.
  useLayoutEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
      field.current?.focus();
    } else if (!open && el.open) {
      el.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialog}
      className="newsletter-dialog"
      aria-labelledby="newsletter-dialog-title"
      onClose={onClose}
      // A press on the dimmed surround closes the window: one that both began and ended there, so dragging
      // out of the field while selecting its text doesn't.
      onPointerDown={(e) => {
        pressedOutside.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (pressedOutside.current && e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative bg-[var(--bg)] border-[1.5px] border-[var(--text)] w-full max-w-2xl p-8 sm:p-10">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-1 right-1 text-[var(--muted)] hover:text-[var(--text)] transition-colors cursor-pointer p-3"
          aria-label="Close"
        >
          <XMarkIcon className="w-5 h-5" />
        </button>

        {status === 'success' ? (
          <div className="text-center py-2">
            <p id="newsletter-dialog-title" className="font-display text-3xl sm:text-4xl leading-[0.95] text-[var(--text)] mb-3">
              You&apos;re now subscribed!
            </p>
            <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-[var(--muted)]">
              We&apos;ll let you know when new tapes are added
            </p>
          </div>
        ) : (
          <>
            <h2 id="newsletter-dialog-title" className="font-display text-3xl sm:text-4xl leading-[0.95] text-[var(--text)] mb-3">
              Get notified when new tapes drop.
            </h2>
            <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-[var(--muted)] mb-6">
              No spam. Just new recordings added to the archive.
            </p>
            <NewsletterForm form={form} fieldRef={field} className="flex flex-col sm:flex-row items-stretch gap-3" />
          </>
        )}
      </div>
    </dialog>
  );
}

export function NewsletterFooter() {
  const form = useNewsletterForm();

  if (form.status === 'success') {
    return (
      <div className="text-center">
        <p className="font-display text-3xl sm:text-4xl leading-[0.95] text-[var(--text)] mb-3">You&apos;re now subscribed!</p>
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-[var(--muted)]">
          We&apos;ll let you know when new tapes are added
        </p>
      </div>
    );
  }

  return (
    <div className="text-center">
      <h3 className="font-display text-3xl sm:text-4xl lg:text-5xl leading-[0.95] text-[var(--text)] mb-3">
        Get notified when new tapes drop.
      </h3>
      <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-[var(--muted)] mb-8">
        No spam. Just new recordings added to the archive.
      </p>
      <NewsletterForm form={form} className="flex flex-col sm:flex-row items-stretch gap-3 max-w-md mx-auto" />
    </div>
  );
}

/**
 * The sign-up as the last part of the phone menu: one line of caption, then the field and the button side by
 * side. The header holds its state, so what was typed, or the thanks, is still there if the menu is shut and
 * opened again.
 */
export function NewsletterMenu({ form }: { form: NewsletterFormState }) {
  if (form.status === 'success') {
    return (
      <p role="status" className="font-mono text-[11px] uppercase leading-relaxed tracking-[0.2em] text-[var(--text)]">
        You&apos;re subscribed. We&apos;ll let you know when new tapes are added.
      </p>
    );
  }

  return (
    <>
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--muted)] mb-3">
        Get notified when new tapes drop
      </p>
      <NewsletterForm form={form} className="flex items-stretch gap-3" messageClassName="text-left" />
    </>
  );
}

export function useNewsletterModal() {
  const [open, setOpen] = useState(false);
  const onClose = useCallback(() => setOpen(false), []);
  const onOpen = useCallback(() => setOpen(true), []);
  return { open, onOpen, onClose };
}
