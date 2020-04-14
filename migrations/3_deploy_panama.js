const EcoBux = artifacts.require("EcoBux");
const PanamaJungle = artifacts.require("PanamaJungle");
const PanamaFuture = artifacts.require("PanamaFuture");

module.exports = async (deployer, network, accounts) => {
    deployer.deploy(PanamaFuture, EcoBux.address);

    await deployer.deploy(PanamaJungle, EcoBux.address)
    let paj = await PanamaJungle.deployed();

};
