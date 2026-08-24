'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { POS_STYLESHEET } from './pos-stylesheet';

/**
 * True once an ancestor has already put the stylesheet in the tree.
 *
 * `PosGuard` and `PosShell` are both public exports and either can be mounted
 * on its own, so both have to carry the sheet -- but the normal arrangement
 * nests one inside the other, and two copies of 25KB of identical CSS is waste
 * with no upside. Context is the only dedupe that stays pure during render and
 * therefore survives server rendering; a module-level flag would leak between
 * requests on a shared server.
 */
const PosStylesMounted = createContext(false);

/**
 * Puts the register's stylesheet in the tree, once.
 *
 * Rendered as JSX rather than appended to `<head>` from an effect so the rules
 * are there for the first paint -- a till that flashed unstyled markup between
 * mount and effect would do it on every cold start of the day.
 *
 * `dangerouslySetInnerHTML` is not a risk here and is not optional: the content
 * is a module constant with no interpolation, and React escapes `>` inside a
 * text child, which would break every descendant selector in the sheet.
 */
export function PosStyleScope({ children }: { children: ReactNode }) {
  const already = useContext(PosStylesMounted);
  if (already) return <>{children}</>;

  return (
    <PosStylesMounted.Provider value={true}>
      <style data-caspian-pos-styles="" dangerouslySetInnerHTML={{ __html: POS_STYLESHEET }} />
      {children}
    </PosStylesMounted.Provider>
  );
}
