// Cố định múi giờ VN cho mọi phép tính ngày giờ phía server (hạn công việc,
// lịch quy trình...). Module này phải được import ĐẦU TIÊN trong server.ts —
// import ESM được hoist nên gán trực tiếp trong server.ts sẽ chạy sau các import khác.
// Có hiệu lực trên môi trường deploy Linux; máy Windows dev dùng giờ hệ thống.
process.env.TZ = process.env.TZ || "Asia/Ho_Chi_Minh";

export {};
