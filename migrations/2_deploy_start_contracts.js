const EcoBux = artifacts.require("EcoBux");
const EcoBuxFee = artifacts.require("EcoBuxFee");
const MarketPlace = artifacts.require("MarketPlace");
const Piloto = artifacts.require("Piloto");
const PilotoFuture = artifacts.require("PilotoFuture");

module.exports = function (deployer, network, accounts) {
  deployer.then(async () => {
    await deployer.deploy(EcoBux);
    await deployer.deploy(EcoBuxFee);
    await deployer.deploy(PilotoFuture, EcoBux.address);
    await deployer.deploy(Piloto, EcoBux.address, EcoBuxFee.address);

    // Only deploy MarketPlace on testnets
    if (network != "infuragorli") {
      await deployer.deploy(MarketPlace, EcoBux.address, EcoBuxFee.address);
    }
  });
};
