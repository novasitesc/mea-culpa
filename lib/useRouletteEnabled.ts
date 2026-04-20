"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchRouletteConfig } from "@/lib/rouletteConfigClient";

type UseRouletteEnabledOptions = {
  token?: string;
  providedEnabled?: boolean | null;
};

type UseRouletteEnabledResult = {
  rouletteEnabled: boolean | null;
  refreshRouletteEnabled: () => Promise<void>;
};

export function useRouletteEnabled(
  options: UseRouletteEnabledOptions = {},
): UseRouletteEnabledResult {
  const { token, providedEnabled } = options;
  const hasProvidedEnabled = useMemo(
    () => typeof providedEnabled !== "undefined",
    [providedEnabled],
  );
  const [rouletteEnabled, setRouletteEnabled] = useState<boolean | null>(
    providedEnabled ?? null,
  );

  const loadRouletteEnabled = useCallback(
    async (force = false) => {
      if (hasProvidedEnabled) {
        setRouletteEnabled(providedEnabled ?? null);
        return;
      }

      try {
        const data = await fetchRouletteConfig({ token, force });
        setRouletteEnabled(Boolean(data.enabled ?? true));
      } catch {
        // Fallback cerrado: sin config valida tratamos la ruleta como deshabilitada.
        setRouletteEnabled(false);
      }
    },
    [hasProvidedEnabled, providedEnabled, token],
  );

  useEffect(() => {
    if (hasProvidedEnabled) {
      setRouletteEnabled(providedEnabled ?? null);
      return;
    }

    void loadRouletteEnabled();
  }, [hasProvidedEnabled, loadRouletteEnabled, providedEnabled]);

  const refreshRouletteEnabled = useCallback(async () => {
    await loadRouletteEnabled(true);
  }, [loadRouletteEnabled]);

  return {
    rouletteEnabled,
    refreshRouletteEnabled,
  };
}
