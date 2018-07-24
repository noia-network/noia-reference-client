const EventEmitter = require("events");
const logger = require('../common/logger');
const {readFile, writeFile} = require('../common/utils');
const BusinessClient = require('./lib/client');

// Node configuration
const walletMnemonic = 'Heyo sing party done kid carry calm captain state purse weather ozone';
const walletProvider = {
  url: 'http://eth.oja.me:3304/dev',
  apiKey: 'MK3M5ni1gTvArFO6FSJh9IVlb0s5BqN8CAFkGq0d'
}

class Business extends EventEmitter {
  constructor() {
    super();
    this.client = new BusinessClient(walletMnemonic, walletProvider);
  }

  async start() {
    logger.info(`Starting business!`);
    // console.log(`process.argv: ${JSON.stringify(process.argv)}`);

    // read the business aadress in Noia system - if not provided then a new Business is created automatically when first started
    const businessAddressFilePath = './business-address.txt';
    let noiaBusinessAddress = await this.readAddress(businessAddressFilePath);

    // register a business with Noia network
    const registeredBusiness = await this.client.registerBusiness(noiaBusinessAddress);
    console.log(`Business registered! Business address: ${registeredBusiness.address}`);

    // save the business Noia address if different
    if (registeredBusiness.address !== noiaBusinessAddress) {
      await writeFile(businessAddressFilePath, registeredBusiness.address);
    }
    noiaBusinessAddress = registeredBusiness.address;

    // check what to do
    const args = process.argv.slice(2);
    if (!args.length) {
      logger.info(`No action provided! Args: ${JSON.stringify(args)}`);
      return;
    }
    const action = args[0];
    switch (action) {
      case 'jobpost': {
        await this.runJobPost(args.slice(1));
        // exit
        await this.client.dispose();
        break;
      }
      case 'master': {
        await this.runMaster(args.slice(1));
        break;
      }
    }
  }

  async runJobPost(args) {
    console.log(`Job Post args: ${JSON.stringify(args)}`);
    if (!args.length) {
      logger.info(`No job post arguments provided! Args: ${JSON.stringify(args)}`);
      return;
    }

    // check what to do
    const action = args[0];
    switch (action) {
      case 'new': {
        await this.createJobPost(args.slice(1));
        break;
      }
    }
  }

  async createJobPost(args) {
    return await this.client.createJobPost();
  }

  async runMaster() {
    console.log(`Master args: ${JSON.stringify(args)}`);
    this.master = new Master();
    await this.master.start(args.slice(1));
  }

  async readAddress(addressFilePath) {
    let businessAddress;
    try {
      businessAddress = await readFile(addressFilePath);
    } catch (err) {
      console.log(`Cannot find Business aadress from file: ${addressFilePath}`);
    }
    console.log(`Business aadress: ${businessAddress}`);
    return businessAddress;
  }
}

module.exports = Business;
