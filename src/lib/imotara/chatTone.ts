// src/lib/imotara/chatTone.ts

import { getImotaraProfile } from "@/lib/imotara/profile";

type ChatToneCopy = {
  placeholder: string;
  helper?: string;
};

export function getChatToneCopy(): ChatToneCopy {
  const profile = getImotaraProfile();

  // Default (neutral, current behavior)
  let placeholder = "Write what’s on your mind…";
  let helper = "This space is private. Take your time.";

  if (!profile) {
    return { placeholder, helper };
  }

  // ✅ If user opted OUT of Companion Tone, force calm + comforting default
  // (gentle therapist-ish, non-pushy, low-question).
  const companionEnabled = profile?.companion?.enabled === true;
  if (!companionEnabled) {
    return {
      placeholder: "Take your time… you can write whatever is present.",
      helper: "I’m here with you. No need to rush.",
    };
  }

  const rel = profile?.companion?.relationship;
  const age = profile?.companion?.ageRange;

  // Gentle / elder-like tone
  if (rel === "elder" || rel === "parent_like") {
    placeholder = "You can share anything here, slowly if you wish…";
    helper = "I’m listening. There’s no hurry.";
  }

  // Peer / friend tone
  if (rel === "friend") {
    placeholder = "What’s on your mind right now?";
    helper = "Say it the way it feels.";
  }

  // Coach / mentor tone
  if (rel === "coach" || rel === "mentor") {
    placeholder = "What’s the situation you’re thinking about?";
    helper = "Let’s look at it clearly, one step at a time.";
  }

  // Younger age sensitivity
  if (age === "under_13" || age === "13_17") {
    placeholder = "You can write anything you’re feeling here…";
    helper = "It’s okay to be unsure or confused.";
  }

  return { placeholder, helper };
}
