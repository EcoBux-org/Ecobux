const PanamaJungle = artifacts.require('./PanamaJungle.sol')
const EcoBux = artifacts.require('./EcoBux.sol')

//const numberToBN = require('number-to-bn');
const assert = require('assert')
const assertRevert = require('./utils/assertRevert').assertRevert;
const truffleAssert = require('truffle-assertions');
let contractInstance
let ecoBuxInstance

contract('PanamaJungle', (accounts) => {
    beforeEach(async () => {
        ecoBuxInstance = await EcoBux.deployed()
        contractInstance = await PanamaJungle.deployed(ecoBuxInstance.address)
    })
    const _name = "PanamaJungle";
    const _symbol = "PAJ";

    it("should have a name", async () => {
        assert.equal(await contractInstance.name(), _name, "Name is incorrect!");
    });

    it("should have a symbol", async () => {
        assert.equal(await contractInstance.symbol(), _symbol, "Symbol is incorrect!");
    });

    it("should create all allotments", async () => {
        var allotments = require("./utils/allotments.json");
        allotments = allotments.slice(0,17);
        const addon = await contractInstance.bulkCreateAllotment(allotments, {from: accounts[0]})

        //console.log(addon.receipt.gasUsed)
        truffleAssert.eventEmitted(addon, 'Transfer', (ev) => {
          return ev.from == 0 && ev.to == contractInstance.address;
        }, 'Contract should create the correct allotment');

        // Verify generated allotment is the same
        const allot0 = await contractInstance.allotmentDetails(0);
        assert.equal(allot0[1][0][0].toString(10), allotments[0][0][0], "Generated allotment is not the same")
    })

    it("should fail to create allotments if not owner", async () => {
        var allotments = require("./utils/allotments.json");
        allotments = allotments.slice(0,17);
        await truffleAssert.reverts(
            contractInstance.bulkCreateAllotment(allotments, {from: accounts[1]}),
            "Only the owner can run this function"
        )
    })

    it("should buy multiple unique allotments", async () => {
        const ecoMint = 175
        let ecob = await EcoBuxInstance.createEco(accounts[0],ecoMint)
        await EcoBuxInstance.approve(contractInstance.address, ecoMint)

        list = [];
        const receipt = await contractInstance.buyAllotments(7, accounts[0], {from: accounts[0]});
        truffleAssert.eventEmitted(receipt, 'Transfer', (ev) => {
          list.push(ev.tokenId);
          return ev.from == contractInstance.address && ev.to == accounts[0];
        }, 'Contract should create the correct allotments');
        assert.equal(list[0] != list[1] || list[1] != list[2], true, "The allotments were not unique")
    })

    it("should buy a random allotment", async () => {
        const ecoMint = 25
        let ecob = await EcoBuxInstance.createEco(accounts[0],ecoMint)
        await EcoBuxInstance.approve(contractInstance.address, ecoMint)

        const receipt = await contractInstance.buyAllotments(1, accounts[0]);
        truffleAssert.eventEmitted(receipt, 'Transfer', (ev) => {
          list.push(ev.tokenId);
          return ev.from == contractInstance.address && ev.to == accounts[0];
        }, 'Contract should buy the correct allotment');
    })

    it("should fail to buy an allotment if not enough ecobux", async () => {
        await truffleAssert.reverts(
            contractInstance.buyAllotments(1, accounts[0], {from: accounts[1]}),
            "Not enough available Ecobux!"
        )
    })

    it("should fail to buy an allotment if not enough available allotments", async () => {
        const ecoMint = 500
        let ecob = await EcoBuxInstance.createEco(accounts[0],ecoMint)
        await EcoBuxInstance.approve(contractInstance.address, ecoMint)

        await truffleAssert.reverts(
            contractInstance.buyAllotments(20, accounts[0], {from: accounts[0]}),
            "Not enough available tokens!"
        )
    })

    it("should return info about all owned allotments", async () => {
        const owned = await contractInstance.ownedAllotments(accounts[0]);
        assert.notEqual(owned.sort(), list.sort(), "The function returned an empty result")
    })

    it("should return no info about allotments if none are owned", async () => {
        const owned = await contractInstance.ownedAllotments(accounts[4]);

        // Owned array should be empty
        assert.equal(!owned.length, true, "The function did not return empty")
    })
    // TODO: GSN
    //

    it('should create a microaddon and get info', async () => {
        const price = 10
        const buyable = 1

        const addon = await contractInstance.createMicro(price, buyable, {from: accounts[0]})

        truffleAssert.eventEmitted(addon, 'NewAddon', (ev) => {
          return ev.addonId == 0 && ev.price == price && ev.buyable == true;
        }, 'Contract should create the correct microAddon');

        var details = await contractInstance.microDetails(0);
        assert.equal(0 == details[0] && details[1] == price && details[2], true, 'The microaddon was not added correctly')
    })

    it('should fail to create a microaddon if not owner', async () => {
        const price = 10
        const buyable = 1

        await truffleAssert.reverts(
            contractInstance.createMicro(price, buyable, {from: accounts[1]}),
            "Only the owner can run this function"
        )
    })

    it('should buy a buyable microaddon', async () => {
        const price = 10
        const buyable = 1
        const mintEco = 35
        const addonId = 0

        // Mint EcoBux
        let ecob = await ecoBuxInstance.createEco(accounts[0],mintEco)
        await ecoBuxInstance.approve(contractInstance.address, mintEco)

        // Buy an allotment
        const receipt = await contractInstance.buyAllotments(1, accounts[0]);
        truffleAssert.eventEmitted(receipt, 'Transfer', (ev) => {
          ownedAllotment = ev.tokenId;
          return ev.from == contractInstance.address && ev.to == accounts[0];
        }, 'Contract should buy the correct allotment');

        // Add addon to allotment
        let reciept = await contractInstance.buyMicro(ownedAllotment, addonId, {from: accounts[0]})

        truffleAssert.eventEmitted(reciept, 'AddedAddon');

    })

    it('should fail to buy a microaddon if not buyable', async () => {
        const price = 10
        const buyable = 0

        const receipt = await contractInstance.createMicro(price, buyable, {from: accounts[0]})
        truffleAssert.eventEmitted(receipt, 'NewAddon', (ev) => {
          addonId = ev.addonId;
          return ev.addonId == 1 && ev.price == price && ev.buyable == false;
        }, 'Contract should buy the correct allotment');

        await truffleAssert.reverts(
            contractInstance.buyMicro(0, addonId, {from: accounts[1]}),
            "Selected microaddon does not exist or is not buyable"
        )
    })

    it("should fail to buy microaddon if not enough ecobux", async () => {
        await truffleAssert.reverts(
            contractInstance.buyMicro(1, 0, {from: accounts[1]}),
            "Not enough available EcoBux!"
        )
    })

    it("should fail to buy a microaddon if selected token does not exist", async () => {
        const mintEco = 10000

        // Mint EcoBux
        let ecob = await ecoBuxInstance.createEco(accounts[1],mintEco)
        await ecoBuxInstance.approve(contractInstance.address, mintEco, {from: accounts[1]})

        await truffleAssert.reverts(
            contractInstance.buyMicro(5318008, 0, {from: accounts[1]}),
            "Selected Token does not exist"
        )
    })

    it("should set a new allotment price", async () => {
        // Set new price
        const newPrice = 1000;
        const price = await contractInstance.setCurrentPrice(newPrice);
        // Check if price was actually changed
        assert.equal(await contractInstance.currentPrice.call(), newPrice, "Price was not successfully updated");
    })

    it("should fail to set a new price if not owner", async () => {
        // Set new price
        const newPrice = 1000;
        // Check if price was not actually changed
        await truffleAssert.reverts(
            contractInstance.setCurrentPrice(newPrice, {from: accounts[1]}),
            "Only the owner can run this function"
        )
    })

    it("should update EcoBux address", async () => {
        const addr = await contractInstance.setEcoBuxAddress(accounts[3])
        assert.equal(await contractInstance.ecoBuxAddress.call(), accounts[3], "EcoBux address was not updated")
    })

    it("should fail to update EcoBux address if not owner", async () => {
        await truffleAssert.reverts(
            contractInstance.setEcoBuxAddress(accounts[3], {from: accounts[2]}),
            "Only the owner can run this function"
        )
    })

    it("should transfer owership of contract", async () => {
        const owner = await contractInstance.transferOwnership(accounts[1], {from: accounts[0]})
        truffleAssert.eventEmitted(owner, 'OwnershipTransferred', (ev) => {
          return true
        })
        await truffleAssert.reverts(
            contractInstance.transferOwnership(accounts[2], {from: accounts[2]}),
            "Only the owner can run this function"
        )
    })

    it("should fail to transfer ownership if to 0 address", async () => {
        await truffleAssert.reverts(
            contractInstance.transferOwnership('0x0000000000000000000000000000000000000000', {from: accounts[1]}),
            "Ownership cannot be transferred to zero address"
        )
    })

    it("should fail to transfer ownership if not owner", async () => {
        await truffleAssert.reverts(
            contractInstance.transferOwnership(accounts[2], {from: accounts[2]}),
            "Only the owner can run this function"
        )
    })

    it("should fail to relinquish ownership if not owner", async () => {
        await truffleAssert.reverts(
            contractInstance.renounceOwnership({from: accounts[2]}),
            "Only the owner can run this function"
        )
    })

    it("should not allow contract functions if paused", async () => {
        await contractInstance.pause({from: accounts[1]})

        await truffleAssert.reverts(
            contractInstance.buyAllotments(0, accounts[0], {from: accounts[0]}),
            "Function cannot be used while contract is paused"
        )

    })
    it("should only allow contract functions if not paused", async () => {
        // BUG: Contract should already be unpaused but it isnt due to prev test
        // Fix: manually unpause at start of this test
        await contractInstance.unpause({from: accounts[1]}),
        await truffleAssert.reverts(
            contractInstance.unpause({from: accounts[1]}),
            "Function cannot be used while contract is not paused"
        )
    })
    // Keep this at the end; After this test there is no owner
    it("should relinquish owership of contract", async () => {
        // BUG: This should be from accounts[0] but it has to be from acconts[1] because of transfer owner test
        const owner = await contractInstance.renounceOwnership({from: accounts[1]})
        truffleAssert.eventEmitted(owner, 'OwnershipRenounced', (ev) => {
          return true
        })

        await truffleAssert.reverts(
            contractInstance.transferOwnership(accounts[1], {from: accounts[0]}),
            "Only the owner can run this function"
        )
    })
})
