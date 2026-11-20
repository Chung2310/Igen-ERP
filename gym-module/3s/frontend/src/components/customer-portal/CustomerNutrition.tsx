import { useState } from 'react';
import {
  Apple,
  Calendar,
  CheckCircle,
  ChevronDown,
  Clock,
  Droplet,
  Flame,
  Info,
  Salad,
  Sparkles,
  Utensils,
  Zap,
} from 'lucide-react';
import MealImagePreviewModal from '../nutrition/MealImagePreviewModal';
import type { CustomerJourneyDto, CustomerNutritionPlanDto, NutritionPlanMenuItem } from '../../types';

interface CustomerNutritionProps {
  journey: CustomerJourneyDto;
}

export default function CustomerNutrition({ journey }: CustomerNutritionProps) {
  const { nutritionPlans } = journey;

  // Priority: find the plan currently active today (between startDate and endDate)
  const now = new Date();
  const currentScheduledPlan = nutritionPlans?.find((p) => {
    if (!p.startDate) return false;
    const start = new Date(p.startDate);
    const end = p.endDate
      ? new Date(p.endDate)
      : new Date(start.getTime() + ((p.durationDays || 7) - 1) * 86400000);
    end.setHours(23, 59, 59, 999);
    return now >= start && now <= end;
  });

  const activeNutrition = currentScheduledPlan || (nutritionPlans && nutritionPlans.length > 0 ? nutritionPlans[0] : null);
  const historyNutrition = nutritionPlans ? nutritionPlans.filter((p) => p._id !== activeNutrition?._id) : [];

  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [selectedPortalWeek, setSelectedPortalWeek] = useState<number>(0);
  const [selectedPortalDay, setSelectedPortalDay] = useState<number>(0);
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);

  // Meal breakdown & Hierarchical Detection
  const rawMenu = activeNutrition?.menu;
  const isHierarchical = Array.isArray(rawMenu) && rawMenu.length > 0 && Boolean((rawMenu[0] as any)?.days);
  const weeksData = isHierarchical ? (rawMenu as any[]) : [];
  const currentWeek = weeksData[selectedPortalWeek] || weeksData[0];
  const currentDay = currentWeek?.days?.[selectedPortalDay] || currentWeek?.days?.[0];
  const activeDayMeals: any[] = isHierarchical ? (currentDay?.meals || []) : [];

  // Macros and calorie calculations
  const targetCalories = activeNutrition?.targetCalories || 2000;
  const proteinG = activeNutrition?.macros?.protein || 150;
  const carbsG = activeNutrition?.macros?.carbs || 200;
  const fatG = activeNutrition?.macros?.fat || 65;

  const proteinKcal = proteinG * 4;
  const carbsKcal = carbsG * 4;
  const fatKcal = fatG * 9;
  const totalKcalCalc = proteinKcal + carbsKcal + fatKcal || targetCalories;

  const proteinPct = Math.round((proteinKcal / totalKcalCalc) * 100) || 30;
  const carbsPct = Math.round((carbsKcal / totalKcalCalc) * 100) || 45;
  const fatPct = Math.round((fatKcal / totalKcalCalc) * 100) || 25;

  const menuItems: NutritionPlanMenuItem[] = !isHierarchical && Array.isArray(rawMenu) ? (rawMenu as NutritionPlanMenuItem[]) : [];

  return (
    <div className="space-y-6">
      {activeNutrition ? (
        <div className="space-y-6">
          {/* 2. CALORIE & MACRO OVERVIEW CARD */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-600 p-6 text-white">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 rounded-md bg-white/15 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider backdrop-blur-sm">
                    <Sparkles size={12} className="text-amber-300" />
                    Chế độ dinh dưỡng chuẩn
                  </div>
                  <h3 className="font-oswald text-2xl font-bold uppercase tracking-wide text-white md:text-3xl">
                    {activeNutrition.title}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-emerald-100">
                    {activeNutrition.startDate ? (
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-white/20 px-2.5 py-1 font-medium text-white shadow-xs backdrop-blur-xs">
                        <Calendar size={13} className="text-amber-300" />
                        Lịch áp dụng: {new Date(activeNutrition.startDate).toLocaleDateString('vi-VN')} - {new Date(activeNutrition.endDate || activeNutrition.startDate).toLocaleDateString('vi-VN')}
                        {activeNutrition.durationDays ? ` (${activeNutrition.durationDays} ngày)` : ''}
                      </span>
                    ) : (
                      <span>
                        Công bố ngày {activeNutrition.publishedAt ? new Date(activeNutrition.publishedAt).toLocaleDateString('vi-VN') : 'Gần đây'}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 rounded-2xl bg-white/10 p-4 backdrop-blur-md">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-400/20 text-amber-300">
                    <Flame size={28} />
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-emerald-200">Mục tiêu Năng lượng</div>
                    <div className="font-oswald text-3xl font-bold text-white">
                      {targetCalories.toLocaleString('vi-VN')}{' '}
                      <span className="text-sm font-normal text-emerald-200">Kcal / ngày</span>
                    </div>
                  </div>
                </div>
              </div>

              {(activeNutrition.bmr || activeNutrition.tdee) && (
                <div className="mt-4 flex flex-wrap gap-4 border-t border-emerald-600/50 pt-3 text-xs text-emerald-100">
                  {activeNutrition.bmr && (
                    <div>
                      Chuyển hóa cơ bản (BMR):{' '}
                      <strong className="text-white">{activeNutrition.bmr.toLocaleString('vi-VN')} Kcal</strong>
                    </div>
                  )}
                  {activeNutrition.tdee && (
                    <div>
                      Tổng tiêu hao hàng ngày (TDEE):{' '}
                      <strong className="text-white">{activeNutrition.tdee.toLocaleString('vi-VN')} Kcal</strong>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 3. MACRONUTRIENTS RATIO BARS */}
            <div className="p-6">
              <h4 className="mb-4 font-oswald text-lg font-bold uppercase text-slate-900">
                Tỷ lệ Đa lượng Nạp vào (Macronutrients)
              </h4>

              <div className="grid gap-4 md:grid-cols-3">
                {/* Protein */}
                <div className="rounded-xl border border-rose-100 bg-rose-50/50 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-rose-700">Protein (Chất Đạm)</span>
                    <span className="font-oswald text-sm font-bold text-rose-800">{proteinPct}%</span>
                  </div>
                  <div className="mt-2 font-oswald text-2xl font-bold text-slate-900">
                    {proteinG} <span className="text-xs font-normal text-slate-500">grams ({proteinKcal} kcal)</span>
                  </div>
                  <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-rose-100">
                    <div className="h-full rounded-full bg-rose-500" style={{ width: `${proteinPct}%` }} />
                  </div>
                  <p className="mt-2 text-[11px] text-slate-500">Phục hồi và xây dựng khối cơ nạc</p>
                </div>

                {/* Carbs */}
                <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-700">Carbohydrates (Tinh bột)</span>
                    <span className="font-oswald text-sm font-bold text-amber-800">{carbsPct}%</span>
                  </div>
                  <div className="mt-2 font-oswald text-2xl font-bold text-slate-900">
                    {carbsG} <span className="text-xs font-normal text-slate-500">grams ({carbsKcal} kcal)</span>
                  </div>
                  <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-amber-100">
                    <div className="h-full rounded-full bg-amber-500" style={{ width: `${carbsPct}%` }} />
                  </div>
                  <p className="mt-2 text-[11px] text-slate-500">Cung cấp năng lượng cho các buổi tập nặng</p>
                </div>

                {/* Fat */}
                <div className="rounded-xl border border-sky-100 bg-sky-50/50 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-sky-700">Fats (Chất béo tốt)</span>
                    <span className="font-oswald text-sm font-bold text-sky-800">{fatPct}%</span>
                  </div>
                  <div className="mt-2 font-oswald text-2xl font-bold text-slate-900">
                    {fatG} <span className="text-xs font-normal text-slate-500">grams ({fatKcal} kcal)</span>
                  </div>
                  <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-sky-100">
                    <div className="h-full rounded-full bg-sky-500" style={{ width: `${fatPct}%` }} />
                  </div>
                  <p className="mt-2 text-[11px] text-slate-500">Cân bằng nội tiết tố & hấp thụ vitamin</p>
                </div>
              </div>

              {/* Water & Hydration Tip */}
              <div className="mt-4 flex items-center gap-3 rounded-xl bg-blue-50/80 p-3.5 text-xs text-blue-900">
                <Droplet size={18} className="flex-shrink-0 text-blue-600" />
                <span>
                  <strong className="font-semibold text-blue-950">Lượng nước khuyến nghị:</strong> Uống tối thiểu{' '}
                  <strong>2.5 – 3.0 Lít nước lọc/ngày</strong>, chia đều từng ngụm nhỏ để tối ưu hóa quá trình trao đổi chất.
                </span>
              </div>
            </div>
          </div>

          {/* 4. DETAILED MEAL MENU BREAKDOWN */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h4 className="font-oswald text-xl font-bold uppercase tracking-wide text-primary">
                Phân bổ thực đơn các bữa ăn trong ngày
              </h4>
              <span className="text-xs text-slate-500">Định lượng theo grams thực phẩm chín/sống</span>
            </div>

            {/* 4. HIERARCHICAL OR DETAILED MEAL MENU BREAKDOWN */}
            {isHierarchical ? (
              <div className="space-y-4">
                {/* Level 1: Week Navigation */}
                <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 mr-2">Tuần:</span>
                  {weeksData.map((w, wIdx) => {
                    const isSelected = wIdx === selectedPortalWeek;
                    return (
                      <button
                        key={w.weekNumber || wIdx}
                        type="button"
                        onClick={() => {
                          setSelectedPortalWeek(wIdx);
                          setSelectedPortalDay(0);
                        }}
                        className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                          isSelected
                            ? 'bg-emerald-700 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {w.name || `Tuần ${wIdx + 1}`}
                      </button>
                    );
                  })}
                </div>

                {/* Level 2: Day Navigation within active week */}
                {currentWeek?.days && (
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {currentWeek.days.map((d: any, dIdx: number) => {
                      const isSelected = dIdx === selectedPortalDay;
                      return (
                        <button
                          key={d.dayNumber || dIdx}
                          type="button"
                          onClick={() => setSelectedPortalDay(dIdx)}
                          className={`flex-shrink-0 rounded-xl border p-2.5 text-center transition ${
                            isSelected
                              ? 'border-emerald-500 bg-emerald-50 text-emerald-900 shadow-xs'
                              : 'border-slate-200 bg-slate-50/50 text-slate-600 hover:bg-slate-100'
                          }`}
                          style={{ minWidth: '100px' }}
                        >
                          <div className="text-xs font-bold">{d.dayOfWeek}</div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {d.date ? new Date(d.date).toLocaleDateString('vi-VN').slice(0, 5) : `Ngày ${d.dayNumber}`}
                          </div>
                          <div className="mt-1 text-[10px] font-semibold text-emerald-700">
                            {d.meals?.length || 0} bữa ăn
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Level 3: Meals Grid for active day */}
                <div className="mt-4">
                  <div className="mb-3 flex items-center justify-between text-xs text-slate-600 font-semibold">
                    <span>Thực đơn {currentDay?.dayOfWeek} ({currentDay?.date ? new Date(currentDay.date).toLocaleDateString('vi-VN') : `Ngày ${currentDay?.dayNumber}`}) • {currentWeek?.name}</span>
                    <span>{activeDayMeals.length} bữa ăn</span>
                  </div>

                  {activeDayMeals.length > 0 ? (
                    <div className="grid gap-4 md:grid-cols-2">
                      {activeDayMeals.map((meal: any, idx: number) => (
                        <div
                          key={meal.id || idx}
                          className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 transition hover:border-emerald-300 hover:bg-white hover:shadow-sm"
                        >
                          <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5">
                            <div className="flex items-center gap-2">
                              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 font-oswald text-xs font-bold text-white">
                                {idx + 1}
                              </div>
                              <h5 className="font-bold text-slate-900">{meal.name || `Bữa ăn ${idx + 1}`}</h5>
                            </div>
                            {meal.timeSlot && (
                              <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                                <Clock size={12} />
                                {meal.timeSlot}
                              </span>
                            )}
                          </div>

                          {meal.calories && (
                            <div className="mt-2 text-xs font-semibold text-emerald-700">
                              Năng lượng dự tính: ~{meal.calories} kcal
                            </div>
                          )}

                          {meal.imageUrl && (
                            <div
                              className="mt-3 overflow-hidden rounded-lg border border-slate-200 cursor-pointer group"
                              onClick={() => setPreviewImage({ url: meal.imageUrl!, title: meal.name })}
                              title="Bấm để xem ảnh lớn"
                            >
                              <img
                                src={meal.imageUrl}
                                alt={meal.name}
                                className="h-36 w-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                            </div>
                          )}

                          {Array.isArray(meal.items) && meal.items.length > 0 && (
                            <div className="mt-3 space-y-2">
                              {meal.items.map((item: any, itemIdx: number) => (
                                <div
                                  key={itemIdx}
                                  className="flex items-center justify-between rounded-lg bg-white p-2.5 text-xs border border-slate-100"
                                >
                                  <div className="flex items-center gap-2.5">
                                    {item.imageUrl && (
                                      <img
                                        src={item.imageUrl}
                                        alt={item.name}
                                        onClick={() => setPreviewImage({ url: item.imageUrl!, title: item.name })}
                                        className="w-10 h-10 rounded-lg object-cover flex-shrink-0 border border-slate-200 cursor-pointer hover:opacity-90 hover:scale-105 transition-all"
                                        title="Bấm để xem ảnh chi tiết"
                                      />
                                    )}
                                    <div>
                                      <div className="font-semibold text-slate-800">{item.name}</div>
                                      {item.prepTip && (
                                        <div className="text-[10px] text-slate-500 italic mt-0.5">{item.prepTip}</div>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 font-mono text-slate-600">
                                    {item.amount && <span>{item.amount}</span>}
                                    {item.calories && <span className="text-amber-600 font-bold">{item.calories} kcal</span>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-6 text-center text-xs text-slate-500">
                      Chưa có thực đơn cho ngày này. Hãy liên hệ PT để được cập nhật.
                    </div>
                  )}
                </div>
              </div>
            ) : menuItems.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {menuItems.map((meal, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 transition hover:border-emerald-300 hover:bg-white hover:shadow-sm"
                  >
                    <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 font-oswald text-xs font-bold text-white">
                          {idx + 1}
                        </div>
                        <h5 className="font-bold text-slate-900">{meal.meal || `Bữa ăn ${idx + 1}`}</h5>
                      </div>
                      {meal.time && (
                        <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                          <Clock size={12} />
                          {meal.time}
                        </span>
                      )}
                    </div>

                    {meal.calories && (
                      <div className="mt-2 text-xs font-semibold text-emerald-700">
                        Năng lượng dự tính: ~{meal.calories} kcal
                      </div>
                    )}

                    {/* Meal Items List */}
                    {Array.isArray(meal.items) && meal.items.length > 0 ? (
                      <div className="mt-3 space-y-2">
                        {meal.items.map((item, itemIdx) => (
                          <div
                            key={itemIdx}
                            className="flex items-center justify-between rounded-lg bg-white p-2.5 text-xs border border-slate-100"
                          >
                            <div className="flex items-center gap-2.5">
                              {(item as any).imageUrl && (
                                <img
                                  src={(item as any).imageUrl}
                                  alt={item.name}
                                  onClick={() => setPreviewImage({ url: (item as any).imageUrl, title: item.name })}
                                  className="w-10 h-10 rounded-lg object-cover flex-shrink-0 border border-slate-200 cursor-pointer hover:opacity-90 hover:scale-105 transition-all"
                                  title="Bấm để xem ảnh chi tiết"
                                />
                              )}
                              <div className="font-semibold text-slate-800">{item.name}</div>
                            </div>
                            <div className="flex items-center gap-2 font-mono text-slate-600">
                              {item.weightGrams && <span>{item.weightGrams}g</span>}
                              {item.calories && <span className="text-amber-600 font-bold">{item.calories} kcal</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-2 text-xs text-slate-500">
                        Thực đơn linh hoạt theo hướng dẫn trực tiếp từ Huấn luyện viên.
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-6 text-center text-xs text-slate-500">
                PT chưa chia nhỏ danh sách món chi tiết. Hãy tuân thủ tổng lượng Calo ({targetCalories} kcal) và tỉ lệ Đạm {proteinG}g, Carbs {carbsG}g, Béo {fatG}g ở trên.
              </div>
            )}
          </div>

          {/* 5. PT NOTES & DIETARY GUIDELINES */}
          {activeNutrition.notes && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-6 shadow-sm">
              <div className="flex items-start gap-3">
                <Info size={20} className="flex-shrink-0 text-amber-700" />
                <div>
                  <h4 className="font-oswald text-base font-bold uppercase text-amber-900">
                    Lời dặn dò & Nguyên tắc dinh dưỡng từ PT
                  </h4>
                  <div className="mt-2 whitespace-pre-line text-xs text-amber-950/90 leading-relaxed">
                    {activeNutrition.notes}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 6. HISTORY OF PAST NUTRITION PLANS */}
          {historyNutrition.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-oswald text-lg font-bold uppercase tracking-wide text-primary">
                Các thực đơn dinh dưỡng trước đây
              </h4>
              {historyNutrition.map((plan) => {
                const planId = plan._id;
                const isExpanded = expandedHistoryId === planId;
                return (
                  <div key={planId} className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                    <div
                      onClick={() => setExpandedHistoryId(isExpanded ? null : planId)}
                      className="flex cursor-pointer items-center justify-between"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h5 className="font-bold text-slate-900">{plan.title}</h5>
                          {plan.startDate && (
                            <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
                              <Calendar size={11} />
                              {new Date(plan.startDate).toLocaleDateString('vi-VN')} - {new Date(plan.endDate || plan.startDate).toLocaleDateString('vi-VN')}
                              {plan.durationDays ? ` (${plan.durationDays} ngày)` : ''}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500">
                          {plan.targetCalories} Kcal/ngày • Đạm {plan.macros.protein}g • Carbs {plan.macros.carbs}g • Béo {plan.macros.fat}g
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                        <span>{isExpanded ? 'Thu gọn' : 'Chi tiết'}</span>
                        <ChevronDown size={16} className={isExpanded ? 'rotate-180' : ''} />
                      </div>
                    </div>
                    {isExpanded && plan.notes && (
                      <div className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-600">
                        {plan.notes}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-xs">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 mb-3">
            <Salad size={30} />
          </div>
          <h3 className="font-oswald text-xl font-bold uppercase text-slate-800">
            Chưa có thực đơn công bố
          </h3>
          <p className="mt-2 max-w-md text-xs text-slate-500 leading-relaxed">
            Huấn luyện viên đang phân tích nhu cầu calo và cơ cấu bữa ăn phù hợp cho bạn. Bạn có thể nhắc PT công bố thực đơn trong buổi tập tới nhé!
          </p>
        </div>
      )}

      {/* Modal xem preview ảnh món ăn phóng to */}
      <MealImagePreviewModal
        previewImage={previewImage}
        onClose={() => setPreviewImage(null)}
      />
    </div>
  );
}
