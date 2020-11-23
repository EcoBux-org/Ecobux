const HDWalletProvider = require("@truffle/hdwallet-provider");
require('dotenv').config();

secretKey = process.env.ETHSECRET;

module.exports = {
  // plugins: ["solidity-coverage"],
  networks: {
    // Dev env
    development: {
      host: "127.0.0.1",
      port: 8546,
      network_id: "*", // matching any id
      gas: 8000000 // Gas limit 
    },

    gorli: {
        host: "127.0.0.1",
        port: 8546, // Use different port than dev to ensure no collisions
        network_id: 5, // Ropsten id
        gas: 8000000 // Gas limit
    },

    infuragorli: {
      provider: function() {
        return new HDWalletProvider(secretKey, "https://goerli.infura.io/v3/be1164b674ef4e05bc0f9c998e8add9d")
      },
      network_id: 5,
      gas: 8000000 // Gas limit
    },

    infuramain: {
      provider: function() {
        return new HDWalletProvider(secretKey, "https://mainnet.goerli.infura.io/v3/be1164b674ef4e05bc0f9c998e8add9d")
      },
      network_id: 1,
      gas: 8000000 // Gas limit
    }
  },

  // Set default mocha options here, use special reporters etc.
  mocha: {
    // timeout: 100000
  },

  // Configure your compilers
  compilers: {
    solc: {
      version: "0.6.8",    
      settings: {
        optimizer: {
            enabled: true,
            runs: 1500
          }
      }
    }
  }
}
