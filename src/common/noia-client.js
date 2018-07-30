const EventEmitter = require("events");
const extIP = require("external-ip");
const sdk = require('@noia-network/governance');
const logger = require('./logger');
const randombytes = require("randombytes");

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

  async signMessage(msg) {
    await this._ready();
    const client = await sdk.getBaseClient();
    const signedMsg = await client.rpcSignMessage(msg);
    logger.info(`Signed message! Plain: ${msg}, signed: ${signedMsg}`);
    return signedMsg;
  }

  recoverAddress(msg, msgSigned) {
    const signerAddress = sdk.recoverAddressFromRpcSignedMessage(msg, msgSigned);
    return signerAddress;
  }

  getHandshakeMessage() {
    const msg = randombytes(4).toString("hex");
    return msg;
  }

  async isSignedByAddress(fromMsg, fromMsgSigned, fromAddress) {
    const recoveredAddress = await this.recoverAddress(fromMsg, fromMsgSigned);
    return fromAddress === recoveredAddress;
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

  async getNodeClient(address) {
    await this._ready();
    return await sdk.getNodeClient(address);
  }

  async getBusinessClient(address) {
    await this._ready();
    return await sdk.getBusinessClient(address);
  }
}

const getIP = extIP({
  replace: true,
  services: ["http://icanhazip.com/", "http://ident.me/", "http://ifconfig.co/x-real-ip", "http://ifconfig.io/ip"],
  timeout: 600,
  getIP: "parallel"
});

module.exports = NoiaClient;
