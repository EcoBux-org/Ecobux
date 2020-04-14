const EcoBux = artifacts.require("EcoBux");
const MarketPlace = artifacts.require("MarketPlace");

module.exports = function(deployer, network, accounts) {
    deployer.deploy(EcoBux).then(function() {
        console.log(EcoBux.address)
        return deployer.deploy(MarketPlace, EcoBux.address);
    });
};
