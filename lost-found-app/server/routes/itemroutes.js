const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const Item = require("../models/item");

const router = express.Router();
const uploadsDir = path.join(__dirname, "..", "uploads");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const toRadians = (value) => (value * Math.PI) / 180;

const getDistanceKm = (lat1, lng1, lat2, lng2) => {
  const earthRadiusKm = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) ** 2;

  return earthRadiusKm * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/\s+/g, "-");
    cb(null, `${Date.now()}-${safeName}`);
  },
});

const upload = multer({ storage });

router.post("/upload", upload.single("image"), async (req, res) => {
  try {
    const {
      title,
      description,
      type,
      category,
      reward,
      contactName,
      contactInfo,
      dateOfIncident,
      lat,
      lng,
      locationLabel,
    } = req.body;

    if (!title || !type || lat === undefined || lng === undefined) {
      return res.status(400).json({ error: "Title, type, and coordinates are required." });
    }

    const newItem = new Item({
      title,
      description,
      type,
      category,
      reward: Number(reward) || 0,
      contactName,
      contactInfo,
      dateOfIncident: dateOfIncident || Date.now(),
      image: req.file ? req.file.filename : "",
      location: {
        lat: Number(lat),
        lng: Number(lng),
        label: locationLabel || "",
      },
    });

    await newItem.save();

    res.status(201).json({ message: "Item uploaded successfully", item: newItem });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/", async (req, res) => {
  try {
    const {
      type,
      category,
      status = "active",
      search,
      sort = "latest",
      lat,
      lng,
      maxDistance,
    } = req.query;

    const query = {};

    if (type && type !== "all") {
      query.type = type;
    }

    if (category && category !== "all") {
      query.category = category;
    }

    if (status && status !== "all") {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { "location.label": { $regex: search, $options: "i" } },
      ];
    }

    const items = await Item.find(query).sort({ createdAt: -1 }).lean();
    const hasViewerLocation = lat !== undefined && lng !== undefined;
    const viewerLat = Number(lat);
    const viewerLng = Number(lng);
    const maxDistanceKm = maxDistance ? Number(maxDistance) : null;

    let enriched = items.map((item) => {
      if (!hasViewerLocation) {
        return item;
      }

      return {
        ...item,
        distanceKm: getDistanceKm(viewerLat, viewerLng, item.location.lat, item.location.lng),
      };
    });

    if (hasViewerLocation && Number.isFinite(maxDistanceKm)) {
      enriched = enriched.filter((item) => item.distanceKm <= maxDistanceKm);
    }

    if (sort === "nearest" && hasViewerLocation) {
      enriched.sort((a, b) => a.distanceKm - b.distanceKm);
    }

    res.json(enriched);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/summary", async (req, res) => {
  try {
    const items = await Item.find().lean();
    const summary = items.reduce(
      (acc, item) => {
        acc.total += 1;
        acc[item.type] += 1;
        if (item.status === "resolved") {
          acc.resolved += 1;
        } else {
          acc.active += 1;
        }
        return acc;
      },
      { total: 0, lost: 0, found: 0, active: 0, resolved: 0 }
    );

    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch("/:id/status", async (req, res) => {
  try {
    const { status } = req.body;

    if (!["active", "resolved"].includes(status)) {
      return res.status(400).json({ error: "Invalid status." });
    }

    const item = await Item.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    );

    if (!item) {
      return res.status(404).json({ error: "Item not found." });
    }

    res.json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
