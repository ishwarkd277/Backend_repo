import mongoose from "mongoose";

const jobSchema = new mongoose.Schema({
  recruiterId: {
    type: String,
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true
  },
  company: {
    type: String,
    required: true
  },
  experience: String,
  skillsRequired: [String],
  description: String,
  salary: String,
  workType: {
    type: String,
    enum: ["Remote", "On-site", "Hybrid"],
    default: "Remote"
  },
  location: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Job = mongoose.model("Job", jobSchema);

export default Job;
