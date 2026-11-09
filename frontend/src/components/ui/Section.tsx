/** A page section: a rule above it and a heading that folds it away. Open by
 *  default. Buttons inside the heading (help bulbs, reset) do not fold it,
 *  since a click on a button never triggers the summary's toggle. */

import type { ReactNode } from 'react';

export default function Section({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <>
      <hr className="pa-divider" />
      <details open className="pa-section">
        <summary className="pa-section-summary">{title}</summary>
        {children}
      </details>
    </>
  );
}
