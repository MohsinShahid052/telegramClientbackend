const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema(
  {
    sessionToken: { type: String, required: true, unique: true },
    userId: { type: String, required: true },
    firstName: { type: String },
    lastName: { type: String },
    phoneNumber: { type: String, required: true },
    sessionData: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Session', sessionSchema);
