// src/lib/broadcast/templates/index.ts
// The catalogue. See ./types.ts for the house style and why it is a
// deliverability decision rather than a stylistic one.

import { INDIVIDUALS } from "./individuals";
import { NGOS } from "./ngos";
import { EDUCATION } from "./education";
import { CORPORATES } from "./corporates";
import { ELDERCARE } from "./eldercare";
import { AUDIENCE_LABEL, ORGANISATIONAL, type Audience, type Template } from "./types";

export { AUDIENCE_LABEL, ORGANISATIONAL };
export type { Audience, Template };

export const TEMPLATES: readonly Template[] = [
    ...INDIVIDUALS, ...NGOS, ...EDUCATION, ...CORPORATES, ...ELDERCARE,
];

/** Display order in the picker. `individuals` first — it is the real newsletter. */
export const AUDIENCES: readonly Audience[] = [
    "individuals", "ngos", "education", "corporates", "eldercare",
];

export function templatesFor(audience: Audience): Template[] {
    return TEMPLATES.filter((t) => t.audience === audience);
}

export function templateById(id: string): Template | undefined {
    return TEMPLATES.find((t) => t.id === id);
}
