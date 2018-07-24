const Node = require('./node');

const node = new Node();

async function main() {
  await node.start();
  console.log(`Node main finished!`);
}

// start it off
main().then(() => {
  console.log(`Node client finished!`);
}).catch((err) => {
  console.log(`Node client error: `, err);
});



