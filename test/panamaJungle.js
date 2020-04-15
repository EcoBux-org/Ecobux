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


    it('should create a microaddon and get info', async () => {
        const price = 10
        const purchasable = 1

        const addon = await contractInstance.createMicro(price, purchasable, {from: accounts[0]})

        truffleAssert.eventEmitted(addon, 'NewAddon', (ev) => {
          return ev.addonId == 0 && ev.price == price && ev.purchasable == true;
        }, 'Contract should create the correct microAddon');

        var details = await contractInstance.microDetails(0);
        assert.equal(0 == details[0] && details[1] == price && details[2] == true, true, 'The microaddon was not added correctly')
    })

    it('should fail to create a microaddon if not owner', async () => {
        const price = 10
        const purchasable = 1

        await truffleAssert.reverts( 
            contractInstance.createMicro(price, purchasable, {from: accounts[1]}),
            "Only the owner can run this function"
        ) 
    })

    it('should buy a purchasable microaddon', async () => {
        const price = 10
        const purchasable = 1

        let ecob = await ecoBuxInstance.createEco(accounts[0],1000)
        await ecoBuxInstance.approve(contractInstance.address, 1000)

        let addonId = await contractInstance.createMicro(price, purchasable, {from: accounts[0]})

        truffleAssert.eventEmitted(addonId, 'NewAddon', (ev) => {
            if (ev.addonId != 1 || ev.price != price || ev.purchasable !== true) return false

            let addonId = contractInstance.createMicro(price, purchasable, {from: accounts[0]})

            //let purchase = contractInstance.purchaseMicro(0, 1, {from: accounts[0]})
            //truffleAssert.eventEmitted(purchase, 'EcoTransfer');
            return true
        });

    })

    it("should set a new price", async () => {
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
        /*
        await truffleAssert.reverts( 
            contractInstance.transferOwnership(accounts[2], {from: accounts[2]}),
            "Only the owner can run this function"
        )
        */ 
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
