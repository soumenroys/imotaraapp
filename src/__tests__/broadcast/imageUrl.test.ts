// src/__tests__/broadcast/imageUrl.test.ts
import { describe, it, expect } from "vitest";
import { checkImageUrl } from "@/lib/broadcast/imageUrl";

describe("checkImageUrl", () => {
  it("accepts a plain https image", () => {
    const v = checkImageUrl("https://cdn.test/a/photo.png");
    expect(v.ok).toBe(true);
  });

  it("refuses http", () => {
    expect(checkImageUrl("http://cdn.test/a.png").ok).toBe(false);
  });

  it("refuses a Google Drive share link — it is a page, not an image", () => {
    const v = checkImageUrl("https://drive.google.com/file/d/1AbC/view?usp=sharing");
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toContain("Google Drive");
  });

  it("refuses OneDrive, SharePoint and Google Photos too", () => {
    expect(checkImageUrl("https://1drv.ms/i/s!Abc").ok).toBe(false);
    expect(checkImageUrl("https://contoso.sharepoint.com/x/a.png").ok).toBe(false);
    expect(checkImageUrl("https://photos.google.com/share/abc").ok).toBe(false);
  });

  it("repairs a Dropbox share link instead of refusing it", () => {
    const v = checkImageUrl("https://www.dropbox.com/s/abc/pic.png?dl=0");
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.url).toContain("raw=1");
      expect(v.url).not.toContain("dl=0");
      expect(v.note).toBeTruthy();
    }
  });

  it("leaves an already-raw Dropbox link alone", () => {
    const v = checkImageUrl("https://www.dropbox.com/s/abc/pic.png?raw=1");
    if (v.ok) expect(v.url).toBe("https://www.dropbox.com/s/abc/pic.png?raw=1");
  });

  it("warns, but allows, an address with no image extension", () => {
    const v = checkImageUrl("https://cdn.test/image/12345");
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.note).toBeTruthy();
  });

  it("rejects nonsense", () => {
    expect(checkImageUrl("not a url").ok).toBe(false);
    expect(checkImageUrl("").ok).toBe(false);
  });
});
