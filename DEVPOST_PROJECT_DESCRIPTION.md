# StudyPilot

**A source-linked AI study companion that turns course materials into tutoring, practice, and review.**

## The problem

Students often have lecture notes, textbook PDFs, slide decks, and videos scattered across different files. Studying across those materials takes time, and a general-purpose chatbot may answer without showing whether its response is supported by the student's actual course content. It can also be difficult to decide what to practice next.

## What we built

StudyPilot is a web-based learning workspace for studying from uploaded course materials. It organizes extracted content into Courses and connects study units to their original file and location, so students can review the excerpt behind a tutor response or quiz question.

## How it works

1. A student uploads a PDF, PowerPoint (`.pptx`), text/Markdown note, image, or supported video.
2. The server extracts readable text and organizes it into study units. Units preserve source locations such as PDF pages, PowerPoint slide numbers, and video timestamps. Gemini-powered image and video analysis is available when a server API key is configured.
3. The student asks a question in Tutor Chat. The app supplies relevant uploaded excerpts to the AI and asks it to answer from those sources with citations; citations link back to the source excerpt.
4. The student generates multiple-choice quizzes from uploaded material, reviews source-linked feedback, and tracks progress by topic.
5. The Study Planner uses topic progress and review timing to suggest what to review. Without an exam date, it provides a one-week schedule.

## What is included

- Source-linked Courses with search and excerpt viewing.
- Tutor Chat that uses uploaded excerpts and provides citations.
- Multiple-choice quiz generation with source-linked questions and topic progress.
- A study planner and revision views for organizing further practice.
- Local email/password accounts with separate learning workspaces in the same browser profile.

## Built with

React, TypeScript, Vite, Express, SQLite, and the Google Gemini API. PDF and PowerPoint text extraction is handled by server-side parsers; Gemini supports tutoring, quiz generation, and image/video analysis.

## Current scope and limitations

This is a working prototype. Quiz generation currently supports multiple-choice questions only; it does not claim short-answer or numerical assessment, cross-model answer verification, or completed benchmark results. Gemini-dependent features require a configured API key and may be unavailable if the service is unavailable. Students should check generated material against the cited source.

Accounts and sessions use a local SQLite database. Learning materials and progress are kept in browser local storage and do not sync between browsers or devices. The local account setup is intended for a prototype, not as a hosted multi-user service.

## Source code and setup

**Public GitHub repository:** Add the public repository URL here after publishing the source. Its README should provide prerequisites, configuration, dependency installation, run commands, and current limitations.
