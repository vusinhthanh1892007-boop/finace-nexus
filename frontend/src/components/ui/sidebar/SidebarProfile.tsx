"use client";



import { RiUser3Fill } from "@remixicon/react";

export default function SidebarProfile() {
    return (
        <div
            style={{
                padding: "12px 16px",
                borderTop: "1px solid var(--sidebar-border)",
                display: "flex",
                alignItems: "center",
                gap: 10,
            }}
        >
            <div
                style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: "var(--gradient)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                }}
            >
                <RiUser3Fill size={16} color="white" />
            </div>
            <div style={{ overflow: "hidden" }}>
                <div
                    style={{
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        color: "var(--text)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                    }}
                >
                    Thanh Vu
                </div>
                <div
                    style={{
                        fontSize: "0.65rem",
                        color: "var(--text-muted)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                    }}
                >
                    thanh@nexusfinance.ai
                </div>
            </div>
        </div>
    );
}
