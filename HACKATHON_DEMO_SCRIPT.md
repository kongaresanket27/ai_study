# StudyPilot Hackathon Demo Script

**Target duration:** about 5 minutes  
**Track:** D — Personalized Tutoring & Adaptive Learning  
**Recording requirements:** English audio or English subtitles; upload the finished 3–10 minute video to YouTube. Unlisted is allowed; private is not.

## Before recording

- Start the app and verify it is working. Keep the server/API status stable during the recording.
- Use a clean, shareable PDF or notes file. Check every visible page for personal information, private class details, or credentials before recording.
- Upload the material before recording, then verify that its sections appear in Courses and can be used by tutor chat and quizzes.
- If possible, use a fresh browser profile or clear any unrelated previous chat. Keep the uploaded source and its citations visible during the demo.
- Avoid uploading a large video during the timed demo; processing time depends on file size and video duration.
- Do not show `.env`, API keys, passwords, or account database contents.

## Spoken script and screen actions

### 0:00–0:35 — Opening

**[Show the StudyPilot sign-in page or dashboard.]**

> “Hello, I’m presenting StudyPilot, our AI study companion for Track D: Personalized Tutoring and Adaptive Learning.
>
> Students often have their course notes, textbook PDFs, diagrams, and lectures in different places. General-purpose AI can also answer without making it clear whether the answer is actually supported by course material.
>
> StudyPilot is designed to bring a student’s materials into one workspace and connect them to cited tutoring, practice, and review.”

### 0:35–1:15 — Sign in and dashboard

**[If starting at sign-in, sign in with a prepared demo account. Otherwise, show the dashboard.]**

> “This prototype supports local accounts. The account is stored in the local SQLite database. Study materials and learning progress are kept in separate browser storage for each signed-in account, but they do not sync between devices.
>
> The dashboard shows the study material and topic counts, along with quiz and study progress, so the student can quickly see what is available to work on.”

### 1:15–1:55 — Uploads and Courses

**[Open Upload Materials. Briefly show supported file types, then navigate to Courses with the already-ingested demo document.]**

> “Students can upload PDFs, PowerPoint presentations, text or Markdown notes, images, and supported video files. The app extracts readable text and organizes it into source-linked sections. Image and video analysis uses the configured Gemini service.
>
> I’ve prepared a document in advance for this walkthrough. In Courses, I can browse the extracted sections, search or filter them, and open an excerpt with its source location.”

**[Open a Courses section, then show its source excerpt/location.]**

> “Keeping the excerpt and its origin together makes it easier to check the material being used.”

### 1:55–2:45 — Source-grounded tutor

**[Open Tutor Chat. Ask a question whose answer is clearly covered in the prepared document, such as: “Explain depth-first search using my uploaded notes, and cite the source.” Use a question that matches your own prepared file.]**

> “Now I’ll ask the tutor about a concept in my uploaded material.
>
> The tutor uses the retrieved excerpts as its course context and returns citations that I can open. That gives the student a way to inspect the supporting source rather than treating the response as an unattributed answer.”

**[Open one citation and show the excerpt.]**

> “If the material does not support a question, the app is intended to say that it is not covered rather than presenting outside information as though it came from the course.”

### 2:45–3:40 — Quiz assessment

**[Open Quizzes, select the topic or whole course, choose a question count and difficulty, then click Launch Assessment.]**

> “StudyPilot can generate multiple-choice practice questions from the uploaded source excerpts. I can choose the scope, difficulty, and number of questions.
>
> Each generated question is associated with an uploaded source section, so the student can review where it came from.”

**[Answer one question, check the answer, and show the feedback or source citation. If model generation is temporarily unavailable, do not imply the assessment succeeded; retry or use a previously prepared successful run.]**

> “After answering, the student can check the result and return to the cited source for review.”

### 3:40–4:25 — Progress and planner

**[Show the quiz result/progress, then open Study Planner.]**

> “Quiz results update topic-level learning progress. The Study Planner uses topic mastery and review timing to prioritize practice. If an exam date is not set, it still provides a one-week review schedule.
>
> Starting a review session opens Tutor Chat with a focused prompt to explain the topic from the uploaded materials and ask a follow-up question.”

**[Click Start Review Session if time permits.]**

### 4:25–5:00 — Technical approach and close

**[Show Courses or the dashboard as a clean closing screen.]**

> “At a high level, the browser sends uploads to the StudyPilot server, which extracts text and builds source-linked content sections. Gemini supports grounded tutor responses, quiz generation, and multimodal analysis when configured. The browser keeps the learner’s materials and progress locally, while SQLite stores local account credentials and sessions.
>
> This is a working prototype, not a cloud-synced multi-user learning service. We have focused this demo on the core Track D workflow: upload course content, ask cited questions, practice from the sources, and use progress to guide review.
>
> Thank you for watching.”

## Keep the demo honest

- The current quiz generator produces **multiple-choice** questions. Do not claim short-answer or numerical quiz generation unless you have verified those modes in the running app.
- Do not claim cross-model question verification, benchmark scores, RAGAS/DeepEval results, or measured mastery gains unless you have completed those evaluations and can show the results.
- Local SQLite authentication does not create cloud accounts. Study materials and learning progress are browser-local and isolated by the server-issued account ID, but they are not synced across devices. A previously shared workspace is migrated once to the first workspace opened after the update.
- Image/video processing, tutoring, and quiz generation depend on Gemini being configured and available. If it is temporarily unavailable, show a previously prepared successful result or retry; do not present a failed request as a successful feature.
- The app currently uses English; the nonfunctional language selector was removed.
- Avoid recording personal information embedded in uploaded course documents. Use a sanitized sample or a document you have permission to share.

## Submission checklist

- The demo video is between 3 and 10 minutes.
- The video is publicly accessible or unlisted on YouTube, not private.
- The audio is in English or English subtitles are included.
- The video shows the project running and explains the user workflow and high-level technical approach.
- The Devpost project description, public GitHub repository with README setup instructions, and team members’ real full names/accounts are also included in the submission.
