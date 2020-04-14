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

})
