const EventEmitter = require("events");
const logger = require('../common/logger');
const {readFile, writeFile, TimeoutError} = require('../common/utils');
const NodeClient = require('./lib/client');
const Wire = require('./lib/wire');

// Node configuration
const walletMnemonic = 'ill song party come kid carry calm captain state purse weather ozone';
const walletProvider = {
  // url: 'http://localhost:7545/',
  // url: 'http://eth.oja.me:3304/dev',
  url: 'http://eth.oja.me:3304/',
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
    this.client = new NodeClient(walletMnemonic, walletProvider, nodeConfig);
    this.wire = new Wire(this.client);
  }

  async start() {
    logger.info(`Starting node client!`);

    // read the network id
    const networkId = await this.client.getNetworkId();

    // read the node aadress in Noia system - if not provided then a new Node is created automatically when first started
    const nodeAddressFilePath = `./${networkId}-node-address.txt`;
    let nodeAddress = await this.readAddress(nodeAddressFilePath);

    // register a node with Noia network
    const registeredNode = await this.client.registerNode(nodeAddress);
    if (!registeredNode) {
      console.log(`Node not Registered in NOIA network`);
      return;
    }
    console.log(`Registered Node address: ${registeredNode.address}`);

    // save the node Noia address if different
    if (registeredNode.address !== nodeAddress) {
      await writeFile(nodeAddressFilePath, registeredNode.address);
    }
    nodeAddress = registeredNode.address;

    // TODO! how to stop here finding next job posts?
    // TODO! how to check if we have already processed a job post
    let jobPost;
    while (true) {
      try {
        console.log(`Waiting for next job!`);
        jobPost = await this.client.findNextJob();

        console.log(`Job post found! Job @address: ${jobPost.address}, job post info: ${JSON.stringify(jobPost.info)}`);

        // get employer
        const employerAddress = await jobPost.getEmployerAddress();
        const employer = await this.client.getBusinessClient(employerAddress);
        console.log(`Employer! @address: ${employer.address}, employer info: ${JSON.stringify(employer.info)}`);

        // connect to master
        const {node_ip, node_ws_port} = employer.info;
        const masterWsAddress = `ws://${node_ip}:${node_ws_port}`;
        await this.wire.connect(masterWsAddress);

        // validate the peers - master validates node and vice versa
        const allValid = await this.wire.validatePeers(nodeAddress, employer.address);

        // TODO! Start a work order process with Master
        if (allValid) {
          logger.info(`Start Work order process with Master!`);
          // Question: do business need to call fund() after both are accepted the work contract or before that?
          // Question: when can business cancel worker withdraw()

          // get funded work order
          const workOrder = await this.wire.getWorkOrder(jobPost.address);

          // check if it is ok to accept this work order
          // check that it is funded and for how long should I work for it?
          const totalFunded = await workOrder.contract.totalFunds().call();
          const totalVested = await workOrder.contract.totalVested().call();
          const ok = totalFunded > 0 && totalVested > 0;
          if (ok) {
            await this.wire.acceptWorkOrder(workOrder.address);

            // check or wait when business has accepted also the work order

            // do the work for the period until.
            // then ask to release the tokens for us

            //  check if there are more vested work for us, if yes then do the work, otherwise stop working

          }
        }
      } catch (err) {
        if (!(err instanceof TimeoutError)) {
          // if not timeout then rethrow
          logger.error(`Error!`, err);
          console.log(err);
          // throw err;
        } else {
          logger.info(`Timeout waiting for the next job! Retrying ...`);
        }
      }
    }
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
