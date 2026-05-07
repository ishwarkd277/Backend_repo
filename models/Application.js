import mongoose from "mongoose";

const applicationSchema = new mongoose.Schema({
  jobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    required: true,
    index: true
  },
  candidateId: {
    type: String,
    required: true,
    index: true
  },
  recruiterId: {
    type: String,
    required: true,
    index: true
  },
  candidateName: String,
  candidateEmail: String,
  atsScore: Number,
  readinessScore: Number,
  resumeSummary: String,
  appliedAt: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ["Applied", "Shortlisted", "Interviewing", "Offer", "Rejected"],
    default: "Applied"
  }
});

const Application = mongoose.model("Application", applicationSchema);

export default Application;
