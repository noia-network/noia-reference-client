const Handshake = {
  REFUSED: 'REFUSED'
}

class HandshakeError extends Error {
  constructor(msg) {
    super(msg);
  }
}

module.exports = {
  Handshake,
  HandshakeError
}
