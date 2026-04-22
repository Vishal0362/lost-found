const express = require("express");
const router = express.Router();
const multer = require("multer");
const Item = require("../models/Item");

// Image storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  }
});

const upload = multer({ storage });

// POST: Upload item
router.post("/upload", upload.single("image"), async (req, res) => {
  try {
    const { title, description, type, lat, lng } = req.body;

    const newItem = new Item({
      title,
      description,
      type,
      image: req.file.filename,
      location: {
        lat: Number(lat),
        lng: Number(lng)
}
    });

    await newItem.save();

    res.json({ message: "Item uploaded successfully", newItem });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET: Fetch all items
router.get("/", async (req, res) => {
  const items = await Item.find().sort({ createdAt: -1 });
  res.json(items);
});

module.exports = router;