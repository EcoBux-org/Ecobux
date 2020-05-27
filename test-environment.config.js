module.exports = {
  accounts: {
    amount: 10, // Number of unlocked accounts
    ether: 100, // Initial balance of unlocked accounts (in ether)
  },
  setupProvider: (baseProvider) => {
    const {GSNDevProvider} = require('@openzeppelin/gsn-provider');
    const {accounts} = require('@openzeppelin/test-environment');
    return new GSNDevProvider(baseProvider, {
      txfee: 70,
      useGSN: false,
      ownerAddress: accounts[8],
      relayerAddress: accounts[9],
    });
  },
};
