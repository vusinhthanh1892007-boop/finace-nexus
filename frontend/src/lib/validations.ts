

import { z } from "zod";



export function sanitizeInput(input: string): string {
    return input
        .replace(/<[^>]*>/g, "")           // Strip HTML tags
        .replace(/javascript:/gi, "")       // Block JS protocol
        .replace(/on\w+\s*=/gi, "")         // Block event handlers
        .replace(/[<>'"]/g, "")             // Remove dangerous chars
        .trim();
}


export const ledgerInputSchema = z
    .object({
        income: z
            .number({ message: "Income must be a valid number" })
            .positive("Income must be positive")
            .max(1_000_000_000, "Income exceeds maximum allowed value"),

        actual_expenses: z
            .number({ message: "Expenses must be a valid number" })
            .nonnegative("Expenses cannot be negative")
            .max(1_000_000_000, "Expenses exceed maximum allowed value"),

        planned_budget: z
            .number({ message: "Budget must be a valid number" })
            .positive("Budget must be positive")
            .max(1_000_000_000, "Budget exceeds maximum allowed value"),
    })
    .refine(
        (data) => data.planned_budget <= data.income * 2,
        { message: "Budget should not exceed 2× income", path: ["planned_budget"] }
    )
    .refine(
        (data) => data.actual_expenses <= data.income * 3,
        { message: "Expenses exceeding 3× income is likely a data entry error", path: ["actual_expenses"] }
    );


const tickerRegex = /^[A-Z0-9.\-^]{1,10}$/;

export const tradingInputSchema = z.object({
    ticker: z
        .string()
        .transform((v) => v.toUpperCase().trim())
        .refine((v) => tickerRegex.test(v), {
            message: "Ticker must be 1-10 uppercase letters/digits (e.g. AAPL, VNM, BTC)",
        }),

    shares: z
        .number({ message: "Shares must be a number" })
        .int("Shares must be whole numbers")
        .positive("Shares must be positive")
        .max(100_000, "Maximum 100,000 shares per order"),

    side: z.enum(["buy", "sell"], {
        message: "Side must be 'buy' or 'sell'",
    }),

    limit_price: z
        .number()
        .positive("Price must be positive")
        .optional(),
});


export const settingsSchema = z.object({
    gemini_api_key: z
        .string()
        .regex(/^[A-Za-z0-9\-_]{20,60}$/, "Invalid API key format")
        .optional()
        .or(z.literal("")),

    risk_tolerance: z.enum(["conservative", "moderate", "aggressive"], {
        message: "Risk must be conservative, moderate, or aggressive",
    }),

    auto_balance: z.boolean(),
    notifications: z.boolean(),
    two_factor: z.boolean().optional(),
});


export const advisorInputSchema = z.object({
    income: z
        .number()
        .positive("Income must be positive")
        .max(1_000_000_000),

    actual_expenses: z
        .number()
        .nonnegative("Expenses cannot be negative")
        .max(1_000_000_000),

    planned_budget: z
        .number()
        .positive("Budget must be positive")
        .max(1_000_000_000),

    family_size: z
        .number()
        .int()
        .min(1, "At least 1 person")
        .max(20, "Maximum 20 family members"),

    locale: z.enum(["en", "vi", "es"]),
    location: z.string().max(180).optional(),
    meal_seed: z.number().int().nonnegative().optional(),

    expense_categories: z.record(
        z.string(),
        z.number().nonnegative()
    ).optional(),
});


export type LedgerInput = z.infer<typeof ledgerInputSchema>;
export type TradingInput = z.infer<typeof tradingInputSchema>;
export type SettingsInput = z.infer<typeof settingsSchema>;
export type AdvisorInput = z.infer<typeof advisorInputSchema>;
