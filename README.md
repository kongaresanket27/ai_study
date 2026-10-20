# StudyPilot

StudyPilot is a student-facing workspace for learning from your own materials. Upload PDFs, PowerPoint presentations, notes, images, or lecture videos to create source-linked Courses for tutoring, quizzes, revision, and planning.

## What students can do

- Upload course materials or add a public YouTube video URL, then browse extracted topics and source excerpts in Courses.
- Process PDFs, images, Office files, spreadsheets, text, and media locally with Python libraries in Python Local Lab.
- Ask questions about uploaded content and open the supporting source citation.
- Generate quizzes from uploaded source units and review results by topic.
- Review source sections and follow a plan based on topic mastery and review timing; without an exam date, the planner creates a one-week schedule. Review actions open a source-grounded tutor session.

## How it works

The React and TypeScript client provides the learning workspace. An Express server handles uploads, local account routes, and AI requests. Uploaded content is divided into study units while preserving source metadata such as the PDF page, PowerPoint slide, or video timestamp. PDF, PPTX, TXT, and Markdown text extraction is performed by the server; Gemini is used for tutoring, quiz generation, and image/video analysis when configured.

Tutor and quiz requests use excerpts from uploaded units as context. Tutor answers are prompted to stay within that context and cite their sources. Quizzes are multiple choice and retain a link to the source unit used to generate each question. Topic progress is stored in browser local storage and updated through practice; the planner uses that progress and review timing to suggest study sessions.

## Current limitations

- Quiz generation currently supports multiple-choice questions only.
- Gemini-dependent features require a working `GEMINI_API_KEY`; generated answers and questions should still be checked against the cited source.
- Authentication uses a local SQLite database. This prototype is not a hosted multi-user service.
- Study materials and progress are held in browser local storage. Account workspaces are separated in the same browser profile but do not sync across browsers or devices.
- Legacy `.ppt` files are not supported; save them as `.pptx` before uploading.

## Getting started

### Requirements

- Node.js 22.13 or later (uses the built-in SQLite module)
- npm 9 or later

### Configure Gemini (required for AI-powered features)

Copy `.env.example` to `.env`, then add your own Google AI Studio key:

```bash
GEMINI_API_KEY="YOUR_GEMINI_API_KEY"
PORT=3000
```

PDF, PPTX, and text extraction work without a Gemini key. Image analysis, video transcription (including public YouTube URLs), tutoring, and quiz generation require a configured key. Supported uploads are PDF, PPTX, TXT/Markdown, PNG/JPEG/WebP, and MP4/MOV/WebM files up to 25 MB each. YouTube sources must be public; private and unlisted videos are not supported. Legacy `.ppt` files must be saved as `.pptx` first.

### Install and run

From the project directory, install the dependencies and start the integrated web app and API server:

```bash
npm install --legacy-peer-deps
npm run dev
```

Open the URL printed in the terminal (by default, [http://localhost:3000](http://localhost:3000)). Use the URL served by this command so the app and its sign-in API share the same address; opening a frontend-only server will not support local accounts.

Each workspace section has a shareable URL that also works with browser refresh and back/forward navigation: `/dashboard`, `/courses`, `/tutor`, `/quizzes`, `/course-map`, `/study-plan`, `/revision`, and `/upload`.
Python Local Lab is available at `/local-python`.

### Local Python processing

Python Local Lab runs local Python libraries through the app's local server bridge; it does not use Gemini or external AI APIs. It supports PDF, common image formats (with OCR), DOCX, PPTX, XLSX/XLSM, CSV, TXT/Markdown, and common audio/video formats. Results are extractive summaries and keyword-based topic labels rather than generated AI answers, and are added to Courses.

Install Python 3.10–3.13, then install the processor libraries:

```bash
python -m pip install -r python/requirements.txt
```

The page offers metadata-only audio/video processing or optional local Whisper transcription. Whisper runs on the computer and downloads its small model on the first transcription; media is not sent to a cloud AI service. FFmpeg is provided by the Python `imageio-ffmpeg` dependency.

To check TypeScript and build the production client:

```bash
npm run lint
npm run build
```

### Local accounts

StudyPilot supports local email/password accounts using SQLite. Accounts are stored in `data/studypilot.sqlite` by default; set `STUDYPILOT_DB_PATH` in `.env` to use another location. Passwords are stored as scrypt hashes, and sign-in sessions use HttpOnly cookies. The database file is ignored by Git and should be kept private.

Study materials, topic progress, quiz history, and tutor chat are stored in browser local storage under a scope derived from the signed-in account's server-issued user ID. Accounts using the same browser profile see separate workspaces; guest workspaces are isolated to a browser session. Existing unscoped workspace data is migrated once to the first workspace opened after this update. Learning data does not sync between browsers or devices. The local SQLite account setup is intended for a local prototype, not a publicly deployed multi-user service.

## Hackathon materials

- [Devpost project description draft](./DEVPOST_PROJECT_DESCRIPTION.md) — ready to adapt and paste into the project page.
- [Hackathon demo script](./HACKATHON_DEMO_SCRIPT.md) — screen cues and a spoken walkthrough.

Public source repository: [github.com/kongaresanket27/ai_study](https://github.com/kongaresanket27/ai_study). Do not publish `.env`, the local `data/` directory, API keys, account databases, or private uploaded course materials.
