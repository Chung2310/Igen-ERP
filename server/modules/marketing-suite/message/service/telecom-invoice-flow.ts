import type { Types } from "mongoose";
import type { TelecomInvoiceField, TelecomInvoicePlatform } from "../../../../../shared/marketing-suite/telecom-invoice";
import type { LeadIntakeField } from "../../../../../shared/marketing-suite/lead-intake";
import { enabledTelecomInvoiceAccount, TelecomInvoiceConversationModel, TelecomInvoiceModel, TelecomInvoiceSettingsModel, type TelecomInvoiceAccount, type TelecomInvoiceDraft } from "../model/telecom-invoice.model";
import { FBMessageModel } from "../model/fb-messenger.model";
import { splitHistoryAndPendingInboundMessages } from "./chat-image-context";
import type { ChatSourceMessage } from "./chat-reply-context.service";
import { isDuplicateInvoiceKey, isInvoiceReadyForAutomaticSave, saveTelecomInvoice } from "./telecom-invoice-lead";
import { downloadTelecomInvoiceImage, readTelecomInvoice } from "./telecom-invoice-ocr";
import { findInvoiceEditField, missingInvoiceFields, normalizeInvoiceLeadValue, normalizeInvoiceValue, parseInvoiceCommands, summarizeInvoice } from "./telecom-invoice-values";
import { findSubscriberField, readActiveInvoiceLeadFields } from "./telecom-invoice-profile";

type Scope = TelecomInvoiceAccount & { conversationId: string };
type StoredInvoice = TelecomInvoiceDraft & { _id: Types.ObjectId };
export type TelecomInvoiceReply = { text: string; presentations: Array<{ id: Types.ObjectId; revision: number }> };
type InvoiceSource = { sourceMessageId: string; sourceIndex: number; url: string };
const MAX_IMAGES = 6;
const draftExpiry = () => new Date(Date.now() + 7 * 86_400_000);
const imageIssueText = {
  blurry: "Ảnh bị mờ hoặc lóa nên em chưa đọc được. Anh/chị gửi lại ảnh rõ nét, chụp đủ hóa đơn giúp em nhé.",
  multiple: "Ảnh có nhiều hóa đơn. Anh/chị gửi mỗi hóa đơn trong một ảnh riêng giúp em nhé.",
  unreadable: "Em chưa đọc rõ nội dung hóa đơn. Anh/chị gửi lại ảnh chụp đủ trang và rõ nét giúp em nhé.",
  download: "Em chưa mở được ảnh. Anh/chị gửi lại trực tiếp trong cuộc trò chuyện giúp em nhé.",
  processing: "Em chưa đọc được ảnh lần này. Anh/chị gửi lại ảnh giúp em nhé.",
};

function invoiceConversationFilter({ platform, ...scope }: Scope) {
  return { ...scope, platform: platform === "zalo" ? "zalo" as const : { $ne: "zalo" as const } };
}

export async function isPendingTelecomConfirmation(scope: Omit<Scope, "platform">, text: string): Promise<boolean> {
  const commands = parseInvoiceCommands(text);
  if (!commands.length) return false;
  const account = { ...scope, platform: "facebook" as const };
  if (!await TelecomInvoiceSettingsModel.exists(enabledTelecomInvoiceAccount(account))) return false;
  const pending = { ...invoiceConversationFilter(account), status: "pending" as const, autoEligible: { $ne: true }, expiresAt: { $gt: new Date() } };
  if (commands.some(command => command.type !== "yes")) return Boolean(await TelecomInvoiceModel.exists(pending));
  const lastOutbound = await FBMessageModel.findOne({ conversationId: scope.conversationId, direction: "outbound" })
    .sort({ timestamp: -1, _id: -1 }).select("messageId").lean();
  return Boolean(lastOutbound?.messageId && await TelecomInvoiceModel.exists({ ...pending, presentedMessageId: lastOutbound.messageId }));
}

function imageSources(messages: ChatSourceMessage[]): InvoiceSource[] {
  return messages.flatMap(message => message.messageId ? (message.attachments || []).flatMap((attachment, index) => {
    const type = attachment.type;
    return type === "image" || type?.startsWith("image/")
      ? [{ sourceMessageId: message.messageId!, sourceIndex: index, url: attachment.url || "" }]
      : [];
  }) : []);
}

async function nextImageNumber(scope: Scope) {
  for (let attempt = 0; ; attempt++) {
    try {
      const conversation = await TelecomInvoiceConversationModel.findOneAndUpdate(invoiceConversationFilter(scope), {
        $inc: { sequence: 1 }, $setOnInsert: { platform: scope.platform },
      },
        { upsert: true, returnDocument: "after" }).lean();
      return conversation.sequence;
    } catch (error) {
      if (!isDuplicateInvoiceKey(error) || attempt >= 2) throw error;
    }
  }
}

async function ingestImages(scope: Scope, images: InvoiceSource[], leadFields: LeadIntakeField[], subscriberFieldKey: string) {
  const conversation = invoiceConversationFilter(scope);
  const sources = images.map(({ sourceMessageId, sourceIndex }) => ({ sourceMessageId, sourceIndex }));
  const stored: StoredInvoice[] = sources.length ? await TelecomInvoiceModel.find({ ...conversation, $or: sources }).lean() : [];
  const unseen = images.filter(image => !stored.some(item => item.sourceMessageId === image.sourceMessageId && item.sourceIndex === image.sourceIndex));
  const deadlineAt = Date.now() + 60_000;
  let repeated = 0;
  for (let index = 0; index < unseen.length; index += 3) {
    const batch = unseen.slice(index, index + 3);
    const files = await Promise.all(batch.map(image => downloadTelecomInvoiceImage(image.url)));
    const hashes = [...new Set(files.flatMap(file => file ? [file.imageHash] : []))];
    const [recorded, pending] = hashes.length ? await Promise.all([
      TelecomInvoiceModel.distinct("imageHash", { companyCode: scope.companyCode, imageHash: { $in: hashes }, status: "confirmed" }),
      TelecomInvoiceModel.find({ ...conversation, status: "pending", imageHash: { $in: hashes }, expiresAt: { $gt: new Date() } }).sort({ imageNumber: -1 }).lean(),
    ]) : [[], []];
    const recordedHashes = new Set(recorded);
    const pendingByHash = new Map<string, StoredInvoice>();
    const retryableByHash = new Map<string, StoredInvoice>();
    for (const draft of pending) {
      if (!draft.imageHash) continue;
      const byHash = draft.imageIssue === "processing" && draft.revision === 1 ? retryableByHash : pendingByHash;
      byHash.set(draft.imageHash, draft);
    }
    const readingsByHash = new Map<string, ReturnType<typeof readTelecomInvoice>>();
    for (const file of files) {
      if (!file || recordedHashes.has(file.imageHash) || pendingByHash.has(file.imageHash) || readingsByHash.has(file.imageHash)) continue;
      readingsByHash.set(file.imageHash, readTelecomInvoice(file.image, leadFields, subscriberFieldKey, deadlineAt));
    }
    await Promise.all(readingsByHash.values());
    for (const [offset, file] of files.entries()) {
      const { sourceMessageId, sourceIndex } = batch[offset];
      if (file && recordedHashes.has(file.imageHash)) {
        repeated++;
        continue;
      }
      const previous = file && pendingByHash.get(file.imageHash);
      if (previous) {
        repeated++;
        stored.push(previous);
        continue;
      }
      const reading = file ? await readingsByHash.get(file.imageHash)! : { values: {}, unclearFields: [], other: false, imageIssue: "download" as const };
      const imageNumber = reading.other ? 0 : await nextImageNumber(scope);
      const key = { ...conversation, sourceMessageId, sourceIndex };
      let item: StoredInvoice | null;
      try {
        item = await TelecomInvoiceModel.findOneAndUpdate(key, { $setOnInsert: { imageNumber, leadFields, subscriberFieldKey, platform: scope.platform,
          values: reading.values, imageHash: file?.imageHash, imageIssue: reading.imageIssue, unclearFields: reading.unclearFields,
          autoEligible: !reading.other && isInvoiceReadyForAutomaticSave({ ...reading, leadFields, subscriberFieldKey }),
          status: reading.other ? "other" : "pending", expiresAt: draftExpiry(), revision: 1,
        } }, { upsert: true, returnDocument: "after" }).lean();
      } catch (error) {
        if (!isDuplicateInvoiceKey(error)) throw error;
        item = await TelecomInvoiceModel.findOne(key).lean();
      }
      if (item) {
        stored.push(item);
        const failedDraft = item.imageHash && retryableByHash.get(item.imageHash);
        if (failedDraft && !item._id.equals(failedDraft._id)) {
          await TelecomInvoiceModel.updateOne({ _id: failedDraft._id, status: "pending", revision: 1, imageIssue: "processing" }, { $set: { status: "skipped" } });
        }
        if (item.imageHash && item.status === "pending") pendingByHash.set(item.imageHash, item);
        if (item.imageHash && item.status === "confirmed") recordedHashes.add(item.imageHash);
      }
    }
  }
  const pending = new Map(stored.filter(item => item.status === "pending").map(item => [String(item._id), item]));
  return { pending: [...pending.values()].sort((a, b) => a.imageNumber - b.imageNumber), repeated };
}

export async function processTelecomInvoiceTurn(input: Scope & { messageId: string; messageAt: Date; messages: ChatSourceMessage[] }): Promise<TelecomInvoiceReply | undefined> {
  const { companyCode, pageId, platform, conversationId, messageAt, messageId } = input;
  const grouped = splitHistoryAndPendingInboundMessages(input.messages);
  const allImages = imageSources(grouped.pendingMessages);
  const latestText = grouped.pendingMessages.filter(message => message.text?.trim()).at(-1)?.text || "";
  const commands = parseInvoiceCommands(grouped.combinedText).filter(command => command.type !== "yes" || parseInvoiceCommands(latestText).some(last => last.type === "yes"));
  if (!allImages.length && !commands.length) return;

  const settings = await TelecomInvoiceSettingsModel.findOne(enabledTelecomInvoiceAccount(input)).select("subscriberFieldKey zalo.subscriberFieldKey").lean();
  if (!settings) return;

  const account = { companyCode, pageId, platform, conversationId };
  const scope = invoiceConversationFilter(account);
  const leadFields = allImages.length ? await readActiveInvoiceLeadFields(account) : [];
  const configuredKey = platform === "zalo" ? settings.zalo?.subscriberFieldKey : settings.subscriberFieldKey;
  const subscriberField = findSubscriberField(leadFields, configuredKey);
  const batch = subscriberField ? await ingestImages(account, allImages.slice(0, MAX_IMAGES), leadFields, subscriberField.key) : { pending: [], repeated: 0 };
  const notices: string[] = [];
  for (const draft of batch.pending) {
    if (!draft.autoEligible) continue;
    const result = await saveTelecomInvoice(draft, { mode: "automatic", messageId });
    if (result === "ambiguous") notices.push(`Ảnh ${draft.imageNumber} · Em cần nhân viên kiểm tra lại hồ sơ của mã thuê bao này trước khi ghi nhận hóa đơn.`);
  }
  const [active, resolved] = await Promise.all([
    TelecomInvoiceModel.find({ ...scope, status: "pending", autoEligible: { $ne: true }, expiresAt: { $gt: new Date() } }).sort({ imageNumber: 1 }).lean(),
    TelecomInvoiceModel.find({ ...scope, resolvedByMessageId: messageId }).sort({ imageNumber: 1 }).lean(),
  ]);
  const pending = new Map(active.map(draft => [draft.imageNumber, draft]));
  const previews = new Map(batch.pending.filter(draft => pending.has(draft.imageNumber)).map(draft => [draft.imageNumber, draft]));
  const canConfirm = (draft: StoredInvoice) => draft.presentedRevision === draft.revision && draft.presentedAt && draft.presentedAt <= messageAt;
  const missingFields = missingInvoiceFields;
  const lastOutbound = [...grouped.historyMessages].reverse().find(message => message.direction === "outbound");
  const replyToSummary = active.some(draft => canConfirm(draft) && lastOutbound?.messageId && draft.presentedMessageId === lastOutbound.messageId);

  if (allImages.length > MAX_IMAGES && (batch.pending.length || batch.repeated || resolved.length)) notices.push(`Em đã đọc tối đa ${MAX_IMAGES} ảnh trong lượt này. Anh/chị gửi lại các ảnh còn lại trong lượt sau nhé.`);
  if (batch.repeated) notices.push(`Em đã bỏ qua ${batch.repeated} ảnh gửi trùng.`);
  if (allImages.length && !subscriberField) notices.push("Em chưa thể đọc hóa đơn tự động lúc này. Anh/chị có thể nhờ nhân viên hỗ trợ đối chiếu ảnh giúp em nhé.");
  for (const draft of resolved) {
    notices.push(draft.status === "confirmed" ? `Em đã ghi nhận hóa đơn ảnh ${draft.imageNumber}.`
      : `Ảnh ${draft.imageNumber} ${draft.status === "duplicate" ? "là hóa đơn đã được ghi nhận trước đó." : "đã được bỏ qua."}`);
  }

  // Apply edits first. An edit always invalidates confirmation of the previous preview.
  const edited = new Set<number>();
  for (const command of commands) {
    if (command.type !== "edit") continue;
    const draft = pending.get(command.image);
    if (!draft || !canConfirm(draft) && draft.editMessageId !== messageId && !edited.has(command.image)) continue;
    edited.add(command.image);
    const field = findInvoiceEditField(draft, command);
    const value = field && (draft.leadFields ? normalizeInvoiceLeadValue(field, command.value, draft.subscriberFieldKey!)
      : normalizeInvoiceValue(field.key as TelecomInvoiceField, command.value));
    if (!field || value === undefined) {
      notices.push(field ? `Ảnh ${command.image} · Anh/chị kiểm tra và gửi lại ${field.label.toLowerCase()} giúp em nhé.`
        : `Ảnh ${command.image} · Anh/chị ghi rõ tên trường như trong bản đối chiếu giúp em nhé.`);
      previews.set(draft.imageNumber, draft);
      continue;
    }
    if (draft.values[field.key] !== value) {
      const updated = await TelecomInvoiceModel.findOneAndUpdate({ _id: draft._id, ...scope, status: "pending", revision: draft.revision }, {
        $set: { [`values.${field.key}`]: value, editMessageId: messageId, expiresAt: draftExpiry() },
        $pull: { unclearFields: field.key },
        $inc: { revision: 1 },
      }, { returnDocument: "after" }).lean();
      if (!updated) continue;
      pending.set(command.image, updated);
      previews.set(command.image, updated);
    } else previews.set(command.image, draft);
  }

  for (const command of commands) {
    if (command.type === "edit") continue;
    if (command.type === "show") {
      for (const draft of active.slice(0, MAX_IMAGES)) previews.set(draft.imageNumber, pending.get(draft.imageNumber)!);
      continue;
    }
    if (command.type === "yes" && !replyToSummary) continue;
    if (command.type === "yes" && pending.size > 1) {
      notices.push("Anh/chị muốn xác nhận ảnh nào? Có thể nhắn «Xác nhận ảnh 1» hoặc «Xác nhận tất cả» nếu các ảnh đều đúng.");
      continue;
    }
    const targets = command.type === "confirm" || command.type === "skip" ? command.images : [...pending.keys()];
    if (command.type === "all" && [...pending.values()].some(draft => edited.has(draft.imageNumber) || !canConfirm(draft) || missingFields(draft).length)) {
      notices.push("Một số ảnh còn thiếu thông tin hoặc đang chờ kiểm tra lại. Anh/chị có thể xác nhận riêng những ảnh đã đúng.");
      for (const draft of [...pending.values()].slice(0, MAX_IMAGES)) previews.set(draft.imageNumber, draft);
      continue;
    }
    for (const number of new Set(targets)) {
      const draft = pending.get(number);
      if (!draft || edited.has(number)) continue;
      if (command.type === "skip") {
        const result = await TelecomInvoiceModel.updateOne({ ...scope, _id: draft._id, revision: draft.revision, status: "pending" },
          { $set: { status: "skipped", resolvedByMessageId: messageId } });
        if (result.modifiedCount) notices.push(`Em đã bỏ qua ảnh ${number}.`);
        pending.delete(number);
        previews.delete(number);
        continue;
      }
      if (!canConfirm(draft) || missingFields(draft).length) {
        previews.set(number, draft);
        continue;
      }
      const result = await saveTelecomInvoice(draft, { mode: "review", messageId, messageAt });
      if (result === "stale") continue;
      if (result === "ambiguous") {
        notices.push(`Ảnh ${number} · Em cần nhân viên kiểm tra lại hồ sơ của mã thuê bao này trước khi ghi nhận hóa đơn.`);
        continue;
      }
      pending.delete(number);
      previews.delete(number);
      notices.push(result === "duplicate" ? `Ảnh ${number} là hóa đơn đã được ghi nhận trước đó.` : `Em đã ghi nhận hóa đơn ảnh ${number}.`);
    }
  }

  const rows = [...previews.values()].sort((a, b) => a.imageNumber - b.imageNumber).slice(0, MAX_IMAGES);
  if (rows.length) {
    for (const draft of rows) {
      const issue = draft.imageIssue ?? (draft.readFailed ? "unreadable" : undefined);
      const row = issue && !Object.keys(draft.values).length
        ? `Ảnh ${draft.imageNumber} · ${imageIssueText[issue]}`
        : summarizeInvoice(draft.imageNumber, draft);
      notices.push(row);
      if (draft.unclearFields?.length) notices.push(`Ảnh ${draft.imageNumber} có chỗ chưa đọc rõ. Anh/chị gửi ảnh rõ hơn hoặc nhắn lại các mục đó giúp em nhé.`);
    }
    const example = rows.find(draft => !missingFields(draft).length);
    if (example) notices.push(`Nếu thông tin đúng, anh/chị nhắn «Xác nhận ảnh ${example.imageNumber}».`);
    const incomplete = rows.find(draft => missingFields(draft).length);
    if (incomplete) {
      const label = missingFields(incomplete)[0].label;
      notices.push(`Để bổ sung hoặc sửa, anh/chị nhắn «Ảnh ${incomplete.imageNumber}: ${label} là …». Có thể nhắn «Bỏ ảnh ${incomplete.imageNumber}» nếu đã gửi ảnh thay thế.`);
    } else if (pending.size > 1 && [...pending.values()].every(draft => !missingFields(draft).length && (canConfirm(draft) || rows.includes(draft)))) {
      notices.push("Nếu tất cả đều đúng, anh/chị nhắn «Xác nhận tất cả».");
    }
  }
  if (!notices.length) return;
  return { text: notices.join("\n"), presentations: rows.map(draft => ({ id: draft._id, revision: draft.revision })) };
}

export async function markTelecomInvoiceReplyDelivered(reply: TelecomInvoiceReply, messageId: string, presentedAt: Date) {
  if (!reply.presentations.length) return;
  await TelecomInvoiceModel.bulkWrite(reply.presentations.map(({ id, revision }) => ({
    updateOne: { filter: { _id: id, revision, status: "pending" as const },
      update: { $set: { presentedRevision: revision, presentedMessageId: messageId, presentedAt } } },
  })));
}

export function splitTelecomInvoiceReply(text: string, platform: TelecomInvoicePlatform): string[] {
  const limit = platform === "zalo" ? 900 : 1800;
  const messages: string[] = [];
  for (let line of text.split("\n")) {
    if (line.length > limit) {
      while (line.length > limit) {
        const separator = line.lastIndexOf(" · ", limit);
        const space = line.lastIndexOf(" ", limit);
        const splitAt = separator > limit / 2 ? separator : space > limit / 2 ? space : limit;
        messages.push(line.slice(0, splitAt));
        line = line.slice(splitAt).trimStart().replace(/^· /, "");
      }
    }
    const last = messages.at(-1);
    if (last && last.length + line.length < limit) messages[messages.length - 1] = `${last}\n${line}`;
    else messages.push(line);
  }
  return messages;
}
