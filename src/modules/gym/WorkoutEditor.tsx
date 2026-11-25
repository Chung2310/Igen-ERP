import { useState } from "react";
import type { GymApi } from "./api";
import type { GymList } from "../../../shared/gym/types";
import { Field, Feedback, secondary, panel, useGymQuery } from "./ui";
export function ExerciseRows({
  api,
  rows,
  onChange,
}: {
  api: GymApi;
  rows: any[];
  onChange: (rows: any[]) => void;
}) {
  const [search, setSearch] = useState("");
  const query = useGymQuery<GymList>(
    api,
    `/exercises?limit=100&search=${encodeURIComponent(search)}`,
  );
  const update = (index: number, key: string, value: any) =>
    onChange(
      rows.map((row, i) => (i === index ? { ...row, [key]: value } : row)),
    );
  return (
    <div className="space-y-3">
      <Field
        label="Tìm bài tập"
        value={search}
        onChange={setSearch}
        placeholder="Tìm kiếm bài tập..."
      />
      <Feedback error={query.error} loading={query.loading} />
      <Field
        label="Thêm bài tập"
        value=""
        options={[
          ["", "Chọn bài tập"],
          ...(query.data?.data || []).map(
            (e) => [e._id, e.name] as [string, string],
          ),
        ]}
        onChange={(id) => {
          const item = query.data?.data.find((e) => e._id === id);
          if (item)
            onChange([
              ...rows,
              {
                exerciseId: item._id,
                name: item.name,
                sets: 3,
                reps: "12",
                weight: 0,
                duration: 0,
                distance: 0,
                restSeconds: 60,
                notes: "",
              },
            ]);
        }}
      />
      {rows.map((row, i) => (
        <div key={`${row.exerciseId}-${i}`} className={panel}>
          <div className="flex justify-between gap-2">
            <strong>{row.name}</strong>
            <button
              className={secondary}
              type="button"
              aria-label={`Xóa bài tập ${row.name}`}
              onClick={() => onChange(rows.filter((_, j) => j !== i))}
            >
              Xóa
            </button>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {[
              ["sets", "Sets"],
              ["reps", "Reps"],
              ["weight", "Tạ (kg)"],
              ["duration", "Thời gian (phút)"],
              ["distance", "Quãng đường (m)"],
              ["restSeconds", "Nghỉ (giây)"],
            ].map(([key, label]) => (
              <Field
                key={key}
                label={label}
                value={row[key]}
                type={key === "reps" ? "text" : "number"}
                min={0}
                onChange={(value) => update(i, key, value)}
              />
            ))}
          </div>
          <Field
            label="Ghi chú"
            value={row.notes}
            onChange={(value) => update(i, "notes", value)}
          />
        </div>
      ))}
    </div>
  );
}
export default function WorkoutEditor({
  api,
  schedule,
  onChange,
}: {
  api: GymApi;
  schedule: any[];
  onChange: (schedule: any[]) => void;
}) {
  return (
    <section className="space-y-3">
      <h3 className="text-balance font-semibold">Lịch tập</h3>
      {schedule.map((day, index) => (
        <div key={index} className={panel}>
          <div className="mb-3 grid gap-3 sm:grid-cols-3">
            <Field
              label="Ngày"
              value={day.day}
              type="number"
              min={1}
              required
              onChange={(value) =>
                onChange(
                  schedule.map((d, i) =>
                    i === index ? { ...d, day: value } : d,
                  ),
                )
              }
            />
            <Field
              label="Tên buổi tập"
              value={day.title}
              onChange={(value) =>
                onChange(
                  schedule.map((d, i) =>
                    i === index ? { ...d, title: value } : d,
                  ),
                )
              }
            />
            <button
              className={secondary}
              type="button"
              onClick={() => onChange(schedule.filter((_, i) => i !== index))}
            >
              Xóa buổi tập
            </button>
          </div>
          <ExerciseRows
            api={api}
            rows={day.exercises}
            onChange={(exercises) =>
              onChange(
                schedule.map((d, i) => (i === index ? { ...d, exercises } : d)),
              )
            }
          />
        </div>
      ))}
      <button
        className={secondary}
        type="button"
        onClick={() =>
          onChange([
            ...schedule,
            { day: schedule.length + 1, title: "", exercises: [] },
          ])
        }
      >
        Thêm buổi tập
      </button>
    </section>
  );
}
