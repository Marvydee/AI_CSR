import express from "express";
import MultilingualService from "../services/MultilingualService.js";

const router = express.Router();

// GET /api/multilingual/languages
router.get("/languages", async (req, res) => {
  try {
    const langs = MultilingualService.getSupportedLanguages();
    res.json(langs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/multilingual/analytics/:businessId
router.get("/analytics/:businessId", async (req, res) => {
  try {
    const { businessId } = req.params;
    const analytics =
      await MultilingualService.getLanguageUsageAnalytics(businessId);
    res.json(analytics);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
