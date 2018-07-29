const EventEmitter = require("events");
const http = require("http");
const WebSocket = require("ws");
const logger = require('../../common/logger');

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
        try {
          const json = JSON.parse(data);
          await this._handleMessage(ws, json);
        } catch (err) {
          logger.error(`Error while processing incoming message!`, err);
          console.log(err);
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
    const {msg: fromHsMsg, signedMsg: fromHsSignedMsg} = fromMsg;
    const fromSignerAddress = await this.client.recoverAddress(fromHsMsg, fromHsSignedMsg);
    logger.info(`[Master] From Signer address: ${fromSignerAddress}`);

    // send back master validation request to client node
    const hsMsg = this.client.getHandshakeMessage();
    const signedMsg = await this.client.signMessage(hsMsg);
    const msg = {
      action: 'handshake',
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
