// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it } from "vitest";
import { APP_ROUTES } from "../../../../../router/route-config";
import { pathToTab } from "../../../../../seo/seo-config";
import { openContentStudio } from "../../../shared/utils/contentStudioNavigation";
import { openVideoStudio } from "../../../shared/utils/videoStudioNavigation";
import { CAMPAIGN_MEDIA_EVENT, type CampaignMediaLaunch } from "./campaignMedia";

let launches: CampaignMediaLaunch[] = [];
const receive = (event: Event) => launches.push((event as CustomEvent<CampaignMediaLaunch>).detail);
beforeEach(() => {
  launches = [];
  window.history.replaceState(null, "", "/chien-dich-noi-dung");
  window.addEventListener(CAMPAIGN_MEDIA_EVENT, receive);
});
afterEach(() => window.removeEventListener(CAMPAIGN_MEDIA_EVENT, receive));

it("does not register independent content/video studio pages", () => {
  expect(APP_ROUTES.some((route) => ["VIDEO STUDIO", "XƯỞNG NỘI DUNG"].includes(route.tab))).toBe(false);
  expect(pathToTab("/video-studio")).toBeNull();
  expect(pathToTab("/xuong-noi-dung/tao-hinh-anh")).toBeNull();
});
it("opens image generation with a campaign card without leaving Campaign", () => {
  openContentStudio({ tab: "image", cardId: "card", prompt: "Ảnh chiến dịch" });
  expect(launches).toEqual([expect.objectContaining({ kind: "image", cardId: "card" })]);
  expect(window.location.pathname).toBe("/chien-dich-noi-dung");
});
it("opens customer video upload inside the campaign card", () => {
  openVideoStudio({ tool: "upload-video", cardId: "card", prompt: "Video chiến dịch" });
  expect(launches).toEqual([expect.objectContaining({ kind: "video", cardId: "card" })]);
  expect(window.location.pathname).toBe("/chien-dich-noi-dung");
});
it("requires campaign context for bulk media creation", () => {
  openContentStudio({ tab: "template", campaignId: "campaign" });
  expect(launches).toEqual([expect.objectContaining({ kind: "bulk", campaignId: "campaign" })]);
});
it("refuses launching media tools without a campaign or card", () => {
  openContentStudio();
  openContentStudio({ tab: "image", prompt: "Không có bài" });
  openVideoStudio({ tool: "voice" });
  expect(launches).toEqual([]);
});
it("does not launch independent editor/motion tools", () => {
  expect(launches).toEqual([]);
});
