import { generateText, Output } from 'ai';
import { z } from 'zod';
import { anthropic } from '@/lib/ai/providers';

export interface JudgeRubric {
  name: string;
  criteria: string;
  passMark: number; // 0–10
}

export interface JudgeScore {
  rubric: string;
  score: number; // 0–10
  pass: boolean;
  reasoning: string;
}

const JudgeOutputSchema = z.object({
  score: z.number().min(0).max(10),
  reasoning: z.string(),
});

const JUDGE_SYSTEM = `You are an AI quality evaluator for a health coaching platform.
Score the following output against the rubric below.
Return JSON: { "score": <0-10>, "reasoning": "<1-2 sentences>" }
Be strict. A score of 8+ means publication-quality. 5–7 means acceptable. Below 5 means failure.`;

export async function judgeOutput(rubric: JudgeRubric, output: string): Promise<JudgeScore> {
  const result = await generateText({
    model: anthropic('claude-haiku-4.5'),
    temperature: 0,
    system: JUDGE_SYSTEM,
    prompt: `Rubric: ${rubric.criteria}\n\nOutput to evaluate:\n${output}`,
    output: Output.object({ schema: JudgeOutputSchema }),
  });

  const { score, reasoning } = result.output;
  return {
    rubric: rubric.name,
    score,
    pass: score >= rubric.passMark,
    reasoning,
  };
}
