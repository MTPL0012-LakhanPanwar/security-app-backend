# Enhanced Logging Implementation

This document describes the comprehensive logging system added to help debug QR Entry and Exit failures in production.

## Overview

The enhanced logging system provides detailed visibility into:
- QR scan operations (entry/exit)
- MDM operations (camera lock/unlock)
- Device enrollment lifecycle
- API request tracking
- Error handling with context

## Features

### 1. Structured Logging
- All logs are structured with JSON format for easy parsing
- Consistent timestamp and request ID tracking
- Environment-specific log levels

### 2. Request Tracking
- Unique request ID for each API call
- Request lifecycle logging (start/completion)
- Cross-component traceability

### 3. Specialized Logging Methods

#### QR Operations
```javascript
logger.logQRScan(operation, { deviceId, token, qrCodeId, facilityId, ...meta })
logger.logQRError(operation, error, { deviceId, token, qrCodeId, facilityId, ...meta })
```

#### MDM Operations
```javascript
logger.logMDMOperation(operation, deviceId, platform, result, meta)
```

#### Enrollment Operations
```javascript
logger.logEnrollment(operation, enrollmentData, meta)
```

### 4. Log Levels
- **INFO**: Normal operation flow
- **WARN**: Expected error conditions (validation failures, etc.)
- **ERROR**: Unexpected errors and failures
- **DEBUG**: Detailed debugging info (development only)

## File Structure

```
utils/
├── logger.js           # Main logging utility
├── mdmService.js       # Enhanced MDM service logging
middleware/
├── requestId.js        # Request ID middleware
├── errorHandler.js     # Enhanced error logging
controllers/
├── enrollment.controller.js  # QR API logging
logs/                   # Log files (production only)
├── info.log
├── warn.log
└── error.log
```

## API Endpoints with Enhanced Logging

### QR Entry (`POST /api/enrollments/scan-entry`)
Tracks:
- Request validation
- Token verification (JWT + fallback)
- QR code validation
- Device creation/updates
- Enrollment conflicts
- MDM camera lock operations
- Database operations

### QR Exit (`POST /api/enrollments/scan-exit`)
Tracks:
- Request validation
- Token verification
- QR code validation
- Device and enrollment lookup
- Facility matching
- MDM camera unlock operations
- Enrollment completion

### Restore from Push (`POST /api/enrollments/restore-from-push`)
Tracks:
- Token validation
- Device lookup
- Best-effort unlock operations
- Enrollment cleanup

## Log Examples

### Successful QR Entry
```
[2026-04-16T07:44:07.499Z] INFO: Scan entry request received {"requestId":"req-123","deviceId":"device-456","platform":"android"}
[2026-04-16T07:44:07.500Z] INFO: QR entry scan initiated {"operation":"entry","deviceId":"device-456","token":"token-abc..."}
[2026-04-16T07:44:07.501Z] INFO: MDM lockCamera successful {"operation":"lockCamera","deviceId":"device-456","platform":"android"}
[2026-04-16T07:44:07.502Z] INFO: Entry scan completed successfully {"requestId":"req-123","deviceId":"device-456"}
```

### QR Entry Failure
```
[2026-04-16T07:44:07.503Z] ERROR: QR entry failed {"operation":"entry","deviceId":"device-456","error":"Invalid token","stack":"..."}
[2026-04-16T07:44:07.504Z] WARN: Validation failed {"requestId":"req-123","error":"Token and deviceId are required"}
```

## Production Configuration

In production (`NODE_ENV=production`):
- Logs are written to files in the `logs/` directory
- Separate files for different log levels
- Debug logs are suppressed
- Structured JSON format for log aggregation

## Debugging Production Issues

### 1. Search by Request ID
```bash
grep "req-123" logs/*.log
```

### 2. Find QR Scan Failures
```bash
grep "QR.*failed" logs/error.log
```

### 3. Track MDM Issues
```bash
grep "MDM.*failed" logs/error.log
```

### 4. Monitor Device Activity
```bash
grep "device-456" logs/*.log
```

## Environment Variables

- `NODE_ENV`: Set to 'production' to enable file logging
- `LOG_LEVEL`: Override default log level (optional)

## Testing

Run the logging test:
```bash
node test-logging.js
```

## Benefits for Production Debugging

1. **Root Cause Analysis**: Detailed error context and stack traces
2. **Request Tracing**: Complete request lifecycle visibility
3. **Performance Monitoring**: Timing information for operations
4. **Audit Trail**: Complete record of QR scan operations
5. **Integration Debugging**: MDM operation logging with success/failure status

## Log Rotation

Consider implementing log rotation for production:
- Daily log files
- Compression of old logs
- Retention policy (e.g., 30 days)

## Monitoring Integration

The structured logs can be easily integrated with:
- ELK Stack (Elasticsearch, Logstash, Kibana)
- Splunk
- Datadog
- CloudWatch Logs
- Other log aggregation platforms
