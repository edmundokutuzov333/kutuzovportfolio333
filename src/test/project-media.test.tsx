import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ProjectMedia } from "@/components/ProjectMedia";
import { isVideoSource } from "@/lib/project-media";

afterEach(cleanup);
describe("mixed project media", () => {
  it("detects video from the asset path, not the project-wide type or query", () => {
    expect(isVideoSource("https://example.com/clip.MP4?token=x#t=1")).toBe(true);
    expect(isVideoSource("/photo.webp?filename=clip.mp4")).toBe(false);
  });
  it("renders video controls only on the detail surface", () => {
    const { container, rerender } = render(<ProjectMedia src="https://example.com/clip.mp4" alt="Animation" />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("video")?.controls).toBe(false);
    rerender(<ProjectMedia src="https://example.com/clip.mp4" alt="Animation" controls />);
    expect(container.querySelector("video")?.controls).toBe(true);
  });
  it("keeps still images in mixed galleries as images", () => {
    render(<ProjectMedia src="https://example.com/photo.webp" alt="Project photograph" controls />);
    expect(screen.getByRole("img", { name: "Project photograph" })).toHaveAttribute("src", "https://example.com/photo.webp");
  });
});
