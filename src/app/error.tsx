"use client";

import { ErrorState } from "@/components/shared/ErrorState";

export default function RootError({ error, retry }: { error: unknown; retry: () => void }) {
  return <ErrorState error={error} retry={retry} boundary="root" />;
}
