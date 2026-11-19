import { describe, expect, it } from "vitest";
import { appendLiveCaption, appendSpokenCaption } from "@/lib/jarvis/voice-captions";

describe("Jarvis progressive spoken captions", () => {
  it("appends the exact spoken sentences without dropping punctuation", () => {
    let transcript = "";
    transcript = appendSpokenCaption(transcript, "I work in art direction.");
    transcript = appendSpokenCaption(transcript, " Visual identity is part of that.");
    transcript = appendSpokenCaption(transcript, "And so is AI creative direction.");
    expect(transcript).toBe(
      "I work in art direction. Visual identity is part of that. And so is AI creative direction.",
    );
  });

  it("does not deduplicate genuinely repeated spoken sentences", () => {
    expect(appendSpokenCaption("Yes.", "Yes.")).toBe("Yes. Yes.");
  });

  it("ignores empty fragments and renders plain text, not Markdown", () => {
    expect(appendSpokenCaption("Hello.", "  ")).toBe("Hello.");
    const text = appendSpokenCaption("", "**Brand direction** matters.");
    expect(text).not.toContain("**");
    expect(text).toContain("Brand direction");
  });

  it("assembles Gemini Live deltas without splitting words or losing whitespace", () => {
    const chunks = ["Trans", "cription", " happens", " as", " audio", " plays."];
    const result = chunks.reduce(appendLiveCaption, "");
    expect(result).toBe("Transcription happens as audio plays.");
  });

  it("handles cumulative retransmission and resumption without repeating text", () => {
    let transcript = appendLiveCaption("", "Hello there");
    transcript = appendLiveCaption(transcript, "Hello there, welcome.");
    expect(transcript).toBe("Hello there, welcome.");
    transcript = appendLiveCaption(transcript, "Hello there, welcome.");
    expect(transcript).toBe("Hello there, welcome.");
    transcript = appendLiveCaption(transcript, " welcome. How can I help?");
    expect(transcript).toBe("Hello there, welcome. How can I help?");
  });

  it("allows new Live utterances to start without inheriting an earlier turn", () => {
    const first = appendLiveCaption("", "First answer.");
    const next = appendLiveCaption("", "Second answer.");
    expect(first).toBe("First answer.");
    expect(next).toBe("Second answer.");
  });
});

