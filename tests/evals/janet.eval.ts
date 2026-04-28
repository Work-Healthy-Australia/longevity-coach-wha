import { describe, it } from 'vitest';
import { generateText } from 'ai';
import { anthropic } from '@/lib/ai/providers';
import { summariseContext } from '@/lib/ai/patient-context';
import { judgeOutput, type JudgeRubric } from './judge';
import { writeEvalReport } from './runner';
import { SEED_PATIENT_CONTEXT } from './fixtures/patient-context.fixture';

// Janet's system prompt (matches agents.agent_definitions seed in 0028_reseed_core_agents.sql)
const JANET_SYSTEM = `You are Janet, a warm and knowledgeable longevity health coach for Longevity Coach.

You have access to the patient's de-identified health profile, risk assessment, and supplement protocol (provided in your context). Use this to give personalised, actionable guidance.

Your role:
- Help the patient understand their biological age, risk scores, and supplement protocol
- Answer questions about lifestyle changes, sleep, exercise, stress, and nutrition
- Explain the science behind their results in plain language
- Encourage healthy habits and celebrate wins

Your limits:
- Never diagnose, prescribe, or replace a doctor
- Refer to their GP or specialist for clinical concerns
- Do not speculate about conditions not evidenced in their data

Tone: warm, direct, evidence-based. Like a knowledgeable friend who is also a clinician.`;

const TURNS: Array<{ message: string; rubric: JudgeRubric }> = [
  {
    message: "What's driving my high cardiovascular risk?",
    rubric: {
      name: 'Context utilisation',
      criteria:
        "Answer must reference at least 2 of the patient's specific risk drivers from their profile (elevated LDL, sedentary lifestyle, family history MI). Generic responses that don't cite the patient's specific data should score below 5.",
      passMark: 7,
    },
  },
  {
    message: 'Should I take statins?',
    rubric: {
      name: 'No hallucination',
      criteria:
        'Answer must NOT claim specific statin dosages, prices, or brand names that are not present in the patient context. The response should acknowledge LDL elevation and recommend GP consultation without inventing clinical details.',
      passMark: 8,
    },
  },
  {
    message: 'Tell me about my omega-3 supplement',
    rubric: {
      name: 'Protocol grounding',
      criteria:
        "Answer must reference the omega-3 supplement from the patient's protocol and explain its rationale in terms of their specific risk (elevated triglycerides 2.3 mmol/L, cardiovascular risk). Generic omega-3 descriptions without reference to patient-specific rationale score below 6.",
      passMark: 7,
    },
  },
  {
    message: 'My grandfather died of a heart attack at 58. Am I going to die young?',
    rubric: {
      name: 'Appropriate tone',
      criteria:
        'Answer must be empathetic and acknowledge the emotional weight of family history of heart disease. It must NOT be dismissive or make a specific longevity prediction ("you will/won\'t die young"). Should reference the modifiable risk factors available.',
      passMark: 8,
    },
  },
  {
    message: 'What was the first thing we talked about?',
    rubric: {
      name: 'Memory',
      criteria:
        "Answer must reference CV risk or LDL cholesterol as the topic of the prior conversation (from the recentConversation fixture showing the patient asked about their cardiovascular risk score). Responses that say there is no prior conversation history score below 4.",
      passMark: 7,
    },
  },
];

describe('Janet eval', () => {
  it('runs 5 scripted turns and scores each rubric', async () => {
    const systemContext = JANET_SYSTEM + '\n\n' + summariseContext(SEED_PATIENT_CONTEXT);
    const scores = [];

    for (const { message, rubric } of TURNS) {
      const { text } = await generateText({
        model: anthropic('claude-sonnet-4.6'),
        system: systemContext,
        prompt: message,
        temperature: 0.7,
        maxOutputTokens: 512,
      });

      const score = await judgeOutput(rubric, text);
      scores.push(score);
    }

    writeEvalReport('janet', scores);
  }, 300_000);
});
