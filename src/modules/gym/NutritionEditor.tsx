import { useState } from "react";
import type { GymApi } from "./api";
import type { GymList } from "../../../shared/gym/types";
import { Field, Feedback, panel, secondary, useGymQuery } from "./ui";
export function NutritionCalculator({
  onApply,
}: {
  onApply: (values: Record<string, number>) => void;
}) {
  const [input, setInput] = useState({
    weight: 60,
    height: 165,
    age: 30,
    gender: "FEMALE",
    activity: 1.2,
  });
  const bmr = Math.round(
    10 * input.weight +
      6.25 * input.height -
      5 * input.age +
      (input.gender === "MALE" ? 5 : -161),
  );
  return (
    <details className={panel}>
      <summary className="cursor-pointer">Tính BMR / TDEE</summary>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {[
          ["weight", "Cân nặng (kg)"],
          ["height", "Chiều cao (cm)"],
          ["age", "Tuổi"],
        ].map(([key, label]) => (
          <Field
            key={key}
            label={label}
            type="number"
            min={1}
            value={input[key as "weight"]}
            onChange={(value) => setInput({ ...input, [key]: Number(value) })}
          />
        ))}
        <Field
          label="Giới tính"
          value={input.gender}
          options={[
            ["MALE", "Nam"],
            ["FEMALE", "Nữ"],
          ]}
          onChange={(gender) => setInput({ ...input, gender })}
        />
        <Field
          label="Mức độ vận động"
          value={String(input.activity)}
          options={[
            ["1.2", "Ít vận động"],
            ["1.375", "Vận động nhẹ"],
            ["1.55", "Vận động vừa"],
            ["1.725", "Vận động nhiều"],
          ]}
          onChange={(activity) =>
            setInput({ ...input, activity: Number(activity) })
          }
        />
      </div>
      <p className="my-3 tabular-nums">
        BMR: {bmr} kcal — TDEE: {Math.round(bmr * input.activity)} kcal
      </p>
      <button
        type="button"
        className={secondary}
        onClick={() =>
          onApply({
            bmr,
            tdee: Math.round(bmr * input.activity),
            targetCalories: Math.round(bmr * input.activity),
          })
        }
      >
        Áp dụng
      </button>
    </details>
  );
}
export default function NutritionEditor({
  api,
  menu,
  macros,
  onMenu,
  onMacros,
}: {
  api: GymApi;
  menu: any[];
  macros: Record<string, number>;
  onMenu: (rows: any[]) => void;
  onMacros: (value: Record<string, number>) => void;
}) {
  const [search, setSearch] = useState("");
  const images = useGymQuery<GymList>(
    api,
    `/food-images?limit=100&search=${encodeURIComponent(search)}`,
  );
  const update = (index: number, key: string, value: any) =>
    onMenu(
      menu.map((row, i) => (i === index ? { ...row, [key]: value } : row)),
    );
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["protein", "Protein (g)"],
          ["carbs", "Carb (g)"],
          ["fat", "Fat (g)"],
        ].map(([key, label]) => (
          <Field
            key={key}
            label={label}
            required
            type="number"
            min={0}
            value={macros[key]}
            onChange={(value) => onMacros({ ...macros, [key]: Number(value) })}
          />
        ))}
      </div>
      <Field label="Tìm ảnh món ăn" value={search} onChange={setSearch} />
      <Feedback error={images.error} />
      {menu.map((meal, i) => (
        <div key={i} className={panel}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Bữa ăn"
              value={meal.name}
              required
              onChange={(value) => update(i, "name", value)}
            />
            <Field
              label="Giờ ăn"
              type="time"
              value={meal.time}
              onChange={(value) => update(i, "time", value)}
            />
          </div>
          <Field
            label="Món ăn"
            multiline
            value={meal.foods}
            onChange={(value) => update(i, "foods", value)}
          />
          <div className="my-3 grid gap-3 sm:grid-cols-4">
            {[
              ["calories", "Calories"],
              ["protein", "Protein (g)"],
              ["carbs", "Carb (g)"],
              ["fat", "Fat (g)"],
            ].map(([key, label]) => (
              <Field
                key={key}
                label={label}
                required
                type="number"
                min={0}
                value={meal[key]}
                onChange={(value) => update(i, key, value)}
              />
            ))}
          </div>
          <Field
            label="Ảnh món ăn"
            value={meal.imageId || ""}
            options={[
              ["", "Không chọn ảnh"],
              ...(images.data?.data || []).map(
                (image) => [image._id, image.name] as [string, string],
              ),
            ]}
            onChange={(id) => {
              const image = images.data?.data.find((row) => row._id === id);
              onMenu(
                menu.map((row, index) =>
                  index === i
                    ? { ...row, imageId: id, imageUrl: image?.imageUrl || "" }
                    : row,
                ),
              );
            }}
          />
          {meal.imageUrl && (
            <img
              className="my-3 size-24 rounded-md object-cover"
              src={meal.imageUrl}
              alt={meal.name}
            />
          )}
          <button
            type="button"
            className={secondary}
            onClick={() => onMenu(menu.filter((_, index) => index !== i))}
          >
            Xóa bữa ăn
          </button>
        </div>
      ))}
      <button
        type="button"
        className={secondary}
        onClick={() =>
          onMenu([
            ...menu,
            {
              name: "",
              time: "",
              foods: "",
              calories: 0,
              protein: 0,
              carbs: 0,
              fat: 0,
            },
          ])
        }
      >
        Thêm bữa ăn
      </button>
    </div>
  );
}
