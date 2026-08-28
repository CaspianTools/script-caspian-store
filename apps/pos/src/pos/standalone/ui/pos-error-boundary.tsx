'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';

/**
 * The one thing between a render error and a white screen mid-sale.
 *
 * Until this existed there was no boundary anywhere in the till -- no
 * `componentDidCatch`, no class component at all. A malformed product, an
 * unexpected null on a sale line, anything at all thrown during render replaced
 * the whole register with a blank page, at a counter, with a customer waiting,
 * and the only way back was a reload the cashier had no reason to think of.
 *
 * `PanelLoadError` is not this. That catches a rejected promise inside one
 * panel's `refresh()`; a boundary catches everything React throws while
 * rendering, which is the failure that takes the screen with it.
 *
 * The class carries **no strings and no markup**. It is the only class
 * component in the till, and it earns that by owning behaviour React exposes no
 * other way -- so the translated fallbacks stay ordinary function components
 * with `useT` and this stays the mechanism.
 */

export interface PosErrorBoundaryState {
  error: Error;
  reset: () => void;
}

export interface PosErrorBoundaryProps {
  children: ReactNode;
  fallback: (state: PosErrorBoundaryState) => ReactNode;
  /**
   * Changing this clears the error. A screen-level boundary passes the current
   * route, so navigating away from a crashed page is enough to recover it --
   * no extra wiring, and the same idea as keying a section by its id.
   */
  resetKey?: string;
}

interface State {
  error: Error | null;
}

export class PosErrorBoundary extends Component<PosErrorBoundaryProps, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // The console, and nowhere else. The till contacts nothing by design, so
    // there is no telemetry endpoint to reach and adding one would break the
    // promise the whole standalone product is built on. A support engineer
    // reads this out of DevTools; the fallback also puts it on screen so a
    // shopkeeper can read it down a phone.
    console.error('[pos] render error', error, info.componentStack);
  }

  componentDidUpdate(previous: PosErrorBoundaryProps): void {
    if (this.state.error && previous.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  private reset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;
    if (error) return this.props.fallback({ error, reset: this.reset });
    return this.props.children;
  }
}
