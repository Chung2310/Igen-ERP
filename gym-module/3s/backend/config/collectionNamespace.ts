import mongoose from 'mongoose';

// Gym and ERP share one MongoDB database when embedded. Keep every Gym model
// in its own collection so similarly named ERP models (notably User) never mix.
const originalPluralizer = mongoose.pluralize();
if (process.env.GYM_SHARED_DB === '1') {
  mongoose.pluralize((name) => `gym_${originalPluralizer ? originalPluralizer(name) : name}`);
}

export function gymCollection(name: string): string {
  return process.env.GYM_SHARED_DB === '1' ? `gym_${name}` : name;
}
