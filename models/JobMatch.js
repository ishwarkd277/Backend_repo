import mongoose from "mongoose";

const jobMatchSchema = new mongoose.Schema({
  firebaseUid: {
    type: String,
    required: true,
    index: true
  },
  title: String,
  company: String,
  location: String,
  salary: String,
  matchScore: Number,
  reason: String,
  skillsNeeded: [String],
  tags: [String],
  generatedAt: {
    type: Date,
    default: Date.now
  }
});

const JobMatch = mongoose.model("JobMatch", jobMatchSchema);

export default JobMatch;
