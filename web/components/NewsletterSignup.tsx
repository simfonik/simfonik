'use client';

import { useEffect, useId, useRef, useState, FormEvent, ReactNode } from 'react';

// The same test the server makes (app/api/newsletter/route.ts), so the two never disagree about an address.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function useNewsletterForm() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const fieldRef = useRef<HTMLInputElement>(null);

  // What went wrong is said on the form's own line, and the field takes the keyboard back to be put right.
  function refuse(message: string) {
    setStatus('error');
    setErrorMessage(message);
    fieldRef.current?.focus();
  }

  // The complaint goes as soon as the address is being changed: it was about what was there before.
  function change(value: string) {
    setEmail(value);
    if (status === 'error') {
      setStatus('idle');
      setErrorMessage('');
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (status === 'loading') return;

    const address = email.trim();
    if (!EMAIL.test(address)) {
      refuse(address ? 'Enter a valid email address.' : 'Enter your email address.');
      return;
    }

    setStatus('loading');
    setErrorMessage('');

    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: address }),
      });

      const data = await res.json();

      if (!res.ok) {
        refuse(data.error || 'Something went wrong.');
        return;
      }

      setStatus('success');
      setEmail('');
    } catch {
      refuse('Something went wrong. Please try again.');
    }
  }

  return { email, change, status, errorMessage, handleSubmit, fieldRef };
}

type NewsletterFormState = ReturnType<typeof useNewsletterForm>;

/**
 * The email field, the Subscribe button and the line that says what went wrong: the same wherever the sign-up
 * appears. `className` lays the field and button out for the place. The line's room is always kept, so
 * nothing moves when it has one line to say, and it grows if it has more.
 */
function NewsletterForm({
  form,
  className,
  messageClassName = 'text-center',
}: {
  form: NewsletterFormState;
  className: string;
  messageClassName?: string;
}) {
  const { email, change, status, errorMessage, handleSubmit, fieldRef } = form;
  const messageId = useId();
  const sending = status === 'loading';
  return (
    <>
      {/* noValidate: every mistake is answered on the line below, in one voice. Left to itself the browser
          answers some of them in a bubble of its own. */}
      <form onSubmit={handleSubmit} noValidate className={className}>
        <input
          ref={fieldRef}
          type="email"
          name="email"
          placeholder="you@email.com"
          value={email}
          onChange={(e) => change(e.target.value)}
          required
          aria-label="Email address"
          aria-invalid={status === 'error'}
          aria-describedby={status === 'error' ? messageId : undefined}
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="send"
          className="text-field font-mono h-11 w-full min-w-0 sm:flex-1 border-[1.5px] border-[var(--text)] bg-[var(--bg)] px-4 text-sm text-[var(--text)] placeholder:text-[var(--muted)]"
        />
        {/* While sending, the button is marked disabled and not made so: a disabled button lets go of the
            keyboard, and whoever pressed it would lose their place. */}
        <button type="submit" aria-disabled={sending} className="poster-btn h-11 whitespace-nowrap">
          {/* Both labels share one cell, so the button is as wide as the wider of them and the field beside
              it doesn't move when one gives way to the other. */}
          <span className="grid place-items-center">
            <span className={`col-start-1 row-start-1 ${sending ? 'invisible' : ''}`}>Subscribe</span>
            <span className={`col-start-1 row-start-1 ${sending ? '' : 'invisible'}`}>Sending…</span>
          </span>
        </button>
      </form>
      <p
        id={messageId}
        role="alert"
        className={`mt-3 min-h-4 font-mono text-[10px] uppercase leading-4 tracking-[0.22em] text-pretty text-red-500 ${messageClassName}`}
      >
        {errorMessage}
      </p>
    </>
  );
}

/**
 * The thanks. Its place is always in the page, empty until there is something to say: a screen reader
 * announces words that arrive in a place it already knows, and often not a place that arrives with its words.
 * When the words come it also takes the keyboard, because the form they replace has just gone.
 */
function Thanks({ shown, children }: { shown: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const wasShown = useRef(shown);
  useEffect(() => {
    if (shown && !wasShown.current) ref.current?.focus();
    wasShown.current = shown;
  }, [shown]);
  return (
    <div ref={ref} role="status" tabIndex={-1} className={shown ? 'outline-none' : 'sr-only'}>
      {shown ? children : null}
    </div>
  );
}

export function NewsletterFooter() {
  const form = useNewsletterForm();
  const done = form.status === 'success';

  return (
    <div className="text-center">
      <Thanks shown={done}>
        <p className="font-display text-3xl sm:text-4xl leading-[0.95] text-[var(--text)] mb-3">You&rsquo;re now subscribed!</p>
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-[var(--muted)]">
          We&rsquo;ll let you know when new tapes are added
        </p>
      </Thanks>
      {!done && (
        <>
          <h3 className="font-display text-3xl sm:text-4xl lg:text-5xl leading-[0.95] text-[var(--text)] mb-3">
            Get notified when new tapes drop.
          </h3>
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-[var(--muted)] mb-8">
            No spam. Just new recordings added to the archive.
          </p>
          <NewsletterForm form={form} className="flex flex-col sm:flex-row items-stretch gap-3 max-w-md mx-auto" />
        </>
      )}
    </div>
  );
}

/**
 * The sign-up as the header has it: one line of caption, then the field and the button side by side (one
 * above the other on the narrowest phones, where side by side leaves the field too short to type in). It is
 * the last part of the phone menu, and the panel under the Subscribe button on wider screens. The header
 * holds its state, so what was typed, or the thanks, is still there when it is shut and opened again.
 */
export function NewsletterInline({ form }: { form: NewsletterFormState }) {
  const done = form.status === 'success';

  return (
    <>
      <Thanks shown={done}>
        <p className="pb-3 font-mono text-[10px] uppercase leading-relaxed tracking-[0.22em] text-pretty text-[var(--text)]">
          You&rsquo;re subscribed. We&rsquo;ll let you know when new tapes are added.
        </p>
      </Thanks>
      {!done && (
        <>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--muted)] mb-3">
            Get notified when new tapes drop
          </p>
          <NewsletterForm form={form} className="flex items-stretch gap-3 max-[359px]:flex-col" messageClassName="text-left" />
        </>
      )}
    </>
  );
}
