const EcoBux = artifacts.require('./EcoBux.sol');
const EcoBuxFee = artifacts.require('./EcoBuxFee.sol');
const MarketPlace = artifacts.require('./MarketPlace.sol'); 
const PanamaJungle = artifacts.require('./PanamaJungle.sol'); 
const assert = require('assert')
const truffleAssert = require('truffle-assertions');

contract('MarketPlace', (accounts) => {
    const ecoPrice = 30

    beforeEach(async () => {
        EcoBuxInstance = await EcoBux.deployed()
        EcoBuxFeeInstance = await EcoBuxFee.deployed()
        PanamaJungleInstance = await PanamaJungle.deployed(EcoBuxInstance.address)
        contractInstance = await MarketPlace.deployed(EcoBuxInstance.address, EcoBuxFeeInstance.address)
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
        // Approve MarketPlace Contract to manage asset
        await PanamaJungleInstance.approve(contractInstance.address, ownedAllotment);

        // Create Sell Order

        const receipt = await contractInstance.createOrder(PanamaJungleInstance.address, ownedAllotment, ecoPrice);
        truffleAssert.eventEmitted(receipt, 'OrderCreated', (ev) => {
            orderId = ev.orderId
            return (
                ev.assetId.toString(2) == ownedAllotment.toString(2) && 
                ev.assetOwner == accounts[0] && 
                ev.subTokenAddress == PanamaJungleInstance.address && 
                ev.ecoPrice == ecoPrice
            );
        }, 'Contract should create the correct order');
    });
    it("should fail to create a new sell order if not owner of asset", async () => {
        await truffleAssert.reverts( 
            contractInstance.createOrder(PanamaJungleInstance.address, ownedAllotment, ecoPrice, {from: accounts[1]}),
            "Only the owner can make orders"
        ) 
    });
    it("should fail to create a new sell order if price does not cover fees", async () => {
        await truffleAssert.reverts( 
            contractInstance.createOrder(PanamaJungleInstance.address, ownedAllotment, 20, {from: accounts[0]}),
            "Asset price does not cover fees"
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
        }, 'Contract should buy the correct asset');

        // Make sure sell order isnt created if asset isnt approved
        await truffleAssert.reverts( 
            contractInstance.createOrder(PanamaJungleInstance.address, ownedAllotment2, ecoPrice, {from: accounts[0]}),
            "The contract is not authorized to manage the asset"
        ) 
    });
    
    it("should fail to cancel a sell order if not owner of order", async () => {
        await truffleAssert.reverts( 
            contractInstance.cancelOrder(PanamaJungleInstance.address, ownedAllotment, {from: accounts[1]}),
            "Unauthorized user"
        ) 
    });

    it("should fail to cancel a sell order if asset not published", async () => {
        await truffleAssert.reverts( 
            contractInstance.cancelOrder(PanamaJungleInstance.address, 5318008, {from: accounts[1]}),
            "Asset not published"
        ) 
    });

    it("should cancel a sell order", async () => {
       const receipt = await contractInstance.cancelOrder(PanamaJungleInstance.address, ownedAllotment) 
       truffleAssert.eventEmitted(receipt, 'OrderCancelled', (ev) => {
           return (
               ev.orderId == orderId &&
               ev.assetId.toString(2) == ownedAllotment.toString(2) && 
               ev.seller == accounts[0] && 
               ev.subTokenAddress == PanamaJungleInstance.address
           );
       }, 'Contract should cancel the correct order');
    });

    it("should fail to execute order if asset not published", async () => { 
        await truffleAssert.reverts( 
            contractInstance.executeOrder(PanamaJungleInstance.address, 5318008, 1, {from: accounts[1]}),
            "Asset not published"
        ) 
    });
    it("should fail to execute order if seller tries to buy asset", async () => { 
        // Mint EcoBux
        const mintEco = 1000
        let ecob = await EcoBuxInstance.createEco(accounts[0],mintEco)
        await EcoBuxInstance.approve(PanamaJungleInstance.address, mintEco, {from: accounts[0]})
        await EcoBuxInstance.approve(contractInstance.address, mintEco, {from: accounts[0]})

        // Approve MarketPlace Contract to manage asset
        await PanamaJungleInstance.approve(contractInstance.address, ownedAllotment2);

        // Create new Sell Order
        const receipt = await contractInstance.createOrder(PanamaJungleInstance.address, ownedAllotment2, ecoPrice);
        truffleAssert.eventEmitted(receipt, 'OrderCreated', (ev) => {
            orderId = ev.orderId
            return (
                ev.assetId.toString(2) == ownedAllotment2.toString(2) && 
                ev.assetOwner == accounts[0] && 
                ev.subTokenAddress == PanamaJungleInstance.address && 
                ev.ecoPrice == ecoPrice
            );
        }, 'Contract should create the correct order');

        await truffleAssert.reverts( 
            contractInstance.executeOrder(PanamaJungleInstance.address, ownedAllotment2, ecoPrice, {from: accounts[0]}),
            "Seller cannot buy asset"
        ) 
    });
    it("should fail to execute order if incorrect price", async () => { 
        await truffleAssert.reverts( 
            contractInstance.executeOrder(PanamaJungleInstance.address, ownedAllotment2, 0, {from: accounts[1]}),
            "The price is not correct"
        ) 
    });
    it("should fail to execute order if buyer does not have enough EcoBux", async () => { 
        // De-approve contract for all EcoBux
        await EcoBuxInstance.approve(contractInstance.address, 0, {from: accounts[1]})
        await truffleAssert.reverts( 
            contractInstance.executeOrder(PanamaJungleInstance.address, ownedAllotment2, ecoPrice, {from: accounts[1]}),
            "Not Enough EcoBux"
        ) 
    });
    it("should fail to execute order if seller is no longer the owner of the asset", async () => { 
        // In this test, accounts[0] and accounts[1] are corroborating
        // Approve accounts[1] to take asset
        await PanamaJungleInstance.approve(accounts[1], ownedAllotment2);
        // accounts[1] takes asset
        await PanamaJungleInstance.safeTransferFrom(accounts[0], accounts[1], ownedAllotment2, {from: accounts[1]});
        // buyer (accounts[2]) attempts to purchase asset no longer owned by accounts[0]
        await truffleAssert.reverts( 
            contractInstance.executeOrder(PanamaJungleInstance.address, ownedAllotment2, ecoPrice, {from: accounts[2]}),
            "The seller not the owner"
        ) 
    });
    it("should execute order", async () => { 
        // Create new Sell Order
        // Due to previous test accounts[1] now owns ownedAllotment2
        
        // Approve MarketPlace Contract to manage asset
        await PanamaJungleInstance.approve(contractInstance.address, ownedAllotment2, {from: accounts[1]});

        // Create order
        const newOrder = await contractInstance.createOrder(PanamaJungleInstance.address, ownedAllotment2, ecoPrice, {from: accounts[1]});
        truffleAssert.eventEmitted(newOrder, 'OrderCreated', (ev) => {
            orderId = ev.orderId
            return (
                ev.assetId.toString(2) == ownedAllotment2.toString(2) && 
                ev.assetOwner == accounts[1] && 
                ev.subTokenAddress == PanamaJungleInstance.address && 
                ev.ecoPrice == ecoPrice
            );
        }, 'Contract should create the correct order');


        // Mint Ecobucks for buying order
        mintEco = 30
        ecob = await EcoBuxInstance.createEco(accounts[0],mintEco)
        await EcoBuxInstance.approve(contractInstance.address, mintEco, {from: accounts[0]})

        // Execute order
        const receipt = await contractInstance.executeOrder(PanamaJungleInstance.address, ownedAllotment2, ecoPrice, {from: accounts[0]});
        truffleAssert.eventEmitted(receipt, 'OrderSuccessful', (ev) => {
            return (
                ev.assetId.toString(2) == ownedAllotment2.toString(2) && 
                ev.seller == accounts[1] && 
                ev.subTokenAddress == PanamaJungleInstance.address && 
                ev.totalPrice == ecoPrice &&
                ev.buyer == accounts[0]
            );
        }, 'Contract should buy the correct allotment');
        // Make sure fees are being given to correct addresses
        const PanamaFee = await EcoBuxInstance.balanceOf(PanamaJungleInstance.address);
        const EcoBuxFee = await EcoBuxInstance.balanceOf(EcoBuxFeeInstance.address);
        // PanamaFee = 60 because we are buying 2 allotments @ 25 each + 10 as a executeOrder fee
        // EcoBuxFee = 10 because the executeOrder fee
        assert.equal(PanamaFee.toString(10), 60, "Panama Fee is incorrect")
        assert.equal(EcoBuxFee.toString(10), 10, "EcoBux Fee is incorrect")
    });
})
