// CMY overlapping circles wrapped in a riso-edge mask. Multiply blend
// mode produces secondary colors where circles overlap. Mask + blend
// styling lives in globals.css under .wordmark-mark.
interface WordmarkProps {
  size?: number;
  className?: string;
}

export function Wordmark({ size = 44, className = '' }: WordmarkProps) {
  return (
    <span
      aria-hidden
      className={`wordmark-mark ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 400 400"
        width={size}
        height={size}
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="245" cy="220" r="100" fill="#1A84C4" />
        <circle cx="120" cy="220" r="100" fill="#FB5FB6" />
        <circle cx="190" cy="120" r="100" fill="#FDEB44" />
      </svg>
    </span>
  );
}
