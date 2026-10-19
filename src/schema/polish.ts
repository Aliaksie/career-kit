import { z } from 'zod';
export const achievementOrderSchema = z.enum(['context-first', 'action-first']);
export type AchievementOrder = z.infer<typeof achievementOrderSchema>;
export const polishSchema = z.strictObject({
  achievements: z.array(z.strictObject({ id: z.string(), order: achievementOrderSchema })),
});
