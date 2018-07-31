const util = require('util');
const sdk = require('@noia-network/governance');
const logger = require('../../common/logger');
const { TimeoutError } = require('../../common/utils');
const NoiaClient = require('../../common/noia-client');

class NodeClient extends NoiaClient {
  constructor(mnemonic, providerConfig, nodeConfig) {
    super(mnemonic, providerConfig);
    this.nodeConfig = nodeConfig;
  }

  async dispose() {
    await super.dispose();
    this.registeredNode = null;
    if (this.nextJob) {
      this.nextJob.watcher.stopWatchingJobPostAddedEvents();
      this.nextJob = null;
    }
  }

  // register provided node address in system
  async registerNode(nodeAddress) {
    // wait till governance layer is ready
    await this._ready();

    // check if we have already registered
    if (this.registeredNode) {
      logger.info(`Node already registered! Node address: ${this.registeredNode.address}`);
      return this.registeredNode;
    }

    // check if node is already registered, othewise register a node
    if (nodeAddress) {
      logger.info(`Checking if node is registered in NOIA! address: ${nodeAddress}`);
      const isRegistered = await this.isNodeRegistered(nodeAddress);
      if (isRegistered) {
        logger.info(`Node with address: ${nodeAddress} is registered in NOIA network!`);
        const nodeClient = await sdk.getNodeClient(nodeAddress);
        const nodeOwnerAddress = await nodeClient.getOwnerAddress();

        // verify that the Node contract at provided address was created by the same wallet owner
        if (this.walletAddress !== nodeOwnerAddress) {
          throw new Error(`Node with address: ${nodeAddress} belongs to some other Wallet! this.walletAddress: ${this.walletAddress}, ownerAddress: ${nodeOwnerAddress}`);
        }

        // we are registered
        this.registeredNode = nodeClient;
        return this.registeredNode;
      } else {
        logger.info(`Node with address: ${nodeAddress} is NOT registered in NOIA network!`);
        return null;
      }
    } else {
      logger.info(`Registering a new node in Noia network! Owner: ${this.walletAddress}`);

      // create a new node client in Noia
      this.registeredNode = await this.createNode();

      // we are registered
      return this.registeredNode;
    }
  }

  requireRegisteredNode() {
    if (!this.registeredNode) {
      throw new Error(`Node not registered yet! Call 'registerNode' first.`);
    }
    return this.registeredNode;
  }

  // a new node is created in NOIA system with current Wallet
  async createNode() {
    // wait till governance layer is ready
    await this._ready();

    // get Node IP
    let nodeIP = this.nodeConfig.ip;
    if (!nodeIP) {
      nodeIP = await this.getNodeExternalIP();
    }
    const nodeInfo = {
      "interface": "terminal",
      "node_ip": nodeIP,
      "node_ws_port": this.nodeConfig.wsPort,
      "node_domain": this.nodeConfig.domain
    };

    // and create a new node
    logger.info(`Creating new node client in NOIA!`, nodeInfo);
    const nodeClient = await sdk.createNodeClient(nodeInfo);
    return nodeClient;
  }

  async isNodeRegistered(nodeAddress) {
    // wait till governance layer is ready
    await this._ready();

    // check if provided address is registered in governence layer
    return await sdk.isNodeRegistered(nodeAddress);
  }

  // returns next suitable job post
  async findNextJob() {
    // get a fresh new base client to pull in the next jobs
    if (!this.nextJob) {
      // create a new watcher
      this.nextJob = {
        watcher: await sdk.getBaseClient()
      };
      const watcher = this.nextJob.watcher;

      // calculate the fromBlock based on current block
      const latestBlock = await util.promisify(watcher.web3.eth.getBlockNumber)();
      let fromBlock = latestBlock - 1000;
      if (fromBlock < 0) {
        fromBlock = 0;
      }

      // start polling
      console.log(`findFirstJob! Start searching a job from block: ${fromBlock}`);
      await watcher.startWatchingJobPostAddedEvents({
        pullMode: true,
        pollingInterval: 1000,
        fromBlock: fromBlock,
        // toBlock,
      });
    } else if (this.nextJob.resume) {
      // if polling has been paused then resume it
      this.nextJob.resume();
      this.nextJob.resume = null;
    } else {
      throw new Error(`Next job polling is already active!`);
    }

    // resolve it when we find a suitable job post to work on
    const watcher = this.nextJob.watcher;
    return new Promise((resolve, reject) => {
      // a function to exit and clear up the resources
      let timeoutId;
      let that = this;
      function exit(result, error, complete) {
        // clear the resources
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }

        // stop the logs processing loop
        complete && complete();

        // pause the watcher
        that.nextJob.resume = watcher.stopWatchingJobPostAddedEvents();

        // return result
        if (error) {
          return reject(error);
        }
        resolve(result);
      }

      // start the timer
      const timeout = 5 * 60 * 1000;  // 5 mins
      timeoutId = setTimeout(() => {
        exit(null, new TimeoutError(`Got timeout (${timeout / 1000}s) on finding the next job!`));
      }, timeout);

      // start watching the new job post
      watcher.on('job_post_added', async (jobPostAddress, complete) => {
        console.log(`job_post_added`, jobPostAddress);

        // check if the job possible suits for us
        try {
          const jobPost = await sdk.getJobPost(jobPostAddress);
          return exit(jobPost, null, complete);
        } catch (err) {
          exit(null, err, complete);
        }
      });
    });
  }
}

module.exports = NodeClient;
