const EventEmitter = require("events");
const WebSocket = require("ws");
const logger = require('../../common/logger');

const READY_STATE_CONNECTING = 0;
const READY_STATE_OPEN = 1;
const READY_STATE_CLOSING = 2;
const READY_STATE_CLOSED = 3;

class Master extends EventEmitter {
  constructor() {
    super();

  }

  async connect(address) {
    console.log(`Connecting to the master! address: ${address}`);
    this.conn = new WebSocket(address);

    //
    if (this.conn.readyState === READY_STATE_CONNECTING) {
      this.conn.on("open", () => {
        this.connected = true;
        this.emit("connected");
      })
    } else if (this.conn.readyState === READY_STATE_OPEN) {
      this.connected = true;
      this.emit("connected");
    } else {
      throw new Error("something went wrong while opening connection");
    }

    this.conn.onerror = (error) => {
      this.closed = error;
      this.emit("connected", error);
    }

    this.conn.onclose = (event) => {
      if (this.closed) return;
      this.closed = { reason: event.reason, code: event.code };
      this.emit("connected", this.closed);
    }

    this.conn.on("message", (data) => {
      logger.info(`Incoming node message: `, data);
      const json = JSON.parse(data);
      this._handleMessage(json);
    })
  }

  _connected() {
    return new Promise((resolve, reject) => {
      if (this.closed) {
        return reject(this.closed);
      }
      if (this.connected) {
        return resolve();
      }
      this.once('connected', (err) => {
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

        break;
      }
    }
  }

  async validateEndpoint(hsMsg, signedMsg) {
    await this._connected();

    // start listening response


    // send
    const msg = {
      action: 'handshake',
      msg: hsMsg,
      signedMsg: signedMsg
    };
    this.conn.send(JSON.stringify(msg));

    // wait for response

  }

  async nextMessage() {
    return new Promise((resolve, reject) => {
      this.once('connected', (err) => {
        if (err) {
          return reject(err);
        }
        resolve();
      });
    });
  }
}

module.exports = Master;
