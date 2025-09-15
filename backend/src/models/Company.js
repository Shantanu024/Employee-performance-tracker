const mongoose = require('mongoose');

const companySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  founderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  coFounders: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  employees: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  companyCode: {
    type: String,
    unique: true,
    required: true
  },
  description: String,
  industry: String,
  website: String
}, {
  timestamps: true
});

companySchema.pre('save', function(next) {
  if (!this.companyCode) {
    this.companyCode = `${this.name.substring(0, 3).toUpperCase()}${Date.now().toString().slice(-6)}`;
  }
  next();
});

module.exports = mongoose.model('Company', companySchema);