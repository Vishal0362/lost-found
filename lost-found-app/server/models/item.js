const mongoose = require("mongoose");

const itemSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1200,
      default: "",
    },
    image: {
      type: String,
      default: "",
    },
    type: {
      type: String,
      enum: ["lost", "found"],
      required: true,
    },
    category: {
      type: String,
      enum: ["electronics", "pets", "documents", "bags", "jewelry", "keys", "clothing", "other"],
      default: "other",
    },
    status: {
      type: String,
      enum: ["active", "resolved"],
      default: "active",
    },
    reward: {
      type: Number,
      min: 0,
      default: 0,
    },
    contactName: {
      type: String,
      trim: true,
      maxlength: 80,
      default: "",
    },
    contactInfo: {
      type: String,
      trim: true,
      maxlength: 160,
      default: "",
    },
    dateOfIncident: {
      type: Date,
      default: Date.now,
    },
    location: {
      lat: {
        type: Number,
        required: true,
      },
      lng: {
        type: Number,
        required: true,
      },
      label: {
        type: String,
        trim: true,
        maxlength: 140,
        default: "",
      },
    },
  },
  {
    timestamps: true,
  }
);

itemSchema.index({ type: 1, category: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model("Item", itemSchema);
