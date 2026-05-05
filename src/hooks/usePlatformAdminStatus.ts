import { useEffect, useState } from "react";

import { fetchCricketAdminSeries } from "@/lib/cricketApi";

type PlatformAdminStatusState = {
  isPlatformAdmin: boolean;
  loading: boolean;
  error: string | null;
};

export function usePlatformAdminStatus(accessToken?: string | null): PlatformAdminStatusState {
  const [state, setState] = useState<PlatformAdminStatusState>({
    isPlatformAdmin: false,
    loading: Boolean(accessToken),
    error: null,
  });

  useEffect(() => {
    if (!accessToken) {
      setState({
        isPlatformAdmin: false,
        loading: false,
        error: null,
      });
      return;
    }

    const controller = new AbortController();

    setState((current) => ({
      ...current,
      loading: true,
      error: null,
    }));

    fetchCricketAdminSeries(accessToken, controller.signal)
      .then((payload) => {
        if (controller.signal.aborted) {
          return;
        }

        setState({
          isPlatformAdmin: payload.actor?.isPlatformAdmin === true,
          loading: false,
          error: null,
        });
      })
      .catch((error) => {
        if (controller.signal.aborted) {
          return;
        }

        setState({
          isPlatformAdmin: false,
          loading: false,
          error: error instanceof Error ? error.message : "Platform-admin scope could not be resolved.",
        });
      });

    return () => {
      controller.abort();
    };
  }, [accessToken]);

  return state;
}
