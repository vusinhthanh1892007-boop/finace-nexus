"use client";

import { usePathname } from "next/navigation";

interface NavItem {
    href: string;
    label: string;
    icon: string;
}

export default function Navbar({ items }: { items: NavItem[] }) {
    const pathname = usePathname();

    return (
        <nav style={{ display: "flex", alignItems: "center", gap: 2 }}>
            {items.map((item) => {
                const isActive = pathname === item.href || pathname.endsWith(item.href.split("/").pop() ?? "");
                return (
                    <a
                        key={item.href}
                        href={item.href}
                        style={{
                            fontSize: "0.85rem",
                            fontWeight: isActive ? 600 : 500,
                            color: isActive ? "var(--text)" : "var(--text-secondary)",
                            padding: "6px 12px",
                            borderRadius: "var(--radius)",
                            textDecoration: "none",
                            transition: "all 0.15s ease",
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            background: isActive ? "var(--surface-hover)" : "transparent",
                        }}
                    >
                        <span style={{ fontSize: "0.9rem" }}>{item.icon}</span>
                        {item.label}
                    </a>
                );
            })}
        </nav>
    );
}
