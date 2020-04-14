const EcoBux = artifacts.require('./EcoBux.sol')

//const numberToBN = require('number-to-bn');
const assert = require('assert')
const truffleAssert = require('truffle-assertions');

contract('EcoBux', (accounts) => {
  const _name = "EcoBux";
  const _symbol = "ECOB";
  const _decimals = 2;

  beforeEach(async () => {
    EcoBuxInstance = await EcoBux.deployed()
  })

  it("should have a name", async () => {
    assert.equal(await EcoBuxInstance.name(), _name, "Name is incorrect!");
  });

  it("should have a symbol", async () => {
    assert.equal(await EcoBuxInstance.symbol(), _symbol, "Symbol is incorrect!");
  });

  it("should have decimals", async () => {
    assert.equal(await EcoBuxInstance.decimals(), _decimals, "Decimals are incorrect!");
  });

  it("should mint tokens", async () => {
    // Mint tokens
    const mintable = await EcoBuxInstance.createEco(accounts[0],1000) 
    // Check if tokens were successfully minted
    assert.equal(await EcoBuxInstance.balanceOf(accounts[0]), 1000, "Tokens were not successfully minted");
  })
  
  it("should verify only owners mint tokens", async () => {
    // Mint tokens
    await truffleAssert.reverts( 
      EcoBuxInstance.createEco(accounts[1],1000, {from: accounts[1]}),
      "Must be owner to mint"
    ) 
  })
})
