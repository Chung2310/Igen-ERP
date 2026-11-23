import { describe, expect, it } from "vitest";
import { appendGymKnowledgeCitations } from "../../assistant/general-answer";

describe("Gym Knowledge Base RAG citation helper", () => {
  it("appends unique source citations when hits are provided and not already cited", () => {
    const reply = appendGymKnowledgeCitations(
      "Ngưỡng tỷ lệ mỡ lý tưởng ở nam là 10–20%.",
      [
        {
          documentId: "doc1",
          title: "Quy trình đọc & tư vấn chỉ số InBody chuẩn PT",
          topic: "INBODY",
          content: "Ngưỡng % mỡ lý tưởng: Nam 10–20%",
          score: 0.82,
        },
        {
          documentId: "doc1",
          title: "Quy trình đọc & tư vấn chỉ số InBody chuẩn PT",
          topic: "INBODY",
          content: "Đoạn 2",
          score: 0.65,
        },
      ],
    );
    expect(reply).toContain("Nguồn tham khảo (Kho tri thức Gym):");
    expect(reply.match(/Quy trình đọc & tư vấn chỉ số InBody chuẩn PT/g)?.length).toBe(1);
  });

  it("does not duplicate citations when already mentioned in reply", () => {
    const original =
      "Theo tài liệu Quy trình đọc & tư vấn chỉ số InBody chuẩn PT, mỡ nội tạng an toàn <= Level 9.";
    expect(
      appendGymKnowledgeCitations(original, [
        {
          documentId: "doc1",
          title: "Quy trình đọc & tư vấn chỉ số InBody chuẩn PT",
          topic: "INBODY",
          content: "...",
          score: 0.7,
        },
      ]),
    ).toBe(original);
  });
});
