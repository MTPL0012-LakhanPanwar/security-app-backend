const fs = require("fs").promises;

// Safely delete a file; ignore if it does not exist
const safeUnlink = async (filePath) => {
  if (!filePath) return;
  try {
    await fs.unlink(filePath);
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }
};

module.exports = { safeUnlink };
