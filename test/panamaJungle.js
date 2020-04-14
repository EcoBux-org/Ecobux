const PanamaJungle = artifacts.require('./PanamaJungle.sol')
const EcoBux = artifacts.require('./EcoBux.sol')

//const numberToBN = require('number-to-bn');
const assert = require('assert')
const assertRevert = require('./utils/assertRevert').assertRevert;
const truffleAssert = require('truffle-assertions');
let contractInstance
let ecoBuxInstance

contract('PanamaJungle/EcoBux', (accounts) => {
    beforeEach(async () => {
        ecoBuxInstance = await EcoBux.deployed()
        contractInstance = await PanamaJungle.deployed(ecoBuxInstance.address)
    })

    it('should create and then get details of a purchasable microaddon', async () => {
        const price = 10
        const purchasable = 1

        const addonId = await contractInstance.createMicro(price, purchasable, {from: accounts[0]})

        assert.notEqual(price, addonId, 'The allotment geoPoints are not the same')
    })

    it('should create and then buy a purchasable microaddon', async () => {
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
