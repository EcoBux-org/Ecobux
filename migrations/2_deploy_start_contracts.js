const EcoBux = artifacts.require("EcoBux");
const EcoBuxFee = artifacts.require("EcoBuxFee");
const MarketPlace = artifacts.require("MarketPlace");
const PanamaJungle = artifacts.require("PanamaJungle");
const PanamaFuture = artifacts.require("PanamaFuture");

module.exports = function(deployer, network, accounts) {
    deployer.then(async () => {
      await deployer.deploy(EcoBux);
      await deployer.deploy(EcoBuxFee);
      await deployer.deploy(MarketPlace, EcoBux.address, EcoBuxFee.address);
      await deployer.deploy(PanamaFuture, EcoBux.address);
      await deployer.deploy(PanamaJungle, EcoBux.address);
    });
};
