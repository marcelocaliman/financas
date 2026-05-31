"use client";

import { ErrorFallback } from "@/components/system/error-fallback";

export default function ContadorError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorFallback {...props} scope="contador" />;
}
