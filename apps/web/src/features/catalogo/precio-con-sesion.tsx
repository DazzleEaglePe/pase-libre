/** El candado del lienzo: así se avisa que el precio se ve al iniciar sesión. */
export function PrecioConSesion({ className = '' }: { className?: string }) {
  return (
    <span className={`flex items-center gap-1.5 font-semibold ${className}`}>
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="5" y="11" width="14" height="10" rx="2" />
        <path d="M8 11V8a4 4 0 0 1 8 0v3" />
      </svg>
      Precio con sesión
    </span>
  );
}
