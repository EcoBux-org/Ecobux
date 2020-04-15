const PanamaFuture = artifacts.require('./PanamaFuture.sol');
const EcoBux = artifacts.require('./EcoBux.sol');
//const numberToBN = require('number-to-bn');
const assert = require('assert')
const truffleAssert = require('truffle-assertions');

contract('PanamaFuture', (accounts) => {
  const _name = "PanamaFuture";
  const _symbol = "PAF";
  const _decimals = 0;

  beforeEach(async () => {
    EcoBuxInstance = await EcoBux.deployed()
    PanamaFutureInstance = await PanamaFuture.deployed()
  })

  it("should have a name", async () => {
    assert.equal(await PanamaFutureInstance.name(), _name, "Name is incorrect!");
  });

  it("should have a symbol", async () => {
    assert.equal(await PanamaFutureInstance.symbol(), _symbol, "Symbol is incorrect!");
  });
  
  it("should have 0 decimals", async () => {
    assert.equal(await PanamaFutureInstance.decimals(), _decimals, "Decimals are incorrect!");
  });

  it("should mint tokens", async () => {
    // Setup
    const ecoMint = 250;
    const futuresBought = 10;
    const futurePrice = 25
    let ecob = await EcoBuxInstance.createEco(accounts[0],ecoMint)
    await EcoBuxInstance.approve(PanamaFutureInstance.address, ecoMint)
    // Mint tokens
    const mintable = await PanamaFutureInstance.buyFuture(futuresBought) 
    // Check if tokens were successfully minted
    assert.equal(await PanamaFutureInstance.balanceOf(accounts[0]), futuresBought, "Tokens were not successfully minted");
    // Check if ecobux was taken from account
    assert.equal(await EcoBuxInstance.balanceOf(accounts[0])==(ecoMint-futuresBought*futurePrice), true, "EcoBux was not taken from account");
  })
  
  
  it("should fail to mint when not enough ecobux", async () => {
    // Mint tokens
    await truffleAssert.reverts( 
      PanamaFutureInstance.buyFuture(1000, {from: accounts[1]}),
      "Not Enough EcoBux"
    ) 
  })
  
  it("should set a new price", async () => {
    // Set new price
    const newPrice = 1000;
    const price = await PanamaFutureInstance.setCurrentPrice(newPrice);
    // Check if price was actually changed
    assert.equal(await PanamaFutureInstance.currentPrice.call(), newPrice, "Price was not successfully updated");
  })

  it("should fail to set a new price if not owner", async () => {
    // Set new price
    const newPrice = 1000;
    // Check if price was not actually changed
    await truffleAssert.reverts( 
      PanamaFutureInstance.setCurrentPrice(newPrice, {from: accounts[1]}),
      "Only the owner can run this function"
    ) 
  })

  it("should update EcoBux address", async () => {
    const addr = await PanamaFutureInstance.setEcoBuxAddress(accounts[3])
    assert.equal(await PanamaFutureInstance.ecoBuxAddress.call(), accounts[3], "EcoBux address was not updated")
  })
  
  it("should fail to update EcoBux address if not owner", async () => {
    await truffleAssert.reverts( 
      PanamaFutureInstance.setEcoBuxAddress(accounts[3], {from: accounts[2]}),
      "Only the owner can run this function"
    )
  })

  it("should transfer owership of contract", async () => {
        const owner = await PanamaFutureInstance.transferOwnership(accounts[1], {from: accounts[0]})
        truffleAssert.eventEmitted(owner, 'OwnershipTransferred', (ev) => {
          return true
        })
        /*
        await truffleAssert.reverts( 
            PanamaFutureInstance.transferOwnership(accounts[2], {from: accounts[2]}),
            "Only the owner can run this function"
        )
        */ 
    })
  
    it("should fail to transfer ownership if to 0 address", async () => {
        await truffleAssert.reverts( 
            PanamaFutureInstance.transferOwnership('0x0000000000000000000000000000000000000000', {from: accounts[1]}),
            "Ownership cannot be transferred to zero address"
        )
    })
    
    it("should fail to transfer ownership if not owner", async () => {
        await truffleAssert.reverts( 
            PanamaFutureInstance.transferOwnership(accounts[2], {from: accounts[2]}),
            "Only the owner can run this function"
        )
    })

    it("should fail to relinquish ownership if not owner", async () => {
        await truffleAssert.reverts( 
            PanamaFutureInstance.renounceOwnership({from: accounts[2]}),
            "Only the owner can run this function"
        )
    })

    it("should relinquish owership of contract", async () => {
        // BUG: This should be from accounts[0] but it has to be from acconts[1] because of transfer owner test
        const owner = await PanamaFutureInstance.renounceOwnership({from: accounts[1]})
        truffleAssert.eventEmitted(owner, 'OwnershipRenounced', (ev) => {
          return true
        })

        await truffleAssert.reverts( 
            PanamaFutureInstance.transferOwnership(accounts[1], {from: accounts[0]}),
            "Only the owner can run this function"
        )
    
    })
})
