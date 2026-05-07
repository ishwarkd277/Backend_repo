import mongoose from "mongoose";

const careerAnalyticsSchema = new mongoose.Schema({
  firebaseUid: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  overallScore: Number,
  aptitudeScore: Number,
  codingScore: Number,
  uiuxScore: Number,
  aiFundamentalsScore: Number,
  interviewScore: Number,
  atsScore: Number,
  hiringProbability: Number,
  careerReadiness: Number,
  technicalSkills: [String],
  softSkills: [String],
  weaknesses: [String],
  strengths: [String],
  learningPath: [{
    week: String,
    title: String,
    desc: String
  }],
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

const CareerAnalytics = mongoose.model("CareerAnalytics", careerAnalyticsSchema);

export default CareerAnalytics;
