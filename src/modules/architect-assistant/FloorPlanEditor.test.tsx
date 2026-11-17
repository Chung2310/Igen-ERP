// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ArchitecturePlan } from "../../shared/architecture-assistant";
import FloorPlanEditor from "./FloorPlanEditor";

afterEach(cleanup);

const plan: ArchitecturePlan = {
  rooms: [{ id: "living", name: "Phòng khách", floor: 1, x: 0, y: 0, width: 40, height: 35, areaM2: 28 }],
  notes: "",
};

describe("FloorPlanEditor", () => {
  it("adds a room and exposes it as a selectable control", async () => {
    const onChange = vi.fn();
    render(<FloorPlanEditor plan={plan} onChange={onChange} />);

    await userEvent.click(screen.getByRole("button", { name: "Thêm phòng" }));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      rooms: [...plan.rooms, expect.objectContaining({ name: "Phòng mới", areaM2: 12 })],
    }));
    expect(screen.getByRole("button", { name: /Phòng khách/ })).toBeTruthy();
  });

  it("edits room details through labeled form fields", async () => {
    const onChange = vi.fn();
    render(<FloorPlanEditor plan={plan} onChange={onChange} />);
    const name = screen.getByRole("textbox", { name: "Tên phòng" });

    fireEvent.change(name, { target: { value: "Phòng sinh hoạt" } });

    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      rooms: [expect.objectContaining({ id: "living", name: "Phòng sinh hoạt" })],
    }));
  });

  it("shows the selected floor in the 3D block preview", async () => {
    const secondFloor = { ...plan, rooms: [{ ...plan.rooms[0], id: "bedroom", name: "Phòng ngủ", floor: 2 }] };
    render(<FloorPlanEditor plan={secondFloor} onChange={vi.fn()} floor={2} />);

    await userEvent.click(screen.getByRole("button", { name: "3D" }));

    const preview = screen.getByRole("img", { name: "Mô hình khối 3D minh họa tầng 2" });
    expect(preview.textContent).toContain("Phòng ngủ");
  });

  it("adds editable furniture and openings to the selected room", async () => {
    const onChange = vi.fn();
    render(<FloorPlanEditor plan={plan} onChange={onChange} />);

    await userEvent.click(screen.getByRole("button", { name: "Thêm nội thất" }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      furniture: [expect.objectContaining({ roomId: "living", type: "Giường", width: 25, height: 20 })],
    }));

    await userEvent.click(screen.getByRole("button", { name: "Thêm cửa" }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      openings: [expect.objectContaining({ roomId: "living", type: "door", wall: "north" })],
    }));
  });

  it("stores finish selections on their room for later rendering", async () => {
    const onChange = vi.fn();
    render(<FloorPlanEditor plan={plan} onChange={onChange} />);

    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Sàn" }), "Terrazzo");

    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      rooms: [expect.objectContaining({ id: "living", finishes: { flooring: "Terrazzo" } })],
    }));
  });
});
