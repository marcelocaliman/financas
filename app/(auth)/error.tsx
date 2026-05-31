"use client";

import { ErrorFallback } from "@/components/system/error-fallback";

export default function AuthError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorFallback {...props} scope="auth" />;
}
