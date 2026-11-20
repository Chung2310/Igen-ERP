interface RecommendableExercise {
  _id: string;
  name: string;
  muscleGroup: string;
  level: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  equipment?: string[];
  technique?: string;
}

interface RecommendationContext {
  goal: string;
  level: string;
  muscleGroups: string[];
}

const normalize = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd')
  .toLocaleLowerCase('vi')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const tokens = (value: string) => normalize(value).split(' ').filter((token) => token.length >= 3);

export function recommendExercises<T extends RecommendableExercise>(exercises: T[], context: RecommendationContext, limit = 5): T[] {
  const goalTokens = tokens(context.goal);
  const selectedGroups = new Set(context.muscleGroups.map(normalize));

  return exercises
    .map((exercise, index) => {
      const identity = normalize(`${exercise.name} ${exercise.muscleGroup}`);
      const details = normalize(`${exercise.equipment?.join(' ') || ''} ${exercise.technique || ''}`);
      const identityMatch = goalTokens.some((token) => identity.includes(token));
      const detailMatch = goalTokens.some((token) => details.includes(token));
      const score = (identityMatch ? 16 : detailMatch ? 10 : 0)
        + (selectedGroups.has(normalize(exercise.muscleGroup)) ? 8 : 0)
        + (exercise.level === context.level ? 2 : 0);
      return { exercise, index, score };
    })
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, Math.max(0, limit))
    .map(({ exercise }) => exercise);
}
