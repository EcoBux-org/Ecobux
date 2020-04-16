const EcoBux = artifacts.require('./EcoBux.sol');
const MarketPlace = artifacts.require('./MarketPlace.sol'); 
const PanamaJungle = artifacts.require('./PanamaJungle.sol'); 
const assert = require('assert')
const truffleAssert = require('truffle-assertions');

contract('MarketPlace', (accounts) => {
  const _name = "PanamaFuture";
  const _symbol = "PAF";
  const _decimals = 0;

  beforeEach(async () => {
    EcoBuxInstance = await EcoBux.deployed()
    PanamaJungleInstance = await PanamaJungle.deployed(EcoBuxInstance.address)
    contractInstance = await MarketPlace.deployed(EcoBuxInstance.address)
  })

  it("should create a new sell order", async () => {
      // Mint EcoBux
      const mintEco = 1000
      let ecob = await EcoBuxInstance.createEco(accounts[0],mintEco)
      await EcoBuxInstance.approve(PanamaJungleInstance.address, mintEco, {from: accounts[0]})
      await EcoBuxInstance.approve(contractInstance.address, mintEco, {from: accounts[0]})
  
      // Create Allotments
      var allotments = require("./utils/allotments.json");
      allotments = allotments.slice(0,17);
      const addon = await PanamaJungleInstance.bulkCreateAllotment(allotments, {from: accounts[0]})
      truffleAssert.eventEmitted(addon, 'Transfer', (ev) => {
        return ev.from == 0 && ev.to == PanamaJungleInstance.address;
      }, 'Contract should create the correct allotment');
      // Give accounts[0] an allotment
      const buyAllot = await PanamaJungleInstance.buyAllotments(1, accounts[0]);
      truffleAssert.eventEmitted(buyAllot, 'Transfer', (ev) => {
        ownedAllotment = ev.tokenId;  
        return ev.from == PanamaJungleInstance.address && ev.to == accounts[0];
      }, 'Contract should buy the correct allotment');
      // Approve MarketPlace Contract to manage allotment
      await PanamaJungleInstance.approve(contractInstance.address, ownedAllotment);

      // Create Sell Order
      const ecoPrice = 10

      const receipt = await contractInstance.createOrder(PanamaJungleInstance.address, ownedAllotment, ecoPrice);
      truffleAssert.eventEmitted(receipt, 'OrderCreated', (ev) => {
        return (
          ev.allotmentId.toString(2) == ownedAllotment.toString(2) && 
          ev.allotmentOwner == accounts[0] && 
          ev.subTokenAddress == PanamaJungleInstance.address && 
          ev.ecoPrice == ecoPrice
        );
      }, 'Contract should buy the correct allotment');
  });
  it("should fail to create a new sell order if not owner of allotment", async () => {
      await truffleAssert.reverts( 
          contractInstance.createOrder(PanamaJungleInstance.address, ownedAllotment, 10, {from: accounts[1]}),
          "Only the owner can make orders"
      ) 
  });
  it("should fail to create a new sell order if price is <0", async () => {
      await truffleAssert.reverts( 
          contractInstance.createOrder(PanamaJungleInstance.address, ownedAllotment, 0, {from: accounts[0]}),
          "Price should be greater than 0"
      ) 
  });
  it("should fail to create a new sell order if owner does not have enough EcoBux", async () => {
      await EcoBuxInstance.approve(contractInstance.address, 0, {from: accounts[0]})

      await truffleAssert.reverts( 
          contractInstance.createOrder(PanamaJungleInstance.address, ownedAllotment, 1, {from: accounts[0]}),
          "Owner does not have enough EcoBux to pay publication fee"
      ) 
  });
  it("should fail to create a new sell order if owner does not approve contract", async () => {
      // Re-Approve MarketPlace for ecobux fees
      await EcoBuxInstance.approve(contractInstance.address, 1000, {from: accounts[0]})

      // Give accounts[0] a different allotment
      const buyAllot2 = await PanamaJungleInstance.buyAllotments(1, accounts[0]);
      truffleAssert.eventEmitted(buyAllot2, 'Transfer', (ev) => {
        ownedAllotment2 = ev.tokenId;  
        return ev.from == PanamaJungleInstance.address && ev.to == accounts[0];
      }, 'Contract should buy the correct allotment');

      // Make sure sell order isnt created if allotment isnt approved
      await truffleAssert.reverts( 
          contractInstance.createOrder(PanamaJungleInstance.address, ownedAllotment2, 1, {from: accounts[0]}),
          "The contract is not authorized to manage the asset"
      ) 
  });
})
