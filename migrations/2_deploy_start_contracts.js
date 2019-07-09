const EcoBucks = artifacts.require("EcoBucks");
const MarketPlace = artifacts.require("MarketPlace");

module.exports = function(deployer, network, accounts) {
    deployer.deploy(EcoBucks).then(function() {
        console.log(EcoBucks.address)
        return deployer.deploy(MarketPlace, EcoBucks.address);
    });
};
