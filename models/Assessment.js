import mongoose from "mongoose";

const assessmentSchema = new mongoose.Schema({
  firebaseUid: { type: String, required: true },
  category: { type: String, required: true },
  score: { type: Number, required: true },
  strengths: { type: [String], default: [] },
  weaknesses: { type: [String], default: [] },
  completedQuestions: { type: Number, default: 0 },
  totalQuestions: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("Assessment", assessmentSchema);
