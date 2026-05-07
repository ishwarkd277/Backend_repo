import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";
import mongoose from "mongoose";
import Resume from "./models/Resume.js";
import Assessment from "./models/Assessment.js";
import CareerAnalytics from "./models/CareerAnalytics.js";
import JobMatch from "./models/JobMatch.js";
import Job from "./models/Job.js";
import Application from "./models/Application.js";
import Notification from "./models/Notification.js";

dotenv.config();

const app = express();

/* =========================================
   SKILL EXTRACTION FALLBACKS
========================================= */

const fallbackTechnicalSkills = [
  "React", "Node.js", "JavaScript", "Python", "MongoDB", "Firebase",
  "TypeScript", "Express", "Tailwind", "REST APIs", "AWS", "Docker",
  "Java", "C++", "SQL", "Next.js", "Redux", "GraphQL"
];

const fallbackSoftSkills = [
  "Communication", "Leadership", "Teamwork", "Problem Solving",
  "Adaptability", "Creativity", "Critical Thinking", "Time Management"
];

const extractSkillsFromText = (text, fallbacks) => {
  if (!text) return [];
  return fallbacks.filter(skill =>
    new RegExp(`\\b${skill}\\b`, 'gi').test(text)
  ).slice(0, 5);
};

app.use(cors());
app.use(express.json());

/* =========================================
   MONGODB CONNECTION
========================================= */

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("--------------------------------");
    console.log("🍃 MongoDB Connected Successfully");
    console.log("--------------------------------");
  })
  .catch((error) => {
    console.log("--------------------------------");
    console.log("❌ MongoDB Connection Error:");
    console.log(error.message);
    console.log("--------------------------------");
  });

/* =========================================
   OPENROUTER CLIENT
========================================= */

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
});
/* =========================================
   HOME ROUTE
========================================= */

app.get("/", (req, res) => {
  res.send("CareerEdge AI Backend Running");
});

/* =========================================
   AI ROUTE
========================================= */

app.post("/api/ai", async (req, res) => {
  const { prompt, context, userData, stage = "1" } = req.body;

  if (!prompt && !context) {
    return res.status(400).json({
      success: false,
      error: "Prompt or context is required"
    });
  }

  try {

    /* =========================================
       OPTIMIZE INPUT TEXT
    ========================================= */

    const cleanContext = context
      ? context
        .replace(/\s+/g, " ")
        .replace(/\n+/g, " ")
        .trim()
        .slice(0, 800)
      : "";

    let aiPrompt = "";
    let tokens = 80;

    if (stage === "1") {
      aiPrompt = `SYSTEM COMMAND: Return ONLY a raw JSON object. NO code blocks. NO markdown. NO text before or after.
{
  "atsScore": number,
  "technicalSkills": ["skill1", "skill2"],
  "softSkills": ["skill1", "skill2"],
  "recommendation": "string"
}
Rules:
- atsScore: must be a realistic number based on skills vs industry standards.
- No markdown, no triple backticks.

RESUME CONTENT:
${cleanContext || prompt}`;
      tokens = 150;
    } else {
      aiPrompt = `Perform deep behavioral and technical analysis on this resume. Return ONLY JSON:
{
  "softSkills": ["skill1", "skill2", "skill3"],
  "technicalSkills": ["Skill A", "Skill B", "Skill C"],
  "strengths": ["point1", "point2"],
  "weaknesses": ["point1", "point2"],
  "recommendations": ["step1", "step2"]
}
Rules:
- No markdown.

Resume Content:
${cleanContext || prompt}`;
      tokens = 250;
    }

    console.log(`Sending Stage ${stage} request to AI...`);

    /* =========================================
       DEEPSEEK REQUEST
    ========================================= */

    const completion = await client.chat.completions.create({
      model: "deepseek/deepseek-chat",
      temperature: 0.1,
      max_tokens: 500, // Increased for safety
      messages: [
        {
          role: "system",
          content: "You are an ATS resume analyzer. Return ONLY compact JSON. No markdown."
        },
        {
          role: "user",
          content: aiPrompt
        }
      ]
    });

    /* =========================================
       GET AI RESPONSE
    ========================================= */

    const response = completion.choices[0].message.content;
    console.log(`DeepSeek Stage ${stage} Complete`);

    /* =========================================
       PARSE JSON SAFELY
    ========================================= */

    let parsedData = {
      atsScore: 0,
      technicalSkills: [],
      softSkills: [],
      strengths: [],
      weaknesses: [],
      recommendations: []
    };

    try {
      // Robust JSON Extraction
      const firstBrace = response.indexOf('{');
      const lastBrace = response.lastIndexOf('}');

      if (firstBrace !== -1 && lastBrace !== -1) {
        const jsonStr = response.substring(firstBrace, lastBrace + 1);
        const rawParsed = JSON.parse(jsonStr);

        console.log("PARSED JSON SUCCESSFUL");

        // Normalize keys (handle atsScore, ats_score, etc.)
        const getVal = (keys, fallback = []) => {
          for (const key of keys) {
            if (rawParsed[key] !== undefined) return rawParsed[key];
          }
          return fallback;
        };

        parsedData = {
          atsScore: Math.round(Number(getVal(['atsScore', 'ats_score', 'score', 'atsScorePercent'], 0))) || 0,
          technicalSkills: getVal(['technicalSkills', 'technical_skills', 'skills', 'techSkills', 'technicalIndex'], []),
          softSkills: getVal(['softSkills', 'soft_skills', 'interpersonalSkills'], []),
          strengths: getVal(['strengths', 'highlights', 'pros'], []),
          weaknesses: getVal(['weaknesses', 'areasOfImprovement', 'cons'], []),
          recommendations: getVal(['recommendations', 'recommendation', 'steps', 'suggestions'], [])
        };

        // Ensure recommendations is always an array
        if (!Array.isArray(parsedData.recommendations)) {
          parsedData.recommendations = [String(parsedData.recommendations)];
        }
      } else {
        throw new Error("No JSON object found in response");
      }
    } catch (parseError) {
      console.log("JSON PARSING FAILED:", parseError.message);
    }

    /* =========================================
       DYNAMIC EXTRACTION & SCORING FALLBACK
    ========================================= */

    // If technicalSkills are empty, perform manual extraction
    if (parsedData.technicalSkills.length === 0) {
      console.log("Performing manual skill extraction...");
      parsedData.technicalSkills = extractSkillsFromText(cleanContext || prompt, fallbackTechnicalSkills);
    }

    if (parsedData.softSkills.length === 0) {
      parsedData.softSkills = extractSkillsFromText(cleanContext || prompt, fallbackSoftSkills);
    }

    // Dynamic Scoring Logic (if score is 0 or missing)
    if (parsedData.atsScore <= 0) {
      console.log("Calculating dynamic ATS score fallback...");
      const skillCount = parsedData.technicalSkills.length;
      const baseScore = 60;
      parsedData.atsScore = Math.min(95, baseScore + (skillCount * 5)); // Base 60 + 5 per skill
    }

    console.log("FINAL ATS OBJECT:", parsedData);

    /* =========================================
       SEND RESPONSE TO FRONTEND IMMEDIATELY
    ========================================= */

    res.json({
      success: true,
      response: parsedData
    });

    /* =========================================
       SAVE TO MONGODB ASYNC (ONLY ON STAGE 1)
    ========================================= */

    if (stage === "1" && userData?.uid) {
      console.log("Saving initial ATS report to MongoDB...");
      const newResume = new Resume({
        firebaseUid: userData.uid,
        name: userData.name || "User",
        email: userData.email || "No Email",
        atsScore: parsedData.atsScore || 75,
        technicalSkills: parsedData.technicalSkills || [],
        softSkills: parsedData.softSkills || [],
        recommendations: parsedData.recommendations || []
      });

      newResume.save()
        .then(() => console.log("ATS report saved"))
        .catch((dbError) => console.log("DB Save Error:", dbError.message));
    }

    if (stage === "2" && userData?.uid) {
      console.log("Updating report with Stage 2 insights...");
      try {
        const latest = await Resume.findOne({ firebaseUid: userData.uid }).sort({ createdAt: -1 });
        if (latest) {
          latest.softSkills = Array.from(new Set([...latest.softSkills, ...(parsedData.softSkills || [])]));
          latest.strengths = parsedData.strengths || [];
          latest.weaknesses = parsedData.weaknesses || [];
          latest.recommendations = Array.from(new Set([...latest.recommendations, ...(parsedData.recommendations || [])]));
          latest.technicalSkills = Array.from(new Set([...latest.technicalSkills, ...(parsedData.technicalSkills || [])]));
          await latest.save();
          console.log("Report updated with Stage 2 insights");
        }
      } catch (dbError) {
        console.log("DB Update Error:", dbError.message);
      }
    }

  } catch (error) {

    console.log("--------------------------------");
    console.log("AI ERROR OCCURRED:");
    console.log(error.message);
    console.log("--------------------------------");

    res.status(500).json({
      success: false,
      error: "AI Generation Failed",
      message: error.message
    });
  }
});

/* =========================================
   GET REPORTS ROUTE
========================================= */

app.get("/api/reports/:firebaseUid", async (req, res) => {

  try {

    const { firebaseUid } = req.params;

    const reports = await Resume.find({
      firebaseUid
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      reports
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      error: "Failed to fetch reports"
    });

  }

});

/* =========================================
   ASSESSMENTS ROUTES
========================================= */

// Save Assessment Result
app.post("/api/assessments", async (req, res) => {
  try {
    const { firebaseUid, category, score, strengths, weaknesses, completedQuestions, totalQuestions } = req.body;

    if (!firebaseUid) return res.status(400).json({ success: false, error: "UID required" });

    const assessment = new Assessment({
      firebaseUid,
      category,
      score,
      strengths,
      weaknesses,
      completedQuestions,
      totalQuestions
    });

    await assessment.save();
    res.json({ success: true, message: "Assessment saved" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get Centralized AI Intelligence Profile
app.get("/api/ai-profile/:firebaseUid", async (req, res) => {
  try {
    const { firebaseUid } = req.params;

    const assessments = await Assessment.find({ firebaseUid });
    const resumes = await Resume.find({ firebaseUid }).sort({ createdAt: -1 });

    // Aggregate Scores
    const getAvg = (cat) => {
      const filtered = assessments.filter(a => a.category === cat);
      if (filtered.length === 0) return 0;
      return Math.round(filtered.reduce((acc, curr) => acc + curr.score, 0) / filtered.length);
    };

    const latestResume = resumes[0] || {};

    // Detailed Profile Generation
    const technicalStrength = getAvg("Coding Assessment");
    const communicationConfidence = getAvg("Mock Interview");
    const problemSolving = getAvg("Aptitude Test");
    const designThinking = getAvg("UI/UX Design");
    const aiAdaptability = getAvg("AI Fundamentals");
    const latestAtsScore = latestResume.atsScore || 0;

    // Calculate overall readiness
    const assessmentAvg = assessments.length > 0
      ? assessments.reduce((acc, curr) => acc + curr.score, 0) / assessments.length
      : 0;

    const overallReadiness = Math.round((latestAtsScore + assessmentAvg) / (latestAtsScore > 0 && assessmentAvg > 0 ? 2 : 1)) || 70;

    const profile = {
      overallReadiness,
      technicalStrength,
      communicationConfidence,
      problemSolving,
      designThinking,
      aiAdaptability,
      latestAtsScore,
      totalAssessments: assessments.length,
      allStrengths: Array.from(new Set([
        ...assessments.flatMap(a => a.strengths),
        ...(latestResume.strengths || []),
        ...(latestResume.technicalSkills || [])
      ])).slice(0, 5),
      allWeaknesses: Array.from(new Set([
        ...assessments.flatMap(a => a.weaknesses),
        ...(latestResume.weaknesses || [])
      ])).slice(0, 5),
      history: assessments.sort((a, b) => b.createdAt - a.createdAt)
    };

    // Update CareerAnalytics Persistence
    try {
      await CareerAnalytics.findOneAndUpdate(
        { firebaseUid },
        {
          ...profile,
          aptitudeScore: problemSolving,
          codingScore: technicalStrength,
          uiuxScore: designThinking,
          aiFundamentalsScore: aiAdaptability,
          interviewScore: communicationConfidence,
          atsScore: latestAtsScore,
          updatedAt: new Date()
        },
        { upsert: true }
      );
    } catch (dbError) {
      console.log("Analytics Persistence Error:", dbError.message);
    }

    res.json({ success: true, profile });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/* =========================================
   SERVER START
========================================= */

const PORT = process.env.PORT || 5003;

/* =========================================
   JOB MATCHES ROUTES
========================================= */

app.post("/api/job-matches/generate", async (req, res) => {
  try {
    const { firebaseUid, resumeText, assessments, aiProfile } = req.body;
    if (!firebaseUid) {
      return res.status(400).json({ success: false, error: "Firebase UID is required" });
    }

    console.log(`Generating job matches for user: ${firebaseUid}`);

    const prompt = `System: Recommend 5 career paths. candidate has:
    Resume: ${resumeText || "Analyzing..."}
    Scores: ${JSON.stringify(assessments || {})}
    Profile: ${JSON.stringify(aiProfile || {})}

    Return ONLY raw JSON:
    {
      "matches": [
        {
          "title": "string",
          "company": "string",
          "location": "string",
          "salary": "string",
          "matchScore": number,
          "reason": "string",
          "skillsNeeded": ["string"],
          "tags": ["string"]
        }
      ]
    }`;

    const completion = await client.chat.completions.create({
      model: "deepseek/deepseek-chat",
      messages: [
        { role: "system", content: "You are an AI career matcher. Return ONLY JSON." },
        { role: "user", content: prompt }
      ]
    });

    const aiResponse = completion.choices[0].message.content;
    let matches = [];

    try {
      const first = aiResponse.indexOf('{');
      const last = aiResponse.lastIndexOf('}');
      if (first !== -1 && last !== -1) {
        const json = aiResponse.substring(first, last + 1);
        const parsed = JSON.parse(json);
        matches = Array.isArray(parsed.matches) ? parsed.matches : [];
      }
    } catch (e) {
      console.error("AI JSON Parsing Failed:", e.message);
      // Minimal fallback if AI fails parsing
      matches = [{
        title: "Software Engineer",
        company: "Tech Growth",
        location: "Remote",
        salary: "$80k - $120k",
        matchScore: 85,
        reason: "Based on your technical profile",
        skillsNeeded: ["General Programming"],
        tags: ["Full-time"]
      }];
    }

    // Save to MongoDB safely
    try {
      await JobMatch.deleteMany({ firebaseUid });
      if (matches.length > 0) {
        const mapped = matches.map(m => ({
          ...m,
          firebaseUid,
          generatedAt: new Date()
        }));
        await JobMatch.insertMany(mapped);
      }
    } catch (dbError) {
      console.error("Database save failed:", dbError.message);
    }

    res.json({ success: true, matches });
  } catch (error) {
    console.error("Critical Job Matching Error:", error.message);
    res.status(500).json({ success: false, error: "Internal server error during generation" });
  }
});

app.get("/api/job-matches/:firebaseUid", async (req, res) => {
  try {
    const { firebaseUid } = req.params;
    const matches = await JobMatch.find({ firebaseUid }).sort({ generatedAt: -1 });
    res.json({ success: true, matches });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/* =========================================
   RECRUITER JOB ROUTES
========================================= */

app.post("/api/jobs", async (req, res) => {
  try {
    const { recruiterId, title, company, skillsRequired, description, salary, location, workType, experience } = req.body;
    if (!recruiterId) return res.status(400).json({ success: false, error: "Recruiter ID required" });

    const job = new Job({
      recruiterId,
      title,
      company,
      skillsRequired: Array.isArray(skillsRequired) ? skillsRequired : [],
      description,
      salary,
      location,
      workType,
      experience
    });

    await job.save();
    res.json({ success: true, job });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/api/jobs/recruiter/:recruiterId", async (req, res) => {
  try {
    const { recruiterId } = req.params;
    const jobs = await Job.find({ recruiterId }).sort({ createdAt: -1 });
    res.json({ success: true, jobs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET all jobs for candidates
app.get("/api/jobs", async (req, res) => {
  try {
    const jobs = await Job.find().sort({ createdAt: -1 });
    res.json({ success: true, jobs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST apply for a job
app.post("/api/applications", async (req, res) => {
  try {
    const application = new Application(req.body);
    await application.save();
    res.json({ success: true, application });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET applications for recruiter
app.get("/api/applications/recruiter/:recruiterId", async (req, res) => {
  try {
    const { recruiterId } = req.params;
    const applications = await Application.find({ recruiterId }).sort({ appliedAt: -1 });
    res.json({ success: true, applications });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Notifications
app.get("/api/notifications/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const notifications = await Notification.find({ userId }).sort({ createdAt: -1 }).limit(20);
    res.json({ success: true, notifications });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/notifications", async (req, res) => {
  try {
    const notification = new Notification(req.body);
    await notification.save();
    res.json({ success: true, notification });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 CareerEdge Server running on http://localhost:${PORT}`);
});

/* =========================================
   GLOBAL ERROR HANDLING
========================================= */

process.on("unhandledRejection", (reason) => {

  console.log("--------------------------------");
  console.log("Unhandled Promise Rejection:");
  console.log(reason);
  console.log("--------------------------------");

});

process.on("uncaughtException", (err) => {

  console.log("--------------------------------");
  console.log("Uncaught Exception:");
  console.log(err);
  console.log("--------------------------------");

});