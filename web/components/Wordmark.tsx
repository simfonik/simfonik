// CMY overlapping circles wrapped in a riso-edge mask. Multiply blend
// mode produces secondary colors where circles overlap. Designed to sit
// left of the "simfonik" text in the header.
interface WordmarkProps {
  size?: number;
  className?: string;
}

export function Wordmark({ size = 36, className = '' }: WordmarkProps) {
  return (
    <span
      aria-hidden
      className={className}
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        WebkitMaskImage: 'url("/media/site/riso-mask.png")',
        maskImage: 'url("/media/site/riso-mask.png")',
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
      }}
    >
      <svg
        viewBox="0 0 400 400"
        width={size}
        height={size}
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: 'block' }}
      >
        <circle cx="245" cy="220" r="100" fill="#1A84C4" style={{ mixBlendMode: 'multiply' }} />
        <circle cx="120" cy="220" r="100" fill="#FB5FB6" style={{ mixBlendMode: 'multiply' }} />
        <circle cx="190" cy="120" r="100" fill="#FDEB44" style={{ mixBlendMode: 'multiply' }} />
      </svg>
    </span>
  );
}
