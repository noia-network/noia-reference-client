const Business = require('./business');

const business = new Business();

async function main() {
  await business.start();
  console.log(`Business main finished!`);
}

// start it off
main().then(() => {
  console.log(`Business client finished!`);
}).catch((err) => {
  console.log(`Business client error: `, err);
});



