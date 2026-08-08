---
name: InterviewIQ integration boundary
description: Durable decisions for auth persistence and adaptive interview API compatibility.
---

InterviewIQ uses localStorage for hackathon/demo authentication and candidate/interview persistence. The frontend keeps the required `POST /api/interview` start and turn payload shapes as the integration boundary, but must not replace the adaptive engine with fabricated generic questions or silently pretend a live API exists.

**Why:** The product brief explicitly prioritizes preserving the adaptive interview engine and calls for client-side demo authentication; the starter workspace currently exposes only the API health route.

**How to apply:** When adding the real interview backend later, connect it behind the existing client request seam and keep the clear demo-mode error/fallback behavior for unavailable or malformed responses.