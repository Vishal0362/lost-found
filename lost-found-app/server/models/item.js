const mongoose = require("mongoose");

const itemSchema = new mongoose.Schema({
  title: String,
  description: String,
  image: String,
  type: {
    type: String,
    enum: ["lost", "found"]
  },
  location: {
    lat: Number,
    lng: Number
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("Item", itemSchema);