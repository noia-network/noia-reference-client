const EventEmitter = require("events");

class Master extends EventEmitter {
  constructor() {
    super();

  }

  connect(address) {
    console.log(`Connecting to the master! address: ${address}`);
  }
}

module.exports = Master;
