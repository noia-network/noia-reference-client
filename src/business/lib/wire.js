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
      const ctx = {};
      ws.on('message', async (data) => {
        logger.info(`Incoming message from client: `, data);
        const json = JSON.parse(data);
        try {
          await this._handleMessage(ctx, ws, json);
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

  async _handleMessage(ctx, ws, msg) {
    const action = msg.action;
    switch (action) {
      case 'handshake': {
        await this.onHandshakeWithPeer(ctx, ws, msg);
        break;
      }
      case 'workorder': {
        await this.onWorkOrder(ctx, ws, msg);
        break;
      }
    }
  }

  async onHandshakeWithPeer(ctx, ws, fromMsg) {
    // validate client
    const {msg: fromHsMsg, signedMsg: fromHsSignedMsg, nodeOwnerAddress} = fromMsg;
    const fromSignerAddress = await this.client.recoverAddress(fromHsMsg, fromHsSignedMsg);
    logger.info(`[Master] From Signer address: ${fromSignerAddress}, nodeOwnerAddress: ${nodeOwnerAddress}`);

    // validate the node
    if (!nodeOwnerAddress) {
      const msg = {
        action: 'handshake',
        status: Handshake.REFUSED,
        reason: 'nodeOwnerAddress required for validation!'
      };
      ws.send(JSON.stringify(msg));
      return;
    }
    // const nodeClient = await this.client.getNodeClient(nodeAddress);
    // const nodeOwnerAddress = await nodeClient.getOwnerAddress();
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

    // save the node address with context
    // ctx.nodeAddress = nodeAddress;
    ctx.nodeOwnerAddress = nodeOwnerAddress;
  }

  async onWorkOrder(ctx, ws, fromMsg) {
    const method = fromMsg.method;
    switch (method) {
      case "get": {
        await this.sendWorkOrder(ctx, ws, fromMsg);
        break;
      }
      case "accept": {
        await this.acceptWorkOrder(ctx, ws, fromMsg);
        break;
      }
    }
  }

  async sendWorkOrder(ctx, ws, fromMsg) {
    // check if we already have ongoing work order for the job, if not then create a new one
    const jobPostAddress = fromMsg.jobPost;
    // const workerAddress = ctx.nodeAddress;
    const nodeOwnerAddress = ctx.nodeOwnerAddress;
    const jobPost = await this.client.getJobPost(jobPostAddress);
    await jobPost.contract.getProposedWorkOrders.call(nodeOwnerAddress);

    // send back the workorder address
    const msg = {
      action: 'workorder',
      method: 'get',
      address: "0xaasd"
    };
    ws.send(JSON.stringify(msg));
  }

  async acceptWorkOrder(ctx, ws, fromMsg) {

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
