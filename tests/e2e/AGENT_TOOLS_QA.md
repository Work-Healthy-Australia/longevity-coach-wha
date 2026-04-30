# Chef Agent & PT Coach E2E QA Test Plan

## Overview

This document provides a comprehensive QA test plan for validating the **Chef Agent** (Meal Plan Tool) and **PT Coach** (Physical Training Coach) integration with Janet chat.

## Prerequisites

- Test user account with credentials (`TEST_EMAIL`, `TEST_PASSWORD`)
- Dev server running on `http://localhost:3000`
- LLM service configured and available

## Running the Tests

### Automated Tests

```bash
# Set credentials
export TEST_EMAIL="test@janet.care"
export TEST_PASSWORD="your-test-password"

# Run all agent tool tests
pnpm test:e2e tests/e2e/agent-tools.spec.ts

# Run with headed browser for debugging
pnpm test:e2e tests/e2e/agent-tools.spec.ts --headed

# Run specific test group
pnpm test:e2e -- --grep "PT Coach"
```

## Test Coverage

### 1. PT Coach Tool Tests

#### Test 1.1: Exercise-Specific Questions
**Purpose:** Verify PT Coach is invoked for exercise queries

**Steps:**
1. Log in as test user
2. Navigate to `/report`
3. Send message: "What exercises should I do today based on my PT plan?"

**Expected Result:**
- Response contains exercise-specific guidance
- Keywords: "exercise", "workout", "training", "fitness", or "movement"
- Response references patient's actual PT plan if available

#### Test 1.2: Rehabilitation Advice
**Purpose:** Verify PT Coach provides rehab guidance

**Steps:**
1. Send: "I have lower back pain. What exercises can help with rehabilitation?"

**Expected Result:**
- Response contains rehab/stretching guidance
- Keywords: "exercise", "stretch", "strengthen", "mobility", or "rehab"
- Safety-conscious advice

#### Test 1.3: MSK Risk Context Awareness
**Purpose:** Verify PT Coach adapts to MSK risk score

**Steps:**
1. Send: "My MSK risk is high. What exercises are safe for me?"

**Expected Result:**
- Response acknowledges high MSK risk
- Keywords: "safe", "careful", "modify", "adapt", "low impact", or "gentle"
- Modified exercise recommendations

#### Test 1.4: PT Plan Summary
**Purpose:** Verify PT Coach can summarize current plan

**Steps:**
1. Send: "Can you summarize my current PT plan?"

**Expected Result:**
- Response describes plan structure
- Keywords: "plan", "exercise", "routine", or "session"
- Lists specific exercises from plan

### 2. Chef Agent (Meal Plan) Tests

#### Test 2.1: Meal Plan Generation Trigger
**Purpose:** Verify Chef Agent triggers meal plan pipeline

**Steps:**
1. Send: "Generate a meal plan for me this week"

**Expected Result:**
- Response acknowledges generation request
- Keywords: "generating", "meal plan", "working on", or "preparing"
- Does NOT wait for completion (fire-and-forget pattern)

#### Test 2.2: Nutrition Guidance
**Purpose:** Verify Chef Agent provides dietary advice

**Steps:**
1. Send: "What should I eat to support my longevity goals?"

**Expected Result:**
- Response contains nutrition guidance
- Keywords: "food", "diet", "nutrition", "eat", "meal", or "healthy"
- Context-aware recommendations

#### Test 2.3: Shopping List Assistance
**Purpose:** Verify Chef Agent handles shopping list requests

**Steps:**
1. Send: "Create a shopping list for my meal plan"

**Expected Result:**
- Response acknowledges shopping list request
- Keywords: "shopping", "list", "groceries", "items", or "ingredients"
- References existing meal plan context

#### Test 2.4: Meal Plan Context Integration
**Purpose:** Verify Chef Agent integrates with existing plan

**Steps:**
1. Send: "What's in my current meal plan?"

**Expected Result:**
- Response describes existing plan OR offers to create one
- Keywords: "plan", "meal", "breakfast", "lunch", "dinner", "snack", or "recipe"

### 3. Conversation Context Tests

#### Test 3.1: Context Maintenance Across Tool Calls
**Purpose:** Verify Janet maintains context when switching between agents

**Steps:**
1. Send: "What exercises are in my PT plan?"
2. Wait for response
3. Send: "How many days a week should I do those?"

**Expected Result:**
- Second response references first response
- Keywords: "week", "day", "frequency", "session", "time", or "per"
- Smooth context handoff

#### Test 3.2: Rapid Sequential Tool Requests
**Purpose:** Verify system handles rapid agent switching

**Steps:**
1. Send: "Create a meal plan for me"
2. Immediately send: "What about my exercise plan?"

**Expected Result:**
- Both requests processed successfully
- No interference between tool calls
- Appropriate responses for each query

## Tool Description Reference

### PT Coach Tool (`consult_pt_coach`)
```
Description: "Consult the PT Coach specialist for exercise, fitness, training, 
or rehabilitation advice. Returns grounded exercise recommendations based on 
the patient's active PT plan and MSK risk profile. Call this when the patient 
asks about exercise, workout routines, rehabilitation, or physical training."
```

### Meal Plan Tool (`request_meal_plan`)
```
Description: "Request a personalised 7-day meal plan and shopping list. Call 
this when the patient asks for a meal plan, asks what to eat this week, or 
requests a shopping list. The plan generates in the background — Janet should 
respond immediately with a 'generating…' message and not wait for the result."
```

## Implementation Details

### File Locations
- PT Coach Tool: `lib/ai/tools/pt-coach-tool.ts`
- Meal Plan Tool: `lib/ai/tools/meal-plan-tool.ts`
- PT Agent: `lib/ai/agents/pt-coach.ts`
- Meal Plan Pipeline: `lib/ai/pipelines/meal-plan.ts`
- Janet Integration: `lib/ai/agents/janet.ts`
- Chat UI: `app/(app)/report/_components/janet-chat.tsx`

### Key Behaviors

1. **PT Coach**
   - Uses `pt_coach_live` agent slug
   - Reads from `training_plans` table
   - Considers MSK risk for safety notes
   - References specific exercises by name

2. **Chef Agent (Meal Plan)**
   - Fire-and-forget pipeline trigger
   - Writes to `meal_plans` table
   - Generates shopping list alongside meals
   - Bloodwork-optimized recipe flagging

3. **Janet Tool Calling**
   - Both tools available via `tools` parameter in `streamText`
   - No await on meal plan (background generation)
   - PT Coach uses `createPipelineAgent` for structured output

## Debugging Failed Tests

### Common Issues

1. **Tool not being called**
   - Check Janet's system prompt includes tool descriptions
   - Verify tool is registered in `janet.ts` tools object
   - Check browser console for errors

2. **PT Coach returns generic response**
   - Verify `training_plans` has active plan for test user
   - Check MSK risk score is loaded in context

3. **Meal plan not generating**
   - Verify `PIPELINE_SECRET` env var is set
   - Check `/api/pipelines/meal-plan` endpoint
   - Review Supabase `meal_plans` table for entries

### Screenshots & Traces

Failed tests automatically capture:
- Screenshot: `test-results/[test-name]/test-failed-1.png`
- Trace: `test-results/[test-name]/trace.zip`

View trace:
```bash
pnpm exec playwright show-trace test-results/[test-name]/trace.zip
```

## Manual Testing Checklist

Use this when automated tests are unavailable:

- [ ] Login and navigate to `/report`
- [ ] Ask PT Coach: "What exercises should I do?"
- [ ] Verify response mentions specific exercises
- [ ] Ask Chef: "Generate a meal plan"
- [ ] Verify "generating" acknowledgment
- [ ] Wait 60 seconds, refresh page
- [ ] Verify meal plan appears on report
- [ ] Ask follow-up: "What's in my meal plan?"
- [ ] Verify response references generated plan
- [ ] Check conversation context maintained
