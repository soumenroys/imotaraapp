// src/types/license.ts
//
// Shared types for Imotara licensing.
// These are future-facing and do NOT enforce anything by themselves.

export type LicenseTier = "free" | "plus" | "pro" | "family";

export type LicenseStatusCode = "valid" | "invalid" | "expired" | "trial";

export type LicenseSource = "manual" | "stripe" | "razorpay" | "promo" | "internal";

export type LicenseRecord = {
    id: string; // UUID or Supabase-generated
    userId: string; // future: link to auth user ID
    tier: LicenseTier;
    status: LicenseStatusCode;
    /**
     * ISO timestamps as strings for JSON friendliness
     */
    createdAt: string;
    updatedAt: string;
    validFrom: string | null;
    validUntil: string | null;
    /**
     * Optional metadata for future integrations
     */
    source?: LicenseSource;
    externalRef?: string | null; // e.g. Stripe/Razorpay subscription id
    notes?: string | null;
};
