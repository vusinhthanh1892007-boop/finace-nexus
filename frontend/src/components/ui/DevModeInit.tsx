"use client";

import { useEffect } from "react";
import { initDevMode } from "@/lib/devmode";


export default function DevModeInit() {
    useEffect(() => {
        initDevMode();
    }, []);

    return null;
}
