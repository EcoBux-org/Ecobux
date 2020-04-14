const EcoBux = artifacts.require("EcoBux");
const RelayHub = artifacts.require( "RelayHub");
const PanamaJungle = artifacts.require("PanamaJungle");
const PanamaFuture = artifacts.require("PanamaFuture");


let networks = {
  "ropsten-fork": {
    relayHubAddr: "0x1349584869A1C7b8dc8AE0e93D8c15F5BB3B4B87"
  },
  "ropsten": {
    relayHubAddr: "0x1349584869A1C7b8dc8AE0e93D8c15F5BB3B4B87"
  },
  "development": {
    relayHubAddr: "0x9C57C0F1965D225951FE1B2618C92Eefd687654F"
  }
}

module.exports = async (deployer, network, accounts) => {
    deployer.deploy(PanamaFuture, EcoBux.address);

    console.log(network);
    let hubAddr = networks[network].relayHubAddr
    await deployer.deploy(PanamaJungle, EcoBux.address)
    let paj = await PanamaJungle.deployed();

    let hub = await RelayHub.at(hubAddr).catch(e => {
        console.log("error: ", e)
    })
    await hub.depositFor(PanamaJungle.address, { value:1e18 })
    await paj.init_hub(hubAddr);
};
