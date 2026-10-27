/** One of the analysis page's three main parts: a numbered banner naming what
 *  goes into it. A click on the banner folds the part away; buttons in it
 *  (help bulb, reset) do not, since a click on a button never toggles a summary. */

import type { ReactNode } from 'react';

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
