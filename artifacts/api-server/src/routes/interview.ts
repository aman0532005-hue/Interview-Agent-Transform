import { Router, type IRouter } from "express";
import { InterviewTurnBody, InterviewTurnResponse } from "@workspace/api-zod";
import {
  continueInterview,
  startInterview,
} from "../lib/interview-engine";

const router: IRouter = Router();

router.post("/interview", async (req, res): Promise<void> => {
  const parsed = InterviewTurnBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.message }, "Invalid interview request");
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { sessionId, candidate, message } = parsed.data;
  if (candidate && typeof message !== "string") {
    res.json(InterviewTurnResponse.parse(await startInterview(sessionId, candidate)));
    return;
  }

  if (typeof message !== "string" || !message.trim()) {
    res.status(400).json({ error: "A non-empty answer is required." });
    return;
  }

  const response = await continueInterview(sessionId, message.trim());
  if (!response) {
    res.status(404).json({ error: "Interview session not found. Start a new interview." });
    return;
  }
  res.json(InterviewTurnResponse.parse(response));
});

export default router;