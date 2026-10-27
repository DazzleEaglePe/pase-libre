import Link from 'next/link';

/** Logo de PaseLibre: el cuadro lima con las dos flechas del pase. */
export function Marca({ href = '/' }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 no-underline">
      <svg width="36" height="36" viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="9" fill="#C8F03C" />
        <path
          d="M9 12h13l-3.5-3.5M23 20H10l3.5 3.5"
          fill="none"
          stroke="#14161A"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="text-[22px] font-semibold leading-7 tracking-[-0.02em]">PaseLibre</span>
    </Link>
  );
}
