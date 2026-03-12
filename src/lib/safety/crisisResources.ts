export type CrisisResource = {
    id: string;
    label: string;
    contact: string;
    note?: string;
};

export type CountryCrisisResources = {
    countryCode: string;
    emergency?: CrisisResource;
    primary: CrisisResource[];
};

export const INDIA_CRISIS_RESOURCES: CountryCrisisResources = {
    countryCode: "IN",
    emergency: {
        id: "in-emergency-112",
        label: "Emergency",
        contact: "112",
        note: "For immediate danger or urgent medical / police assistance.",
    },
    primary: [
        {
            id: "in-tele-manas-14416",
            label: "Tele-MANAS",
            contact: "14416 / 1800-891-4416",
            note: "24/7 free government mental health support in multiple Indian languages.",
        },
        {
            id: "in-kiran",
            label: "KIRAN",
            contact: "1800-599-0019",
            note: "24/7 mental health support helpline.",
        },
        {
            id: "in-nimhans",
            label: "NIMHANS",
            contact: "080-46110007",
            note: "24/7 psychosocial support.",
        },
    ],
};

export function getCrisisResourcesForCountry(
    countryCode?: string | null,
): CountryCrisisResources | null {
    const code = String(countryCode ?? "").trim().toUpperCase();

    if (code === "IN" || !code) {
        return INDIA_CRISIS_RESOURCES;
    }

    return null;
}