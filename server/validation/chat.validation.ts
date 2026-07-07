import Joi from "joi";

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const createRoomSchema = {
  body: Joi.object({
    isGroup: Joi.boolean().required().messages({
      "any.required": "Trường 'isGroup' là bắt buộc.",
      "boolean.base": "Trường 'isGroup' phải là kiểu boolean.",
    }),
    memberIds: Joi.array()
      .items(Joi.string().regex(objectIdRegex).messages({
        "string.pattern.base": "Mã thành viên 'memberIds' phải đúng định dạng MongoDB ObjectId.",
      }))
      .min(1)
      .required()
      .messages({
        "any.required": "Danh sách thành viên 'memberIds' là bắt buộc.",
        "array.base": "Danh sách thành viên 'memberIds' phải là một mảng.",
        "array.min": "Danh sách thành viên 'memberIds' phải có ít nhất 1 thành viên.",
      }),
    name: Joi.string().when("isGroup", {
      is: true,
      then: Joi.required().messages({
        "any.required": "Tên nhóm 'name' là bắt buộc khi tạo phòng chat nhóm.",
      }),
      otherwise: Joi.optional().allow(""),
    }),
    avatarURL: Joi.string().uri().optional().allow("").messages({
      "string.uri": "Ảnh đại diện 'avatarURL' phải là một URL hợp lệ.",
    }),
  }),
};

export const updateRoomSchema = {
  params: Joi.object({
    roomId: Joi.string().regex(objectIdRegex).required().messages({
      "any.required": "Mã phòng 'roomId' là bắt buộc trên url.",
      "string.pattern.base": "Mã phòng 'roomId' không đúng định dạng.",
    }),
  }),
  body: Joi.object({
    name: Joi.string().optional().allow("").messages({
      "string.base": "Tên phòng phải là kiểu văn bản.",
    }),
    avatarURL: Joi.string().uri().optional().allow("").messages({
      "string.uri": "Ảnh đại diện phải là một URL hợp lệ.",
    }),
  }),
};

export const roomIdParamsSchema = {
  params: Joi.object({
    roomId: Joi.string().regex(objectIdRegex).required().messages({
      "any.required": "Mã phòng 'roomId' là bắt buộc.",
      "string.pattern.base": "Mã phòng 'roomId' không đúng định dạng.",
    }),
  }),
};

export const addMembersSchema = {
  params: Joi.object({
    roomId: Joi.string().regex(objectIdRegex).required().messages({
      "any.required": "Mã phòng 'roomId' là bắt buộc.",
      "string.pattern.base": "Mã phòng 'roomId' không đúng định dạng.",
    }),
  }),
  body: Joi.object({
    memberIds: Joi.array()
      .items(Joi.string().regex(objectIdRegex).messages({
        "string.pattern.base": "Mã thành viên 'memberIds' phải đúng định dạng MongoDB ObjectId.",
      }))
      .min(1)
      .required()
      .messages({
        "any.required": "Danh sách thành viên thêm mới 'memberIds' là bắt buộc.",
        "array.base": "Danh sách thành viên phải là một mảng.",
        "array.min": "Cần cung cấp ít nhất 1 thành viên để thêm.",
      }),
  }),
};

export const removeMemberSchema = {
  params: Joi.object({
    roomId: Joi.string().regex(objectIdRegex).required().messages({
      "any.required": "Mã phòng 'roomId' là bắt buộc.",
      "string.pattern.base": "Mã phòng 'roomId' không đúng định dạng.",
    }),
    userId: Joi.string().regex(objectIdRegex).required().messages({
      "any.required": "Mã người dùng cần xóa 'userId' là bắt buộc.",
      "string.pattern.base": "Mã người dùng cần xóa 'userId' không đúng định dạng.",
    }),
  }),
};

export const sendMessageSchema = {
  params: Joi.object({
    roomId: Joi.string().regex(objectIdRegex).required().messages({
      "any.required": "Mã phòng 'roomId' là bắt buộc.",
      "string.pattern.base": "Mã phòng 'roomId' không đúng định dạng.",
    }),
  }),
  body: Joi.object({
    content: Joi.string().optional().allow("").default(""),
    replyTo: Joi.string().regex(objectIdRegex).optional().messages({
      "string.pattern.base": "Mã tin nhắn trả lời 'replyTo' không đúng định dạng.",
    }),
    attachments: Joi.array()
      .items(
        Joi.object({
          url: Joi.string().uri().required().messages({
            "any.required": "Đường dẫn tệp đính kèm 'url' là bắt buộc.",
            "string.uri": "Đường dẫn tệp đính kèm 'url' phải là URL hợp lệ.",
          }),
          name: Joi.string().required().messages({
            "any.required": "Tên tệp đính kèm 'name' là bắt buộc.",
          }),
          type: Joi.string().required().messages({
            "any.required": "Kiểu tệp đính kèm 'type' là bắt buộc.",
          }),
          size: Joi.number().optional(),
        })
      )
      .optional()
      .default([]),
  }).or("content", "attachments").messages({
    "object.missing": "Nội dung tin nhắn hoặc tệp đính kèm không được để trống.",
  }),
};

export const getMessagesSchema = {
  params: Joi.object({
    roomId: Joi.string().regex(objectIdRegex).required().messages({
      "any.required": "Mã phòng 'roomId' là bắt buộc.",
      "string.pattern.base": "Mã phòng 'roomId' không đúng định dạng.",
    }),
  }),
  query: Joi.object({
    limit: Joi.number().integer().min(1).max(100).optional().default(50),
    beforeDate: Joi.date().iso().optional().messages({
      "date.format": "Tham số 'beforeDate' phải đúng định dạng ngày giờ ISO.",
    }),
  }),
};

export const updateMemberRoleSchema = {
  params: Joi.object({
    roomId: Joi.string().regex(objectIdRegex).required().messages({
      "any.required": "Mã phòng 'roomId' là bắt buộc.",
      "string.pattern.base": "Mã phòng 'roomId' không đúng định dạng.",
    }),
    userId: Joi.string().regex(objectIdRegex).required().messages({
      "any.required": "Mã người dùng 'userId' là bắt buộc.",
      "string.pattern.base": "Mã người dùng 'userId' không đúng định dạng.",
    }),
  }),
  body: Joi.object({
    role: Joi.string().valid("admin", "member").required().messages({
      "any.required": "Trường 'role' là bắt buộc.",
      "any.only": "Trường 'role' chỉ được nhận giá trị 'admin' hoặc 'member'.",
    }),
  }),
};

export const pinMessageSchema = {
  params: Joi.object({
    roomId: Joi.string().regex(objectIdRegex).required().messages({
      "any.required": "Mã phòng 'roomId' là bắt buộc.",
      "string.pattern.base": "Mã phòng 'roomId' không đúng định dạng.",
    }),
  }),
  body: Joi.object({
    messageId: Joi.string().regex(objectIdRegex).required().messages({
      "any.required": "Mã tin nhắn 'messageId' là bắt buộc.",
      "string.pattern.base": "Mã tin nhắn 'messageId' không đúng định dạng.",
    }),
  }),
};

export const unpinMessageSchema = {
  params: Joi.object({
    roomId: Joi.string().regex(objectIdRegex).required().messages({
      "any.required": "Mã phòng 'roomId' là bắt buộc.",
      "string.pattern.base": "Mã phòng 'roomId' không đúng định dạng.",
    }),
  }),
  body: Joi.object({
    messageId: Joi.string().regex(objectIdRegex).required().messages({
      "any.required": "Mã tin nhắn 'messageId' là bắt buộc.",
      "string.pattern.base": "Mã tin nhắn 'messageId' không đúng định dạng.",
    }),
  }),
};

export const deleteMessageSchema = {
  params: Joi.object({
    roomId: Joi.string().regex(objectIdRegex).required().messages({
      "any.required": "Mã phòng 'roomId' là bắt buộc.",
      "string.pattern.base": "Mã phòng 'roomId' không đúng định dạng.",
    }),
    messageId: Joi.string().regex(objectIdRegex).required().messages({
      "any.required": "Mã tin nhắn 'messageId' là bắt buộc.",
      "string.pattern.base": "Mã tin nhắn 'messageId' không đúng định dạng.",
    }),
  }),
};

export const reactMessageSchema = {
  params: Joi.object({
    roomId: Joi.string().regex(objectIdRegex).required().messages({
      "any.required": "Mã phòng 'roomId' là bắt buộc.",
      "string.pattern.base": "Mã phòng 'roomId' không đúng định dạng.",
    }),
    messageId: Joi.string().regex(objectIdRegex).required().messages({
      "any.required": "Mã tin nhắn 'messageId' là bắt buộc.",
      "string.pattern.base": "Mã tin nhắn 'messageId' không đúng định dạng.",
    }),
  }),
  body: Joi.object({
    emoji: Joi.string().trim().min(1).max(16).required().messages({
      "any.required": "Thiếu emoji cảm xúc.",
      "string.empty": "Emoji không được để trống.",
    }),
  }),
};

export const linkPreviewSchema = {
  query: Joi.object({
    url: Joi.string().uri({ scheme: ["http", "https"] }).required().messages({
      "any.required": "Thiếu tham số 'url'.",
      "string.uri": "URL phải là đường dẫn http/https hợp lệ.",
    }),
  }),
};

export const editMessageSchema = {
  params: Joi.object({
    roomId: Joi.string().regex(objectIdRegex).required().messages({
      "any.required": "Mã phòng 'roomId' là bắt buộc.",
      "string.pattern.base": "Mã phòng 'roomId' không đúng định dạng.",
    }),
    messageId: Joi.string().regex(objectIdRegex).required().messages({
      "any.required": "Mã tin nhắn 'messageId' là bắt buộc.",
      "string.pattern.base": "Mã tin nhắn 'messageId' không đúng định dạng.",
    }),
  }),
  body: Joi.object({
    content: Joi.string().trim().min(1).max(5000).required().messages({
      "any.required": "Nội dung tin nhắn là bắt buộc.",
      "string.empty": "Nội dung tin nhắn không được để trống.",
    }),
  }),
};

export const searchMessagesSchema = {
  params: Joi.object({
    roomId: Joi.string().regex(objectIdRegex).required().messages({
      "any.required": "Mã phòng 'roomId' là bắt buộc.",
      "string.pattern.base": "Mã phòng 'roomId' không đúng định dạng.",
    }),
  }),
  query: Joi.object({
    query: Joi.string().optional().allow("").default(""),
    type: Joi.string().valid("text", "link", "file", "media", "all").optional().default("all").messages({
      "any.only": "Trường 'type' chỉ được nhận các giá trị 'text', 'link', 'file', 'media', 'all'.",
    }),
  }),
};



