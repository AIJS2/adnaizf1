/**
 * Minimal declarations for `react-world-flags`, which ships as plain
 * JavaScript without bundled types.
 *
 * `code` accepts an ISO 3166-1 alpha-2, alpha-3 or numeric country code; every
 * prop except `code` and `fallback` is forwarded to the rendered <img>.
 * See node_modules/react-world-flags/README.md.
 */
declare module 'react-world-flags' {
  import type { ImgHTMLAttributes, ReactElement, ReactNode } from 'react';

  export interface FlagProps extends ImgHTMLAttributes<HTMLImageElement> {
    /** ISO 3166-1 alpha-2, alpha-3 or numeric country code. */
    code?: string;
    /** Rendered instead of the flag when the code has no match. */
    fallback?: ReactNode;
  }

  export default function Flag(props: FlagProps): ReactElement | null;
}
