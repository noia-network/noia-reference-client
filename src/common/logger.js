const winston = require('winston');

const options = {
  transports: [
    new winston.transports.Console({
      colorize: true,
      label: "noia-node",
      json: false
    })
  ],
  exitOnError: false
};

module.exports = winston.createLogger(options);
