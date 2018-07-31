const Handshake = {
  DONE: 'DONE',
  REFUSED: 'REFUSED',
  ERROR: 'ERROR'
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
