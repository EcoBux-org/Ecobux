const EcoBux = artifacts.require("EcoBux");
const MarketPlace = artifacts.require("MarketPlace");
const PanamaJungle = artifacts.require("PanamaJungle");
const PanamaFuture = artifacts.require("PanamaFuture");

module.exports = function(deployer, network, accounts) {
    deployer.then(async () => {
      await deployer.deploy(EcoBux);
      await deployer.deploy(MarketPlace, EcoBux.address);
      await deployer.deploy(PanamaFuture, EcoBux.address);
      await deployer.deploy(PanamaJungle, EcoBux.address);
    });
};
