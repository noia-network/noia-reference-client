const EventEmitter = require("events");

class Master extends EventEmitter {
  constructor() {
    super();

  }

  connect(address, employerAddress) {
    console.log(`Connecting to the master! address: ${address}, employerAddress: ${employerAddress}`);
  }
}

module.exports = Master;
