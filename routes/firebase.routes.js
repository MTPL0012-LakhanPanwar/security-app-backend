const express = require("express");
const router = express.Router();
const firebaseService = require("../utils/firebaseService");
const auth = require("../middleware/auth");

// Protect all Firebase routes
router.use(auth);

// @desc    Get Firebase service status
// @route   GET /api/firebase/status
router.get("/status", (req, res) => {
  try {
    const status = firebaseService.getStatus();
    return res.status(200).json({
      status: "success",
      data: status,
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: "Failed to get Firebase status",
      error: error.message,
    });
  }
});

// @desc    Send test push notification
// @route   POST /api/firebase/test-push
router.post("/test-push", async (req, res) => {
  try {
    const { pushToken, deviceId, message } = req.body;

    if (!pushToken) {
      return res.status(400).json({
        status: "error",
        message: "pushToken is required",
      });
    }

    const payload = {
      type: "TEST",
      deviceId: deviceId || "test-device",
      title: "CamBlock Test Notification",
      message: message || "This is a test push notification from CamBlock",
    };

    const result = await firebaseService.sendEnhancedPush(pushToken, payload);

    return res.status(200).json({
      status: "success",
      message: "Test push notification sent",
      data: result,
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: "Failed to send test push notification",
      error: error.message,
    });
  }
});

// @desc    Send multicast notification to multiple devices
// @route   POST /api/firebase/multicast
router.post("/multicast", async (req, res) => {
  try {
    const { pushTokens, message, title } = req.body;

    if (!pushTokens || !Array.isArray(pushTokens) || pushTokens.length === 0) {
      return res.status(400).json({
        status: "error",
        message: "pushTokens array is required",
      });
    }

    const payload = {
      type: "MULTICAST",
      title: title || "CamBlock Notification",
      message: message || "Notification to multiple devices",
    };

    const result = await firebaseService.sendMulticastNotification(
      pushTokens,
      payload
    );

    return res.status(200).json({
      status: "success",
      message: "Multicast notification sent",
      data: result,
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: "Failed to send multicast notification",
      error: error.message,
    });
  }
});

module.exports = router;
