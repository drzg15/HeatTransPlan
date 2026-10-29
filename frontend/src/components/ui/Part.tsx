/** One of the app's numbered steps: a banner with its number, its title and
 *  what goes into it (1 Data Collection, 2–4 the parts of Potential
 *  Analysis). A click on the banner folds the part away; buttons in it (help
 *  bulb, reset) do not, since a click on a button never toggles a summary. */

import type { ReactNode } from 'react';
import './Part.css';

/** Just the banner, not folding: the top of Data Collection. */
export function PartBanner({ n, title, input }: { n: number; title: string; input: string }) {
  return (
    <div className="pa-part-banner pa-part-banner-static">
      <span className="pa-part-num">{n}</span>
      <h2>{title}</h2>
      <span className="pa-part-input">{input}</span>
    </div>
  );
}

export default function Part({
  n,
  title,
  input,
  actions,
  children,
}: {
  n: number;
  title: string;
  input: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <details open className="pa-part">
      <summary className="pa-part-banner">
        <span className="pa-part-num">{n}</span>
        <h2>{title}</h2>
        <span className="pa-part-input">{input}</span>
        {actions}
      </summary>
      <div className="pa-part-body">{children}</div>
    </details>
  );
}
