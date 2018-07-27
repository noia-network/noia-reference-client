const EventEmitter = require("events");
const extIP = require("external-ip");
const sdk = require('@noia-network/governance');
const logger = require('./logger');

class NoiaClient extends EventEmitter {
  constructor(mnemonic, providerConfig) {
    super();

    // initialize the noia governance layer
    const {url, apiKey} = providerConfig;
    sdk.init({
      account: {
        mnemonic: mnemonic
      },
      web3: {
        provider_url: url,
        provider_options: {
          headers: {
            name: 'x-api-key',
            value: apiKey
          }
        }
      }
    }).then((() => {
      this.walletAddress = sdk.getOwnerAddress(); // get the wallet address
      logger.info(`Wallet address: ${this.walletAddress}`);
      this.ready = true;
      this.emit('ready');
    })).catch((err) => {
      this.emit('ready', err);
    });
  }

  async dispose() {
    sdk.uninit();
  }

  _ready() {
    return new Promise((resolve, reject) => {
      if (this.ready) {
        resolve();
      } else {
        this.once('ready', (err) => {
          if (err) {
            return reject(err);
          }
          resolve();
        });
      }
    });
  }

  async getNetworkId() {
    // wait till governance layer is ready
    await this._ready();

    // return the network id
    return await sdk.getNetworkId();
  }

  async getNodeExternalIP() {
    return new Promise((resolve, reject) => {
      getIP((err, nodeExternalIP) => {
        if (err) {
          logger.error(err);
          return reject(err);
        }
        resolve(nodeExternalIP);
      });
    });
  }
}

const getIP = extIP({
  replace: true,
  services: ["http://icanhazip.com/", "http://ident.me/", "http://ifconfig.co/x-real-ip", "http://ifconfig.io/ip"],
  timeout: 600,
  getIP: "parallel"
});

module.exports = NoiaClient;
