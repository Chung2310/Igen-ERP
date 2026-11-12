// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { Assistant2DFileIcon } from "./Assistant2DFileIcon";

describe("Assistant2DFileIcon", () => {
  it.each([
    ["report.xlsx", "XLSX"],
    ["slides.pptx", "PPTX"],
    ["scan.pdf", "PDF"],
    ["photo.jpeg", "JPG"],
    ["transcript.txt", "TXT"],
    ["unknown", "FILE"],
  ])("shows a format badge for %s", (fileName, expectedFormat) => {
    const { container } = render(<Assistant2DFileIcon fileName={fileName} />);
    expect(container.querySelector("svg text")?.textContent).toBe(expectedFormat);
  });

  it("uses file metadata when the file name has no extension", () => {
    const { container } = render(<Assistant2DFileIcon fileName="report" format="xlsx" />);
    expect(container.querySelector("svg text")?.textContent).toBe("XLSX");
  });

  it("shows only the file icon for upload, while retaining the download badge", () => {
    const { container, rerender } = render(<Assistant2DFileIcon fileName="result.png" action="upload" />);
    expect(container.querySelector('svg circle[cx="51"]')).toBeNull();
    expect(container.querySelector("svg text")?.textContent).toBe("PNG");
    rerender(<Assistant2DFileIcon fileName="result.png" action="download" />);
    expect(container.querySelector('svg circle[cx="51"]')).not.toBeNull();
  });
});
