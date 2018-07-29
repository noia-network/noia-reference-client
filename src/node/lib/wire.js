const EventEmitter = require("events");
const WebSocket = require("ws");
const logger = require('../../common/logger');
const {Handshake, HandshakeError} = require('../../common/wire');

const READY_STATE_CONNECTING = 0;
const READY_STATE_OPEN = 1;
const READY_STATE_CLOSING = 2;
const READY_STATE_CLOSED = 3;

class Wire extends EventEmitter {
  constructor(client) {
    super();
    this.client = client;
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

    this.conn.on("message", async (data) => {
      logger.info(`Incoming node message: `, data);
      try {
        const json = JSON.parse(data);
        await this._handleMessage(json);
      } catch (err) {
        logger.error(`Error while processing incoming message!`, err);
      }
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

  async _handleMessage(msg) {
    const action = msg.action;
    switch (action) {
      case 'handshake': {
        await this.onHandshakeWithPeer(msg);
        break;
      }
    }
  }

  async onHandshakeWithPeer(msg) {
    const status = msg.status;
    if (status === Handshake.REFUSED) {
      // peer did not validate our signature that we sent
      return this.emit('handshake', new HandshakeError(msg.reason));
    }
    this.emit("handshake", msg);
  }

  async validatePeers() {
    await this._connected();

    // first, send node validation request to master
    const hsMsg = this.client.getHandshakeMessage();
    const signedMsg = await this.client.signMessage(hsMsg);
    const msg = {
      action: 'handshake',
      msg: hsMsg,
      signedMsg: signedMsg
    };
    this.conn.send(JSON.stringify(msg));

    // wait for master validation result
    return new Promise((resolve, reject) => {
      this.once("handshake", async (msg) => {
        // check if master failed validating us - a node
        if (msg instanceof HandshakeError) {
          return reject(msg.message);
        }

        // now, validate the master - a validation request it sent to us
        const {msg: fromHsMsg, signedMsg: fromHsSignedMsg} = msg;
        const fromSignerAddress = await this.client.recoverAddress(fromHsMsg, fromHsSignedMsg);
        logger.info(`[Node] From Signer address: ${fromSignerAddress}`);

        resolve(msg);
      });
    });
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

module.exports = Wire;
