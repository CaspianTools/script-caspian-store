'use client';

import type { CSSProperties, ReactNode } from 'react';
import { SetupStepper, type SetupStep } from './setup-stepper';

export interface SetupShellProps {
  steps: SetupStep[];
  currentIndex: number;
  completedIndices?: number[];
  heading: string;
  subhead?: string;
  children: ReactNode;
  /** Footer slot — typically Back + Next buttons. */
  footer: ReactNode;
}

/**
 * Visual shell for the setup wizard — violet sidebar + white form panel.
 * Matches the common 4-step onboarding pattern (stepper left, form right).
 */
export function SetupShell({
  steps,
  currentIndex,
  completedIndices,
  heading,
  subhead,
  children,
  footer,
}: SetupShellProps) {
  return (
    <div style={page}>
      <div className="caspian-setup-shell" style={card}>
        <SetupStepper
          steps={steps}
          currentIndex={currentIndex}
          completedIndices={completedIndices}
        />
        <section style={panel}>
          <div style={panelBody}>
            <h1 style={headingStyle}>{heading}</h1>
            {subhead && <p style={subheadStyle}>{subhead}</p>}
            <div style={{ marginTop: 24 }}>{children}</div>
          </div>
          <div style={panelFooter}>{footer}</div>
        </section>
      </div>
    </div>
  );
}

const page: CSSProperties = {
  minHeight: '100vh',
  background: '#EFF5FF',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 24,
  fontFamily: 'inherit',
};

const card: CSSProperties = {
  width: '100%',
  maxWidth: 940,
  background: '#FFFFFF',
  borderRadius: 16,
  padding: 16,
  display: 'grid',
  gridTemplateColumns: '260px 1fr',
  gap: 24,
  boxShadow: '0 12px 40px rgba(22, 36, 64, 0.08)',
};

const panel: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  padding: '24px 48px 24px 24px',
  minHeight: 560,
};

const panelBody: CSSProperties = {
  flex: 1,
};

const panelFooter: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginTop: 24,
};

const headingStyle: CSSProperties = {
  fontSize: 28,
  fontWeight: 700,
  color: '#022959',
  margin: 0,
  lineHeight: 1.2,
};

const subheadStyle: CSSProperties = {
  fontSize: 16,
  color: '#6A7A8A',
  margin: '10px 0 0 0',
  lineHeight: 1.5,
};
