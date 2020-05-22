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
    contractInstance = await PanamaFuture.deployed()
  })

  describe("Basic ERC20 Functions", async () => {
      it("should have a name", async () => {
        assert.equal(await contractInstance.name(), _name, "Name is incorrect!");
      });

      it("should have a symbol", async () => {
        assert.equal(await contractInstance.symbol(), _symbol, "Symbol is incorrect!");
      });
      
      it("should have 0 decimals", async () => {
        assert.equal(await contractInstance.decimals(), _decimals, "Decimals are incorrect!");
      });
  });

  describe("Minting Functions", async () => {
      it("should mint tokens", async () => {
        // Setup
        const ecoMint = 250;
        const futuresBought = 10;
        const futurePrice = 25
        let ecob = await EcoBuxInstance.createEco(accounts[0],ecoMint)
        await EcoBuxInstance.approve(contractInstance.address, ecoMint)
        // Mint tokens
        const mintable = await contractInstance.buyFuture(futuresBought) 
        // Check if tokens were successfully minted
        assert.equal(await contractInstance.balanceOf(accounts[0]), futuresBought, "Tokens were not successfully minted");
        // Check if ecobux was taken from account
        assert.equal(await EcoBuxInstance.balanceOf(accounts[0])==(ecoMint-futuresBought*futurePrice), true, "EcoBux was not taken from account");
      })
      
      
      it("should fail to mint when not enough ecobux", async () => {
        // Mint tokens
        await truffleAssert.reverts( 
          contractInstance.buyFuture(1000, {from: accounts[1]}),
          "Not Enough EcoBux"
        ) 
      })
  });
  
  describe("Owner Functions", async () => {
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

        it("should not allow contract functions if paused", async () => {
            await contractInstance.pause({from: accounts[1]})
            await truffleAssert.reverts( 
                contractInstance.pause({from: accounts[1]}),
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
      
        // Keep this at the end; After these tests there is no owner
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
  });
})
