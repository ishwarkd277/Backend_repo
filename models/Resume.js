import mongoose from "mongoose";

const resumeSchema = new mongoose.Schema({
  firebaseUid: {
    type: String,
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  atsScore: {
    type: Number,
    default: 0
  },
  technicalSkills: {
    type: [String],
    default: []
  },
  strengths: {
    type: [String],
    default: []
  },
  weaknesses: {
    type: [String],
    default: []
  },
  recommendations: {
    type: [String],
    default: []
  },
  softSkills: {
    type: [String],
    default: []
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Resume = mongoose.model("Resume", resumeSchema);

export default Resume;
