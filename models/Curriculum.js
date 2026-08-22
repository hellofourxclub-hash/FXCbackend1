const mongoose = require('mongoose');

const curriculumSchema = new mongoose.Schema({
  modules: [{
    number: String,
    title: String,
    duration: String,
    topics: [String],
  }],
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Curriculum', curriculumSchema);
