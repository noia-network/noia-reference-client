const EventEmitter = require("events");
const logger = require('../common/logger');
const {readFile, writeFile, TimeoutError} = require('../common/utils');
const NodeClient = require('./lib/client');
const Master = require('./lib/master');

// Node configuration
const walletMnemonic = 'ill song party come kid carry calm captain state purse weather ozone';
const walletProvider = {
  url: 'http://eth.oja.me:3304/dev',
  apiKey: 'MK3M5ni1gTvArFO6FSJh9IVlb0s5BqN8CAFkGq0d'
}
const nodeConfig = {
  ip: '127.0.0.1',
  wsPort: 7676,
  // domain: 'noia.oja.me'
}

class Node extends EventEmitter {
  constructor() {
    super();

    this.master = new Master();
    this.client = new NodeClient(walletMnemonic, walletProvider, nodeConfig);
  }

  async start() {
    logger.info(`Starting node client!`);

    // read the network id
    const networkId = await this.client.getNetworkId();

    // read the node aadress in Noia system - if not provided then a new Node is created automatically when first started
    const nodeAddressFilePath = `./${networkId}-node-address.txt`;
    let noiaNodeAddress = await this.readAddress(nodeAddressFilePath);

    // register a node with Noia network
    const registeredNode = await this.client.registerNode(noiaNodeAddress);
    if (!registeredNode) {
      console.log(`Node not Registered in NOIA network`);
      return;
    }
    console.log(`Registered Node address: ${registeredNode.address}`);

    // save the node Noia address if different
    if (registeredNode.address !== noiaNodeAddress) {
      await writeFile(nodeAddressFilePath, registeredNode.address);
    }
    noiaNodeAddress = registeredNode.address;

    // TODO! how to stop here finding next job posts?
    // TODO! how to check if we have already processed next job post
    let jobPost;
    while (true) {
      try {
        jobPost = await this.client.findNextJob();
        break;
      } catch (err) {
        if (!(err instanceof TimeoutError)) {
          // if not timeout then rethrow
          throw err;
        }
        logger.info(`Timeout waiting for the next job! Retrying ...`);
      }
    }
    console.log(`Job post found! Job @address: ${jobPost.address}, job post info: ${JSON.stringify(jobPost.info)}`);

    // get employer
    const employerAddress = await jobPost.getEmployerAddress();
    const employer = await this.client.getBusinessClient(employerAddress);
    console.log(`Employer! @address: ${employer.address}, employer info: ${JSON.stringify(employer.info)}`);

    // connect to master and start listening events
    const {node_ip, node_ws_port} = employer.info;
    const masterWsAddress = `ws://${node_ip}:${node_ws_port}`;
    await this.master.connect(masterWsAddress);

    // validate the master - send random string and wait for the signed answer
    const msg = this.client.getHandshakeMessage();
    const signedMsg = await this.client.signMessage(msg);
    const isValid = await this.master.validateEndpoint(msg, signedMsg);

    //

  }

  async readAddress(addressFilePath) {
    let nodeAddress;
    try {
      nodeAddress = await readFile(addressFilePath);
    } catch (err) {
      console.log(`Cannot find Node aadress from file: ${addressFilePath}`);
    }
    console.log(`Node aadress: ${nodeAddress}`);
    return nodeAddress;
  }
}

module.exports = Node;
