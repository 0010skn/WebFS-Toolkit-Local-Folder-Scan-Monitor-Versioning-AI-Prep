"use client";

import { Provider as JotaiProvider } from "jotai";
import { ReactNode } from "react";
import { LocaleProvider } from "@/components/LocaleProvider";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <JotaiProvider>
      <LocaleProvider>{children}</LocaleProvider>
    </JotaiProvider>
  );
}
