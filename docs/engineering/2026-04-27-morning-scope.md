# James: Patient Workflow After Intake Form

## Step 1: Intake Form (Already Built)
- Patient fills out initial intake form (~20 questions)
- Covers: medical history, social history, family history, informed consent
- Required by Registration Act, cannot be skipped or deviated from

## Step 2: Login & Authentication
- After form submission, patient gets a login and password
- Patient is authenticated into the platform
- Check existing repo to confirm this flow works correctly before moving on

## Step 3: Secondary Questionnaire (Already Built in Existing Repo)
- Additional questions to tailor the patient experience
- Examples: current diet, dietary restrictions, lifestyle preferences
- Pull from existing repo rather than rebuilding

## Step 4: Upload Portal
- Patient is prompted to upload all previous tests and pathology they have
- Janet (the AI) is smart enough to read and identify: blood work, MRI scans, CT scans, genetic tests (e.g. 23andMe), microbiome tests, metabolic testing, DEXA scans
- Simple instruction to patient: "Janet can read all your previous pathology and imaging. Upload anything you think is significant."
- Janet reads, tags, and stores each file appropriately
- This data drives the risk calculator and supplement program

## Patient Tiers
- **Tier 1:** Patient lives in Janet's ecosystem. Janet handles daily check-ins, weekly and monthly questionnaires, builds programs.
- **Tier 2:** Clinician in the loop. Clinician manages hundreds of patients on a dashboard. Janet notifies clinician when patient completes monthly check-in. Clinician reviews Janet's advice and approves or edits.
- **Tier 3:** (Not fully defined in this session)

## Secret Sauce / Core IP
- Family history (grandparents' causes of death, ages) fed into actuarial tables to predict genetic disease risk
- Combined with: current medical history + blood markers
- This combination drives: supplement program, diet recommendations, exercise program
- Biological age calculation is an output from this data

## Sample Data Needed to Test
- Generate 20 patient personas with varied profiles
- Generate sample versions of the 5 key test types (blood work, imaging, genetic, microbiome, metabolic)
- Load into system and verify Janet reads, tags, and stores correctly

## Build Order for Today
1. Verify login and authentication flow works
2. Pull secondary questionnaire from existing repo and confirm it functions
3. Build the upload portal with general instructions for patients
4. Generate sample data and test end-to-end
