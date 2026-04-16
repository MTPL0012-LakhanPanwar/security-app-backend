const fs = require('fs');
const path = require('path');
const cron = require('node-cron');

class Logger {
  constructor() {
    this.logDir = path.join(__dirname, '../logs');
    this.ensureLogDirectory();
  }

  ensureLogDirectory() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const metaString = Object.keys(meta).length > 0 ? JSON.stringify(meta) : '';
    return `[${timestamp}] ${level.toUpperCase()}: ${message} ${metaString}`;
  }

  writeToFile(level, formattedMessage) {
    const logFile = path.join(this.logDir, `${level}.log`);
    fs.appendFileSync(logFile, formattedMessage + '\n');
  }

  log(level, message, meta = {}) {
    const formattedMessage = this.formatMessage(level, message, meta);
    
    // Always log to console
    console.log(formattedMessage);
    
    // Write to file in production
    if (process.env.NODE_ENV === 'production') {
      this.writeToFile(level, formattedMessage);
    }
  }

  info(message, meta = {}) {
    this.log('info', message, meta);
  }

  warn(message, meta = {}) {
    this.log('warn', message, meta);
  }

  error(message, meta = {}) {
    const formattedMessage = this.formatMessage('error', message, meta);
    
    // Always log to console
    console.error(formattedMessage);
    
    // Write to file in production
    if (process.env.NODE_ENV === 'production') {
      this.writeToFile('error', formattedMessage);
    }
  }

  debug(message, meta = {}) {
    if (process.env.NODE_ENV === 'development') {
      this.log('debug', message, meta);
    }
  }

  // Specialized logging methods for QR operations
  logQRScan(operation, { deviceId, token, qrCodeId, facilityId, ...meta }) {
    this.info(`QR ${operation} scan initiated`, {
      operation,
      deviceId,
      token: token ? token.substring(0, 20) + '...' : 'none',
      qrCodeId,
      facilityId,
      timestamp: new Date().toISOString(),
      ...meta
    });
  }

  logQRError(operation, error, { deviceId, token, qrCodeId, facilityId, ...meta }) {
    this.error(`QR ${operation} failed`, {
      operation,
      deviceId,
      token: token ? token.substring(0, 20) + '...' : 'none',
      qrCodeId,
      facilityId,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      ...meta
    });
  }

  logMDMOperation(operation, deviceId, platform, result, meta = {}) {
    if (result.success) {
      this.info(`MDM ${operation} successful`, {
        operation,
        deviceId,
        platform,
        timestamp: new Date().toISOString(),
        ...meta
      });
    } else {
      this.error(`MDM ${operation} failed`, {
        operation,
        deviceId,
        platform,
        error: result.error,
        timestamp: new Date().toISOString(),
        ...meta
      });
    }
  }

  logEnrollment(operation, enrollmentData, meta = {}) {
    this.info(`Enrollment ${operation}`, {
      operation,
      enrollmentId: enrollmentData.enrollmentId,
      deviceId: enrollmentData.deviceId,
      facilityId: enrollmentData.facilityId,
      status: enrollmentData.status,
      timestamp: new Date().toISOString(),
      ...meta
    });
  }

  // Clean up old log files (older than 5 days)
  cleanupOldLogs() {
    try {
      const logFiles = fs.readdirSync(this.logDir);
      const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
      let deletedCount = 0;
      let totalSize = 0;

      logFiles.forEach(file => {
        const filePath = path.join(this.logDir, file);
        const stats = fs.statSync(filePath);
        
        if (stats.isFile() && stats.mtime < fiveDaysAgo) {
          totalSize += stats.size;
          fs.unlinkSync(filePath);
          deletedCount++;
          
          this.info('Old log file deleted', {
            file,
            fileSize: stats.size,
            fileModified: stats.mtime.toISOString(),
            deletedAt: new Date().toISOString()
          });
        }
      });

      if (deletedCount > 0) {
        this.info('Log cleanup completed', {
          deletedFiles: deletedCount,
          totalSizeFreed: totalSize,
          cleanupDate: new Date().toISOString()
        });
      }
    } catch (error) {
      this.error('Log cleanup failed', {
        error: error.message,
        stack: error.stack
      });
    }
  }

  // Schedule automatic log cleanup (runs daily at 2 AM)
  scheduleLogCleanup() {
    // Schedule daily cleanup at 2:00 AM
    cron.schedule('0 2 * * *', () => {
      this.info('Starting scheduled log cleanup');
      this.cleanupOldLogs();
    });

    // Run cleanup immediately on startup
    setTimeout(() => {
      this.info('Running initial log cleanup on startup');
      this.cleanupOldLogs();
    }, 5000); // Wait 5 seconds after server start
  }
}

module.exports = new Logger();
