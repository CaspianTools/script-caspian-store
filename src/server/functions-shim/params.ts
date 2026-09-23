/**
 * Stand-in for `firebase-functions/params`: a secret is read from the host's
 * environment (e.g. an App Hosting secret mapped in apphosting.yaml) instead
 * of Cloud Functions' Secret Manager binding.
 */
export interface ShimSecret {
  readonly name: string;
  value(): string;
}

export function defineSecret(name: string): ShimSecret {
  return {
    name,
    value: () => process.env[name] ?? '',
  };
}

export function defineString(name: string, opts?: { default?: string }): ShimSecret {
  return {
    name,
    value: () => process.env[name] ?? opts?.default ?? '',
  };
}
