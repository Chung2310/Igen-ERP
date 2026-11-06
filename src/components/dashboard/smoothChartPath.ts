type ChartPoint = { x: number; y: number };

const number = (value: number) => Number(value.toFixed(2));

function segmentPath(points: ChartPoint[]): string {
  if (!points.length) return "";
  let path = `M ${number(points[0].x)} ${number(points[0].y)}`;
  if (points.length === 1) return path;

  const widths = points.slice(1).map((point, index) => point.x - points[index].x);
  if (points.length === 2 || widths.some((width) => width <= 0)) {
    return path + points.slice(1).map((point) => ` L ${number(point.x)} ${number(point.y)}`).join("");
  }

  const slopes = widths.map((width, index) => (points[index + 1].y - points[index].y) / width);
  const endpoint = (firstWidth: number, nextWidth: number, firstSlope: number, nextSlope: number) => {
    let tangent = ((2 * firstWidth + nextWidth) * firstSlope - firstWidth * nextSlope) / (firstWidth + nextWidth);
    if (Math.sign(tangent) !== Math.sign(firstSlope)) tangent = 0;
    else if (Math.sign(firstSlope) !== Math.sign(nextSlope) && Math.abs(tangent) > 3 * Math.abs(firstSlope)) tangent = 3 * firstSlope;
    return tangent;
  };
  const tangents = points.map((_, index) => {
    if (index === 0) return endpoint(widths[0], widths[1], slopes[0], slopes[1]);
    if (index === points.length - 1) {
      const last = widths.length - 1;
      return endpoint(widths[last], widths[last - 1], slopes[last], slopes[last - 1]);
    }
    const before = slopes[index - 1];
    const after = slopes[index];
    if (before === 0 || after === 0 || Math.sign(before) !== Math.sign(after)) return 0;
    const weightBefore = 2 * widths[index] + widths[index - 1];
    const weightAfter = widths[index] + 2 * widths[index - 1];
    return (weightBefore + weightAfter) / (weightBefore / before + weightAfter / after);
  });

  for (let index = 0; index < widths.length; index++) {
    const start = points[index];
    const end = points[index + 1];
    const third = widths[index] / 3;
    path += ` C ${number(start.x + third)} ${number(start.y + tangents[index] * third)}`;
    path += ` ${number(end.x - third)} ${number(end.y - tangents[index + 1] * third)}`;
    path += ` ${number(end.x)} ${number(end.y)}`;
  }
  return path;
}

/** Smooths consecutive points without inventing values across missing observations. */
export function smoothChartPath(points: readonly (ChartPoint | null)[]): string {
  const paths: string[] = [];
  let segment: ChartPoint[] = [];
  for (const point of [...points, null]) {
    if (point && Number.isFinite(point.x) && Number.isFinite(point.y)) {
      segment.push(point);
    } else if (segment.length) {
      paths.push(segmentPath(segment));
      segment = [];
    }
  }
  return paths.join(" ");
}
