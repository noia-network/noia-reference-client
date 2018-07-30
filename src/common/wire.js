const Handshake = {
  REFUSED: 'REFUSED',
  DONE: 'DONE'
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
