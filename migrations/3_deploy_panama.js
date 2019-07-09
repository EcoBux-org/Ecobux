const EcoBucks = artifacts.require("EcoBucks");
const PanamaJungle = artifacts.require("PanamaJungle");
const PanamaFuture = artifacts.require("PanamaFuture");

module.exports = function(deployer, network, accounts) {
    console.log(EcoBucks.address)
    deployer.deploy(PanamaJungle, EcoBucks.address);
    deployer.deploy(PanamaFuture, EcoBucks.address);
};
