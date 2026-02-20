"use client";

import { useEffect } from "react";

type PollTask = (signal: AbortSignal) => Promise<void>;


export function useVisibilityPolling(task: PollTask, intervalMs: number) {
    useEffect(() => {
        let stopped = false;
        let controller: AbortController | null = null;

        const run = async () => {
            if (stopped || document.hidden) return;

            controller?.abort();
            controller = new AbortController();

            try {
                await task(controller.signal);
            } catch (error) {
                if (error instanceof DOMException && error.name === "AbortError") {
                    return;
                }
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
