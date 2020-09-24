// Load dependencies
const {accounts, contract, web3} = require("@openzeppelin/test-environment");
const {expectEvent, expectRevert, constants} = require("@openzeppelin/test-helpers");
const gsn = require("@openzeppelin/gsn-helpers");
const {expect} = require("chai");
const {ZERO_ADDRESS} = constants;

// Load compiled artifacts
const EcoBux = contract.fromArtifact("EcoBux");
const EcoBuxFee = contract.fromArtifact("EcoBuxFee");
const Piloto = contract.fromArtifact("Piloto");

const [admin, user, user2] = accounts;

// Start test block
describe("Piloto", function () {
  // Some tests take a while to setup, increase timeout to allow the tests to complete
  this.timeout(150000);
  beforeEach(async function () {
    // Deploy a new Piloto and EcoBux contract for each test
    EcoBuxInstance = await EcoBux.new({from: admin});
    EcoBuxFeeInstance = await EcoBuxFee.new({from: admin});
    this.contract = await Piloto.new(EcoBuxInstance.address, EcoBuxFeeInstance.address, {
      from: admin,
    });
  });

  context("Basic ERC721 Functions", function () {
    it("has a name", async function () {
      await expect(await this.contract.name()).to.equal("Piloto");
    });
    it("has a symbol", async function () {
      await expect(await this.contract.symbol()).to.equal("PILO");
    });
  });

  context("EcoBlock Creation Functions", function () {
    beforeEach(async function () {
      // Fund contracts to cover gas cost
      await gsn.fundRecipient(web3, {recipient: EcoBuxInstance.address});
      await gsn.fundRecipient(web3, {recipient: this.contract.address});

      // Create EcoBlocks
      EcoBlocks = require("./utils/EcoBlocks.json");
      EcoBlocks = EcoBlocks.slice(0, 5);

      const {tx} = await this.contract.bulkCreateEcoBlocks(EcoBlocks, {from: admin, useGSN: false});
      await expectEvent.inTransaction(tx, Piloto, "Transfer", {
        from: ZERO_ADDRESS,
        to: this.contract.address,
      });
    });
    // TODO: test total number of EcoBlocks
    // Not an issue if not implemented, as long as 17 ecoBlocks can be made
    // Error right now is timeout, takes too long and then interrupts other tests
    /*
    it('create all EcoBlocks', async function() {
      const EcoBlocks = require('./utils/EcoBlocks.json');
      for (i = 17; i< EcoBlocks.length; i+=17) {
        const {tx} = await this.contract.bulkCreateEcoBlocks(
            EcoBlocks.slice(i, i+17),
            {from: admin, useGSN: false},
        );
        expectEvent.inTransaction(
            tx, Piloto, 'Transfer',
            {from: ZERO_ADDRESS, to: this.contract.address},
        );
      }
    });
    */

    it("fails to create EcoBlocks if not owner", async function () {
      await expectRevert(
        this.contract.bulkCreateEcoBlocks(EcoBlocks, {from: user}),
        "Only the owner can run this function"
      );
    });

    it("buy EcoBlock with GSN", async function () {
      const startEth = await web3.eth.getBalance(user);
      const ecoMint = 1500;
      await EcoBuxInstance.createEco(user, ecoMint, {from: admin});
      await EcoBuxInstance.approve(this.contract.address, ecoMint, {from: user, useGSN: true});
      await expect(
        (await EcoBuxInstance.allowance(user, this.contract.address)).toString()
      ).to.equal(ecoMint.toString());

      await this.contract.buyEcoBlocks(1, user, {from: user, useGSN: true});

      // Test if EcoBlock was purchased
      await expect(await this.contract.ownedEcoBlocks(user)).to.be.length(1);

      // Test if GSN worked
      // Note that we need to use strings to compare the 256 bit integers
      await expect((await web3.eth.getBalance(user)).toString()).to.equal(startEth);
    });

    it("give EcoBlock from admin", async function () {
      await this.contract.giveEcoBlocks(1, user, {from: admin});

      // Test if EcoBlock was purchased
      await expect(await this.contract.ownedEcoBlocks(user)).to.be.length(1);
    });

    it("buy multiple EcoBlocks", async function () {
      const startEth = await web3.eth.getBalance(user);
      const ecoMint = 4500;
      await EcoBuxInstance.createEco(user, ecoMint, {from: admin});
      await EcoBuxInstance.approve(this.contract.address, ecoMint, {from: user, useGSN: true});
      await expect(
        (await EcoBuxInstance.allowance(user, this.contract.address)).toString()
      ).to.equal(ecoMint.toString());

      await this.contract.buyEcoBlocks(3, user, {from: user, useGSN: true});

      // Test if EcoBlock was purchased
      await expect(await this.contract.ownedEcoBlocks(user)).to.be.length(3);

      // Verify fee is taken
      expect((await EcoBuxInstance.balanceOf(EcoBuxFeeInstance.address)).toNumber()).to.equal(
        Math.floor(1500 * 0.02 * 3) // 2%
      );

      // Test if GSN worked
      // Note that we need to use strings to compare the 256 bit integers
      await expect((await web3.eth.getBalance(user)).toString()).to.equal(startEth);
    });

    it("fails to buy EcoBlocks if not enough EcoBux", async function () {
      await expectRevert(
        this.contract.buyEcoBlocks(1, user, {from: user}),
        "Not enough available Ecobux!"
      );
    });
    it("fails to buy EcoBlocks if not enough EcoBlocks", async function () {
      const ecoMint = 150000;
      await EcoBuxInstance.createEco(user, ecoMint, {from: admin});
      await EcoBuxInstance.approve(this.contract.address, ecoMint, {from: user});

      await expectRevert(
        this.contract.buyEcoBlocks(100, user, {from: user}),
        "Not enough available tokens!"
      );
    });
    it("fails to give EcoBlock if not admin", async function () {
      await expectRevert(
        this.contract.giveEcoBlocks(1, user, {from: user}),
        "Only the owner can run this function"
      );
    });

    it("return info about all owned EcoBlocks", async function () {
      // Buy EcoBlock with GSN
      const ecoMint = 1500;
      await EcoBuxInstance.createEco(user, ecoMint, {from: admin});
      await EcoBuxInstance.approve(this.contract.address, ecoMint, {from: user, useGSN: true});

      await this.contract.buyEcoBlocks(1, user, {from: user, useGSN: true});

      // Test if EcoBlock was purchased and correct info can be retrieved
      const ownedEcoBlock = await this.contract.ownedEcoBlocks(user);
      const ecoBlockDetails = await this.contract.ecoBlockDetails(ownedEcoBlock[0]);
      // Check if ID matches
      await expect(ecoBlockDetails[0].toString()).to.equal(ownedEcoBlock.toString());
      // Check if geoMap points match
      await expect(ecoBlockDetails[1].toString()).to.equal(EcoBlocks[ownedEcoBlock].toString());
      // Check if addons match (should be empty array)
      await expect(ecoBlockDetails[2].toString()).to.equal("");
    });
  });
  context("Microaddons Functions", function () {
    beforeEach(async function () {
      // Fund contracts to cover gas cost
      await gsn.fundRecipient(web3, {recipient: this.contract.address});

      // Create a single EcoBlock
      EcoBlocks = require("./utils/EcoBlocks.json");
      EcoBlocks = EcoBlocks.slice(0, 1);

      const {tx} = await this.contract.bulkCreateEcoBlocks(EcoBlocks, {from: admin, useGSN: false});
      await expectEvent.inTransaction(tx, Piloto, "Transfer", {
        from: ZERO_ADDRESS,
        to: this.contract.address,
      });
    });
    it("create a microaddon", async function () {
      const price = 10;
      const buyable = true;

      const {tx} = await this.contract.createMicro(price, buyable, {from: admin});
      await expectEvent.inTransaction(tx, Piloto, "NewAddon", {
        addonId: "0",
        price: price.toString(),
        buyable: buyable,
      });
    });
    it("fail to create a microaddon if not owner", async function () {
      await expectRevert(
        this.contract.createMicro(1, 1, {from: user}),
        "Only the owner can run this function"
      );
    });
    it("buy a buyable microaddon", async function () {
      // Create a microaddon
      const price = 10;
      const buyable = true;

      await this.contract.createMicro(price, buyable, {from: admin});

      // Mint EcoBux
      const ecoMint = 35;
      await EcoBuxInstance.createEco(user, ecoMint, {from: admin});
      await EcoBuxInstance.approve(this.contract.address, ecoMint, {from: user});
      await expect(
        (await EcoBuxInstance.allowance(user, this.contract.address)).toString()
      ).to.equal(ecoMint.toString());

      // Buy the microaddon
      const {tx} = await this.contract.buyMicro(0, 0, {from: user});

      await expectEvent.inTransaction(tx, Piloto, "AddedAddon");
    });
    /* Contract is too big when adding this function
    it("give Addon from admin", async function () {
      await this.contract.giveMicro(1, 1, {from: admin});
      // Test if Mirco was purchased
      await expectEvent.inTransaction(tx, Piloto, "AddedAddon");
    });
    it("fails to give Addon if not admin", async function () {
      await expectRevert(
        this.contract.giveMicro(1, user, {from: user}),
        "Only the owner can run this function"
      );
    });
    */
    it("fail to buy a microaddon if not buyable", async function () {
      // Create microaddon
      const price = 10;
      const buyable = false;

      await this.contract.createMicro(price, buyable, {from: admin});

      // Buy the microaddon (and fail)
      await expectRevert(
        this.contract.buyMicro(0, 0, {from: user}),
        "Selected microaddon does not exist or is not buyable"
      );
    });
    it("fail to buy microaddon if not enough ecobux", async function () {
      // Create microaddon
      const price = 10;
      const buyable = true;

      await this.contract.createMicro(price, buyable, {from: admin});

      // Buy the microaddon (and fail)
      await expectRevert(
        this.contract.buyMicro(0, 0, {from: user}),
        "Not enough available EcoBux!"
      );
    });
    it("fail to buy microaddon if token does not exist", async function () {
      // Create microaddon
      const price = 10;
      const buyable = true;

      await this.contract.createMicro(price, buyable, {from: admin});

      // Mint EcoBux
      const ecoMint = 35;
      await EcoBuxInstance.createEco(user, ecoMint, {from: admin});
      await EcoBuxInstance.approve(this.contract.address, ecoMint, {from: user});
      await expect(
        (await EcoBuxInstance.allowance(user, this.contract.address)).toString()
      ).to.equal(ecoMint.toString());

      // Buy the microaddon (and fail)
      await expectRevert(
        this.contract.buyMicro(2, 0, {from: user}),
        "Selected Token does not exist"
      );
    });
  });
  context("Admin Functions", function () {
    it("set a new EcoBlock price", async function () {
      const newPrice = 1000;
      await this.contract.setCurrentPrice(newPrice, {from: admin});

      await expect((await this.contract.currentPrice.call()).toString()).to.equal(
        newPrice.toString()
      );
    });
    it("fail to set a new price if not owner", async function () {
      const newPrice = 1000;
      await expectRevert(
        this.contract.setCurrentPrice(newPrice, {from: user}),
        "Only the owner can run this function"
      );
    });
    it("update EcoBux address", async function () {
      const newAddress = user2;
      await this.contract.setEcoBuxAddress(newAddress, {from: admin});

      await expect((await this.contract.ecoBuxAddress.call()).toString()).to.equal(
        newAddress.toString()
      );
    });
    it("fail to update EcoBux address if not owner", async function () {
      const newAddress = user2;
      await expectRevert(
        this.contract.setEcoBuxAddress(newAddress, {from: user}),
        "Only the owner can run this function"
      );
    });
    it("transfer owership of contract", async function () {
      const newAddress = user2;
      const {tx} = await this.contract.transferOwnership(newAddress, {from: admin});

      await expectEvent.inTransaction(tx, Piloto, "OwnershipTransferred");
    });
    it("fail to transfer ownership if to 0 address", async function () {
      const newAddress = ZERO_ADDRESS;
      await expectRevert(
        this.contract.transferOwnership(newAddress, {from: admin}),
        "Ownership cannot be transferred to zero address"
      );
    });
    it("fail to transfer ownership if not owner", async function () {
      const newAddress = user2;
      await expectRevert(
        this.contract.setEcoBuxAddress(newAddress, {from: user}),
        "Only the owner can run this function"
      );
    });
    it("fail to relinquish ownership if not owner", async function () {
      await expectRevert(
        this.contract.renounceOwnership({from: user}),
        "Only the owner can run this function"
      );
    });
    it("not allow contract functions if paused", async function () {
      // Pause contract
      await this.contract.pause({from: admin});
      // Cannot execute normal functions
      await expectRevert(
        this.contract.buyEcoBlocks(0, user, {from: user}),
        "Function cannot be used while contract is paused"
      );
    });
    it("only allow contract functions if not paused", async function () {
      // Cannot execute pause only functions
      await expectRevert(
        this.contract.unpause({from: admin}),
        "Function cannot be used while contract is not paused"
      );
    });
    it("relinquish owership of contract", async function () {
      const {tx} = await this.contract.renounceOwnership({from: admin});

      await expectEvent.inTransaction(tx, Piloto, "OwnershipRenounced");
    });
  });
});
