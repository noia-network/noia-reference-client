const Web3 = require('web3');

const walletProvider = new Web3.providers.HttpProvider('http://eth.oja.me:3304/');
const web3 = new Web3(walletProvider);

async function main() {
  const from = web3.eth.accounts[0];
  // const to = '0x8517156cbdf189a1531b808d1069efc46af49e01'; // node wallet address
  const to = '0xd5d21069f55a35c5ff9086babc5e3ee1e5b7aeab'; // business wallet address
  const gas = 21000;
  const value = web3.toWei('1', 'ether');
  console.log(`Transferring ${value}Wei's from: ${from}, to: ${to}, ether: ${web3.fromWei(value, 'ether')}`);

  const transactionHash = await web3.eth.sendTransaction({
    from: from,
    to: to,
    value: value,
    gas: gas
  });
  console.log(`Transferred ${value}Wei's from: ${from}, to: ${to}, transaction hash: ${transactionHash}`);
}

// start it off
main().then(() => {
  console.log(`Finished!`);
}).catch((err) => {
  console.log(`Error: `, err);
});
