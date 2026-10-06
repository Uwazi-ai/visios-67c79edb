import { describe, expect, it } from "vitest";
import { KOVA_VOICE, kovaIdentityLabel } from "@/lib/kovaVoice";
import { buildSystemPrompt } from "@/lib/aiPrompt";
import { buildVisionSystemPrompt } from "@/lib/visionPrompt";
import { PERSONAS } from "@/lib/aiPersonas";

describe("Kova co-founder identity", () => {
  it("normalizes display copy without changing legacy persona keys", () => {
    expect(kovaIdentityLabel("Vision by Kova · Chief of Staff")).toBe("Kova · AI co-founder");
    expect(kovaIdentityLabel("vision-briefs")).toBe("Kova-briefs");
    expect(PERSONAS[0].key).toBe("chief_of_staff");
    expect(PERSONAS[0].name).toBe("AI co-founder");
  });

  it("includes the shared grounded voice for every assistant role", () => {
    for (const persona of PERSONAS) {
      const prompt = buildSystemPrompt(persona.key, { today: "2026-10-06T12:00:00Z" });
      expect(prompt).toContain(KOVA_VOICE);
      expect(prompt).toContain("AI co-founder");
      expect(prompt).not.toMatch(/chief of staff|\bVision\b/i);
    }
  });

  it("keeps briefs to three sections and respects organization access", () => {
    const prompt = buildVisionSystemPrompt("chief_of_staff", { intent: { isDailyBrief: true } }, {
      display_name: "Founder",
      vision_display_name: "Vision",
      accessible_orgs: ["UWAZI", "Culture Club"],
      role_label: "Team Member",
    });
    expect(prompt).toContain("You are Kova");
    expect(prompt).toContain("You work within: UWAZI, Culture Club");
    for (const heading of ["Handled", "Needs you", "My take"]) {
      expect(prompt).toContain(`**${heading}**`);
    }
    expect(prompt).toContain("Never invent statistics");
    expect(prompt).toContain("A draft or pending proposal is not a completed action");
    expect(prompt).not.toMatch(/chief of staff|\bVision\b|Today's Schedule/i);
  });
});