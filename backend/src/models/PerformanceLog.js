const mongoose = require('mongoose');

const performanceLogSchema = new mongoose.Schema({
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  hoursWorked: {
    type: Number,
    default: 0,
    min: 0,
    max: 24
  },
  pointsEarned: {
    type: Number,
    default: 0,
    min: 0
  },
  tasksCompleted: {
    type: Number,
    default: 0
  },
  taskIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task'
  }]
}, {
  timestamps: true
});

performanceLogSchema.index({ employeeId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('PerformanceLog', performanceLogSchema);