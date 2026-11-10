import { expect, it } from "vitest";
import { buildRepairNotificationSettingsSet } from "./router";

it("changes only submitted repair notification settings", () => {
  const update = buildRepairNotificationSettingsSet("TEST", "actor", {
    templates: { received: { subject: "New subject" } },
  });

  expect(update).toEqual({
    companyCode: "TEST",
    updatedBy: "actor",
    "templates.received.subject": "New subject",
  });
  expect(update).not.toHaveProperty("templates.received.html");
  expect(update).not.toHaveProperty("templates.done.subject");
  expect(update).not.toHaveProperty("notifyChannels");
});
