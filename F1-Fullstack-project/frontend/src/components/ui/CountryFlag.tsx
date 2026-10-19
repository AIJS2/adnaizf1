/**
 * Small offline country flag.
 *
 * `react-world-flags`' main bundle inlines every flag in the world (~3.7 MB),
 * so this component instead imports only the per-country SVG files this app
 * can actually show (`react-world-flags/src/svgs/<code>.svg`). Vite inlines
 * the small ones as data URIs and emits the larger ones as cacheable assets.
 *
 * `code` is an ISO 3166-1 alpha-2 code as returned by `getCountryCode`;
 * an unknown/absent code renders nothing.
 */
import ae from 'react-world-flags/src/svgs/ae.svg';
import at from 'react-world-flags/src/svgs/at.svg';
import au from 'react-world-flags/src/svgs/au.svg';
import az from 'react-world-flags/src/svgs/az.svg';
import be from 'react-world-flags/src/svgs/be.svg';
import bh from 'react-world-flags/src/svgs/bh.svg';
import br from 'react-world-flags/src/svgs/br.svg';
import ca from 'react-world-flags/src/svgs/ca.svg';
import cn from 'react-world-flags/src/svgs/cn.svg';
import es from 'react-world-flags/src/svgs/es.svg';
import gb from 'react-world-flags/src/svgs/gb.svg';
import hu from 'react-world-flags/src/svgs/hu.svg';
import it from 'react-world-flags/src/svgs/it.svg';
import jp from 'react-world-flags/src/svgs/jp.svg';
import mc from 'react-world-flags/src/svgs/mc.svg';
import mx from 'react-world-flags/src/svgs/mx.svg';
import nl from 'react-world-flags/src/svgs/nl.svg';
import qa from 'react-world-flags/src/svgs/qa.svg';
import sa from 'react-world-flags/src/svgs/sa.svg';
import sg from 'react-world-flags/src/svgs/sg.svg';
import us from 'react-world-flags/src/svgs/us.svg';

const FLAGS: Record<string, string> = {
  AE: ae, AT: at, AU: au, AZ: az, BE: be, BH: bh, BR: br, CA: ca, CN: cn,
  ES: es, GB: gb, HU: hu, IT: it, JP: jp, MC: mc, MX: mx, NL: nl, QA: qa,
  SA: sa, SG: sg, US: us,
};

interface CountryFlagProps {
  /** ISO 3166-1 alpha-2 country code (see `getCountryCode`). */
  code?: string | null;
  alt?: string;
  className?: string;
}

export function CountryFlag({ code, alt = '', className }: CountryFlagProps) {
  const src = code ? FLAGS[code.toUpperCase()] : undefined;
  if (!src) return null;
  return <img src={src} alt={alt} className={className} />;
}
