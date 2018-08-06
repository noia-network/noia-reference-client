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
      case 'workorder': {
        await this.onWorkOrder(msg);
        break;
      }
    }
  }

  async onHandshakeWithPeer(msg) {
    const status = msg.status;
    if (status === Handshake.REFUSED || status === Handshake.ERROR) {
      // peer did not validate our signature that we sent or there was some error in validation
      return this.emit('handshake', new HandshakeError(msg.reason));
    }
    this.emit("handshake", msg);
  }

  async onWorkOrder(msg) {
    this.emit(`workorder_${msg.method}`, msg);
  }

  async validatePeers(nodeAddress, employerAddress) {
    await this._connected();

    // first, send node validation request to master
    const hsMsg = this.client.getHandshakeMessage();
    const signedMsg = await this.client.signMessage(hsMsg);
    const msg = {
      action: 'handshake',
      msg: hsMsg,
      signedMsg: signedMsg,
      nodeAddress: nodeAddress
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
        try {
          const {msg: fromHsMsg, signedMsg: fromHsSignedMsg} = msg;
          const fromSignerAddress = await this.client.recoverAddress(fromHsMsg, fromHsSignedMsg);
          logger.info(`[Node] From Signer address: ${fromSignerAddress}`);

          const employer = await this.client.getBusinessClient(employerAddress);
          const employerOwnerAddress = await employer.getOwnerAddress();
          logger.info(`[Node] Signer address: ${fromSignerAddress}, employer owner address: ${employerOwnerAddress}`);
          if (employerOwnerAddress !== fromSignerAddress) {
            const reason = `employer ownerAddress: ${employerOwnerAddress} is not same as peer signer address: ${fromSignerAddress}`;
            return reject(reason);
          }
          resolve(msg);
        } catch (err) {
          return reject(err);
        }
      });
    });
  }

  async getWorkOrder(jobPostAddress) {
    await this._connected();

    // first, send node validation request to master
    const msg = {
      action: 'workorder',
      method: "get",
      jobPost: jobPostAddress
    };
    this.conn.send(JSON.stringify(msg));

    // wait for business to return us the work order for the job post
    return new Promise((resolve, reject) => {
      this.once("workorder_get", async (msg) => {
        // check if master failed validating us - a node
        if (msg instanceof WireError) {
          return reject(msg.message);
        }
        try {
          const {address: workOrderAddress} = msg;
          logger.info(`[Node] Work order address: ${workOrderAddress}`);

          // TODO! get the work order and return it
          const workOrder = null;

          resolve(workOrder);
        } catch (err) {
          return reject(err);
        }
      });
    });
  }

  async acceptWorkOrder(workOrderAddress) {
    await this._connected();

    // first, send node validation request to master
    const msg = {
      action: 'workorder',
      method: "accept",
      workOrder: workOrderAddress,
      nonce: 0
    };
    // bytes memory msgPacked = abi.encodePacked(address(this), _accept, _nonce);
    // web3.eth.abi.encodeParameters(['uint256','bool', 'uint256'], ['2345675643', 'Hello!%']);
    msg.sig = await this.client.signMessage(hsMsg);
    this.conn.send(JSON.stringify(msg));

    // wait for master validation result
    return new Promise((resolve, reject) => {
      this.once("workorder_accept", async (msg) => {
        // check if master failed validating us - a node
        if (msg instanceof WireError) {
          return reject(msg.message);
        }

        // now, validate the master - a validation request it sent to us
        try {
          const {status} = msg;
          logger.info(`[Node] Accept status: ${status}`);
          resolve(msg);
        } catch (err) {
          return reject(err);
        }
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
