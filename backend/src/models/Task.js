const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  points: {
    type: Number,
    required: true,
    min: 0
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  deadline: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'in-progress', 'submitted', 'completed', 'rejected'],
    default: 'pending'
  },
  submissionFiles: [{
    url: String,
    publicId: String,
    fileType: String,
    uploadedAt: Date
  }],
  submissionNote: String,
  submittedAt: Date,
  evaluationStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'needs-revision'],
    default: 'pending'
  },
  evaluationNote: String,
  evaluatedAt: Date,
  evaluatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  pointsAwarded: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Task', taskSchema);