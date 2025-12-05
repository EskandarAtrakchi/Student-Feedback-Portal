const path = require('path');
const fs = require('fs');
// Winston logger setup
const { createLogger, format, transports } = require('winston');

// Ensure logs directory exists
const logDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logDir)) {// Create logs directory if it doesn't exist
  fs.mkdirSync(logDir);
} 
// Create Winston logger instance
const logger = createLogger({ 
  level: 'info',
  format: format.combine(
    format.timestamp(),
    format.json()
  ),
  transports: [
    // Log to file
    new transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error'
    }),
    new transports.File({// General log file
      filename: path.join(logDir, 'app.log')
    })
  ]
});

// Also log to console in development
if (process.env.NODE_ENV !== 'production') {
  logger.add(// Console transport
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.simple()
      )
    })
  );
}
// Export the logger
module.exports = logger;

