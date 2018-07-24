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
  wsPort: 7676,
  domain: 'noia.oja.me'
}

class Node extends EventEmitter {
  constructor() {
    super();

    this.master = new Master();
    this.client = new NodeClient(walletMnemonic, walletProvider, nodeConfig);
  }

  async start() {
    logger.info(`Starting node client!`);

    // read the node aadress in Noia system - if not provided then a new Node is created automatically when first started
    const nodeAddressFilePath = './node-address.txt';
    let noiaNodeAddress = await this.readAddress(nodeAddressFilePath);

    // register a node with Noia network
    const registeredNode = await this.client.registerNode(noiaNodeAddress);
    console.log(`Node registered! Node address: ${registeredNode.address}`);

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
    console.log(`Job post found! @address: ${jobPost.address}, info: ${JSON.stringify(jobPost.info)}`);

    // connect to master and start listening events
    const {host, port} = jobPost.info;
    const masterWsAddress = `ws://${host}:${port}`;
    this.master.connect(masterWsAddress, jobPost.employerAddress);

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
