const sdk = require('@noia-network/governance');
const logger = require('../../common/logger');
const NoiaClient = require('../../common/noia-client');

class BusinessClient extends NoiaClient {
  constructor(mnemonic, providerConfig, nodeConfig) {
    super(mnemonic, providerConfig);
    this.nodeConfig = nodeConfig;
  }

  async dispose() {
    await super.dispose();
    this.registeredBusiness = null;
  }

  // register provided business address in system
  async registerBusiness(businessAddress) {
    // wait till governance layer is ready
    await this._ready();

    // check if we have already registered
    if (this.registeredBusiness) {
      logger.info(`Business already registered! Business address: ${this.registeredBusiness.address}`);
      return this.registeredBusiness;
    }

    // check if business is already registered, othewise register a node
    if (businessAddress) {
      logger.info(`Checking if business is registered in NOIA! address: ${businessAddress}`);
      const isRegistered = await this.isBusinessRegistered(businessAddress);
      if (isRegistered) {
        logger.info(`Business with address: ${businessAddress} is registered in NOIA network!`);
        const businessClient = await sdk.getBusinessClient(businessAddress);
        const businessOwnerAddress = await businessClient.getOwnerAddress();

        // verify that the Business contract at provided address was created by the same wallet owner
        if (this.walletAddress !== businessOwnerAddress) {
          throw new Error(`Business with address: ${businessAddress} belongs to some other Wallet! this.walletAddress: ${this.walletAddress}, ownerAddress: ${businessOwnerAddress}`);
        }

        // we are registered
        this.registeredBusiness = businessClient;
        return this.registeredBusiness;
      } else {
        logger.info(`Business with address: ${businessAddress} is NOT registered in NOIA network!`);
        return null;
      }
    } else {
      logger.info(`Registering a new business in Noia network! Owner: ${this.walletAddress}`);

      // create a new business client in Noia
      this.registeredBusiness = await this.createBusiness();

      // we are registered
      return this.registeredBusiness;
    }
  }

  requireRegisteredBusiness() {
    if (!this.registeredBusiness) {
      throw new Error(`Business not registered yet! Call 'registerNode' first.`);
    }
    return this.registeredBusiness;
  }

  // a new business is created in NOIA system with current Wallet
  async createBusiness() {
    // wait till governance layer is ready
    await this._ready();

    // and create a new business
    let nodeIP = this.nodeConfig.ip;
    if (!nodeIP) {
      nodeIP = await this.getNodeExternalIP();
    }
    const businessInfo = {
      "node_ip": nodeIP,
      "node_ws_port": this.nodeConfig.wsPort,
      "node_domain": this.nodeConfig.domain
    };
    logger.info(`Creating new business client in NOIA!`, businessInfo);
    const businessClient = await sdk.createBusinessClient(businessInfo);
    return businessClient;
  }

  async isBusinessRegistered(nodeAddress) {
    // wait till governance layer is ready
    await this._ready();

    // check if provided business address is registered in governence layer
    return await sdk.isBusinessRegistered(nodeAddress);
  }

  async createJobPost() {
    // wait till governance layer is ready
    await this._ready();

    // check first if we are registered in Noia network
    if (!this.registeredBusiness) {
      throw new Error(`Business is not registered! Please call 'registerBusiness' first.`);
    }

    // create a new job post
    // const businessClient = await sdk.getBusinessClient(this.registeredBusiness.address);
    const jobPostInfo = {}; // employer_address : this.registeredBusiness.address
    logger.info(`Creating a new job post in Noia network! Job post info: ${JSON.stringify(jobPostInfo)}`);
    const jobPost = await this.registeredBusiness.createJobPost(jobPostInfo);
    logger.info(`Create a new job post in Noia network! Job post address: ${jobPost.address}, info: ${JSON.stringify(jobPost.info)}`);
    return jobPost;
  }

}

module.exports = BusinessClient;
