// src/lib/imotara/buildTeenInsight.ts

/**
 * Teen-Insight: A gentle, non-threatening emotional reflection layer
 * used to make analysis feel warmer, safer for teenagers, and more relatable.
 *
 * This helper never overrides emotion detection.
 * It simply wraps the reflection in a softer narrative tone.
 */

export function buildTeenInsight(params: {
    message: string;
    emotion: string;
    reflection: string;
}) {
    const { message, emotion, reflection } = params;

    return `
🟣 **Teen Insight**
Here’s a gentle way to look at what you shared:

- It seems you're feeling **${emotion}**.
- ${reflection}

You're not alone — many teens feel something similar, and it's totally valid.
If you ever want to talk more about this or understand it better, I’m here with you.
  `.trim();
}
