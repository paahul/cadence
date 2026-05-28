import { z } from "zod";

export const dimensionResultSchema = z.object({
  score: z.number().int().min(1).max(5),
  reasoning: z.string().min(1),
  examples: z
    .array(
      z.object({
        quote: z.string().min(1),
        issue: z.string().min(1),
      }),
    )
    .max(5),
});

export type DimensionResult = z.infer<typeof dimensionResultSchema>;

export const analysisSchema = z.object({
  dimensions: z.object({
    clarity: dimensionResultSchema,
    conciseness: dimensionResultSchema,
    confidence: dimensionResultSchema,
    wordPrecision: dimensionResultSchema,
    pace: dimensionResultSchema,
    pronunciationClarity: dimensionResultSchema,
  }),
});

export type AnalysisResult = z.infer<typeof analysisSchema>;
