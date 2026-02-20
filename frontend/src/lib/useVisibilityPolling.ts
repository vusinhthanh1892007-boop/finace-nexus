"use client";

import { useEffect } from "react";

type PollTask = (signal: AbortSignal) => Promise<void>;


export function useVisibilityPolling(task: PollTask, intervalMs: number) {
    useEffect(() => {
        let stopped = false;
        let controller: AbortController | null = null;
        let inFlight = false;

        const run = async () => {
            if (stopped || document.hidden) return;
            if (inFlight) return;
            controller = new AbortController();
            inFlight = true;

            try {
                await task(controller.signal);
            } catch (error) {
                if (error instanceof DOMException && error.name === "AbortError") {
                    return;
                }
            } finally {
                inFlight = false;
            }
        };

        void run();
        const interval = window.setInterval(() => {
            void run();
        }, intervalMs);

        const onVisibilityChange = () => {
            if (!document.hidden) {
                void run();
            }
        };
        document.addEventListener("visibilitychange", onVisibilityChange);

        return () => {
            stopped = true;
            window.clearInterval(interval);
            document.removeEventListener("visibilitychange", onVisibilityChange);
            controller?.abort();
        };
    }, [task, intervalMs]);
}
