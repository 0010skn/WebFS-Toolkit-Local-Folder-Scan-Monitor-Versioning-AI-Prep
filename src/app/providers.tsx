"use client";

import { Provider as JotaiProvider } from "jotai";
import { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return <JotaiProvider>{children}</JotaiProvider>;
}
