import { useCallback, useSyncExternalStore } from 'react';

/**
 * Subscribes to a CSS media query and re-renders when it flips.
 *
 * useSyncExternalStore rather than useState+useEffect: matchMedia is an
 * external store, and reading it during render avoids the frame where the
 * component reports a stale breakpoint.
 *
 * The breakpoints below mirror the ones in the stylesheets — if you move one,
 * move the other too, otherwise the JS layout and the CSS layout disagree.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    [query]
  );

  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);

  return useSyncExternalStore(subscribe, getSnapshot);
}

/** Phones and portrait tablets — side-by-side panes collapse to one column here. */
export const useIsMobile = () => useMediaQuery('(max-width: 900px)');
