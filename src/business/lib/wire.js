const EventEmitter = require("events");
const http = require("http");
const WebSocket = require("ws");
const logger = require('../../common/logger');
const {Handshake} = require('../../common/wire');

class Wire extends EventEmitter {
  constructor(client) {
    super();
    this.client = client;
    this.httpServer = http.createServer();
    this.wss = new WebSocket.Server({ server: this.httpServer });
  }

  async listen(host, port) {
    // listen connection before starting a http server
    this.wss.on("connection", (ws, req) => {
      console.log(`Wss connection! `);
      ws.on('message', async (data) => {
        logger.info(`Incoming message from client: `, data);
        const json = JSON.parse(data);
        try {
          await this._handleMessage(ws, json);
        } catch (err) {
          logger.error(`Error while processing incoming message!`, err);
          console.log(err);

          // send back an error
          json.status = Handshake.ERROR;
          json.reason = err.message;
          ws.send(JSON.stringify(json));
        }
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

  async _handleMessage(ws, msg) {
    const action = msg.action;
    switch (action) {
      case 'handshake': {
        await this.onHandshakeWithPeer(ws, msg);
        break;
      }
    }
  }

  async onHandshakeWithPeer(ws, fromMsg) {
    // validate client
    const {msg: fromHsMsg, signedMsg: fromHsSignedMsg, nodeAddress} = fromMsg;
    const fromSignerAddress = await this.client.recoverAddress(fromHsMsg, fromHsSignedMsg);
    logger.info(`[Master] From Signer address: ${fromSignerAddress}, nodeAddress: ${nodeAddress}`);

    // validate the node
    if (!nodeAddress) {
      const msg = {
        action: 'handshake',
        status: Handshake.REFUSED,
        reason: 'nodeAddress required for validation!'
      };
      ws.send(JSON.stringify(msg));
      return;
    }
    const nodeClient = await this.client.getNodeClient(nodeAddress);
    const nodeOwnerAddress = await nodeClient.getOwnerAddress();
    logger.info(`[Master] Signer address: ${fromSignerAddress}, node owner address: ${nodeOwnerAddress}`);
    if (nodeOwnerAddress !== fromSignerAddress) {
      const msg = {
        action: 'handshake',
        status: Handshake.REFUSED,
        reason: `node ownerAddress: ${nodeOwnerAddress} is not same as client signer address: ${fromSignerAddress}`
      };
      ws.send(JSON.stringify(msg));
      return;
    }

    // send back master validation request to client node
    const hsMsg = this.client.getHandshakeMessage();
    const signedMsg = await this.client.signMessage(hsMsg);
    const msg = {
      action: 'handshake',
      status: Handshake.DONE,
      msg: hsMsg,
      signedMsg: signedMsg
    };
    ws.send(JSON.stringify(msg));
  }

  async stop() {
    return new Promise((resolve, reject) => {
      this.httpServer.close(() => {
        resolve();
      });
    });
  }
}

module.exports = Wire;
