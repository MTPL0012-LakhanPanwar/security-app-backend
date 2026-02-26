const fs = require("fs").promises;
const cron = require("node-cron");
const Facility = require("../models/Facility.model");
const QRCode = require("../models/QRCode.model");
const Device = require("../models/Device.model");
const Enrollment = require("../models/Enrollment.model");
const qrGenerator = require("../utils/qrGenerator");
const { sendEmail, buildDailyQREmail } = require("../utils/emailService");
const mdmService = require("../utils/mdmService");

// basic slugify for filenames/ids
const slugify = (str) =>
  String(str || "facility")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

// Helper: delete file safely
const safeUnlink = async (filePath) => {
  try {
    await fs.unlink(filePath);
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }
};

const RAW_DEFAULT_TZ = process.env.DAILY_QR_TZ || "UTC";
const TZ_ALIASES = {
  IST: "Asia/Kolkata",
};

const normalizeTimeZone = (tz) => {
  const candidate = TZ_ALIASES[tz] || tz || "UTC";
  try {
    // Validate timezone
    new Intl.DateTimeFormat("en-US", { timeZone: candidate }).format();
    return candidate;
  } catch (err) {
    console.warn(
      `Invalid timezone "${tz}" provided; falling back to UTC`
    );
    return "UTC";
  }
};

const DEFAULT_TZ = normalizeTimeZone(RAW_DEFAULT_TZ);

// Compute date string + start/end of day in the facility's timezone (or env default)
function getDateContext(facility, referenceDate = new Date()) {
  const timeZone = normalizeTimeZone(facility?.timezone || DEFAULT_TZ);

  // YYYY-MM-DD for the facility timezone
  const dateStr = referenceDate.toLocaleDateString("en-CA", { timeZone });

  // Offset minutes between facility TZ and UTC at this reference time
  const tzOffsetMinutes =
    (new Date(referenceDate.toLocaleString("en-US", { timeZone })).getTime() -
      referenceDate.getTime()) /
    60000;
  const offsetMs = tzOffsetMinutes * 60 * 1000;

  // Start and end of that day in UTC, respecting the facility timezone
  const [year, month, day] = dateStr.split("-").map(Number);
  const validFrom = new Date(
    Date.UTC(year, month - 1, day, 0, 0, 0, 0) - offsetMs
  );
  const validUntil = new Date(
    Date.UTC(year, month - 1, day, 23, 59, 59, 999) - offsetMs
  );

  return { timeZone, dateStr, validFrom, validUntil };
}

// Generate entry & exit QR for a facility for a given day (defaults to "today" in facility TZ)
async function generateDailyQRsForFacility(facility, referenceDate = new Date()) {
  const { dateStr, validFrom, validUntil } = getDateContext(
    facility,
    referenceDate
  );

  // Expire and remove any existing QR for that facility not matching today's date
  const oldQrs = await QRCode.find({
    facilityId: facility._id,
    $or: [
      { generatedForDate: { $ne: dateStr } },
      { generatedForDate: { $exists: false } },
      { validUntil: { $lt: validFrom } },
    ],
  });

  for (const qr of oldQrs) {
    // expire status
    qr.status = "expired";
    await qr.save();

    if (qr.imagePath) await safeUnlink(qr.imagePath);
  }

  // Remove old QR records entirely (retention 0 days as per requirement)
  await QRCode.deleteMany({
    facilityId: facility._id,
    $or: [
      { generatedForDate: { $ne: dateStr } },
      { generatedForDate: { $exists: false } },
      { validUntil: { $lt: validFrom } },
    ],
  });

  const slug = slugify(facility.name);

  // Entry QR
  const entry = await qrGenerator.generateCompleteQRCode(
    "lock",
    facility._id,
    {
      location: facility.name,
      type: "entry",
    },
    { qrCodeId: `${slug}_Entry_Code_${dateStr}` }
  );

  const entryDoc = await QRCode.create({
    qrCodeId: entry.qrCodeId,
    facilityId: facility._id,
    facilityName: facility.name,
    type: "entry",
    action: "lock",
    token: entry.token,
    url: entry.url,
    imagePath: entry.imagePath,
    metadata: { location: facility.name, type: "entry" },
    status: "active",
    validFrom,
    validUntil,
    generatedForDate: dateStr,
  });

  // Exit QR
  const exit = await qrGenerator.generateCompleteQRCode(
    "unlock",
    facility._id,
    {
      location: facility.name,
      type: "exit",
    },
    { qrCodeId: `${slug}_Exit_Code_${dateStr}` }
  );

  const exitDoc = await QRCode.create({
    qrCodeId: exit.qrCodeId,
    facilityId: facility._id,
    facilityName: facility.name,
    type: "exit",
    action: "unlock",
    token: exit.token,
    url: exit.url,
    imagePath: exit.imagePath,
    metadata: { location: facility.name, type: "exit" },
    status: "active",
    validFrom,
    validUntil,
    generatedForDate: dateStr,
  });

  // Build email
  if (facility.notificationEmails && facility.notificationEmails.length) {
    const html = buildDailyQREmail({
      facilityName: facility.name,
      date: dateStr,
    });

    try {
      await sendEmail({
        to: facility.notificationEmails,
        subject: `Daily QR ${facility.name} — ${dateStr}`,
        html,
        attachments: [
          {
            filename: `ENTRY-${facility.name}-${dateStr}.png`,
            path: entry.imagePath,
          },
          {
            filename: `EXIT-${facility.name}-${dateStr}.png`,
            path: exit.imagePath,
          },
        ],
      });
    } catch (err) {
      console.error(
        `Daily QR email failed for facility ${facility.name}:`,
        err.message
      );
    }
  }

  return { entry: entryDoc, exit: exitDoc };
}

// Deactivate devices/enrollments when daily QR rotates
async function expireActiveEnrollmentsForFacility(facilityId, cutoff) {
  const activeEnrollments = await Enrollment.find({
    facilityId,
    status: "active",
    enrolledAt: { $lt: cutoff },
  }).populate("deviceId");

  for (const enrollment of activeEnrollments) {
    enrollment.status = "expired";
    enrollment.unenrolledAt = new Date();
    await enrollment.save();

    const device = enrollment.deviceId;
    if (device) {
      // Best-effort unlock before marking inactive
      if (device.deviceId && device.deviceInfo?.platform) {
        await mdmService.unlockCamera(
          device.deviceId,
          device.deviceInfo.platform
        );
      }
      device.status = "inactive";
      device.currentFacility = null;
      device.lastEnrollment = enrollment._id;
      await device.save();
    }
  }
}

// Run daily job at 00:05 server time (can be aligned per facility TZ later)
function scheduleDailyJob() {
  const cronExp = process.env.DAILY_QR_CRON || "0 0 * * *"; // default midnight daily
  const timezone = DEFAULT_TZ;

  cron.schedule(
    cronExp,
    async () => {
      const now = new Date();
      const facilities = await Facility.find({ status: "active" });

      for (const facility of facilities) {
        await expireActiveEnrollmentsForFacility(facility._id, now);
        await ensureTodayQRCodes(facility, now);
      }
    },
    { timezone }
  );
}

// Generate if today's QR codes are missing; otherwise leave today's in place
async function ensureTodayQRCodes(facility, referenceDate = new Date()) {
  const { dateStr } = getDateContext(facility, referenceDate);

  const existingToday = await QRCode.countDocuments({
    facilityId: facility._id,
    generatedForDate: dateStr,
    status: "active",
  });

  if (existingToday < 2) {
    return generateDailyQRsForFacility(facility, referenceDate);
  }
  return null;
}

// Run once on startup to ensure today's QR codes exist
async function runDailyJobOnce() {
  const now = new Date();
  const facilities = await Facility.find({ status: "active" });
  for (const facility of facilities) {
    await expireActiveEnrollmentsForFacility(facility._id, now);
    await ensureTodayQRCodes(facility, now);
  }
}

module.exports = {
  scheduleDailyJob,
  runDailyJobOnce,
  generateDailyQRsForFacility,
  expireActiveEnrollmentsForFacility,
};
