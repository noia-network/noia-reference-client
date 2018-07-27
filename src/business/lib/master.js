const EventEmitter = require("events");
const http = require("http");
const WebSocket = require("ws");
const logger = require('../../common/logger');

class Master extends EventEmitter {
  constructor() {
    super();
    this.httpServer = http.createServer();
    this.wss = new WebSocket.Server({ server: this.httpServer });
  }

  async start(host, port) {
    // listen connection before starting a http server
    this.wss.on("connection", (ws, req) => {
      console.log(`Wss connection! `);
      ws.on('message', (data) => {
        logger.info(`Incoming master message: `, data);
        const json = JSON.parse(message);
        this._handleMessage(json);
      });
    });

    //
    return new Promise((resolve, reject) => {
      this.httpServer.listen(port, host, (err) => {
        if (err) {
          return reject(err);
        }
        resolve();
      });
    });
  }

  _handleMessage(msg) {
    const action = msg.action;
    switch (action) {
      case 'handshake': {
        logger.info();
        break;
      }
    }
  }

  async nextMessage() {

  }

  async stop() {
    return new Promise((resolve, reject) => {
      this.httpServer.close(() => {
        resolve();
      });
    });
  }
}

module.exports = Master;
