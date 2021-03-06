const {accounts, contract, web3} = require("@openzeppelin/test-environment");
const {expectRevert} = require("@openzeppelin/test-helpers");
const gsn = require("@openzeppelin/gsn-helpers");
const {expect} = require("chai");

// Load compiled artifacts
const EcoBux = contract.fromArtifact("EcoBux");
const PilotoFuture = contract.fromArtifact("PilotoFuture");

const [admin, user] = accounts;

const futurePrice = 1500;

// Start test block
describe("PilotoFuture", function () {
  beforeEach(async function () {
    EcoBuxInstance = await EcoBux.new({from: admin});
    this.contract = await PilotoFuture.new(EcoBuxInstance.address, {from: admin});
  });

  context("Basic ERC20 Functions", function () {
    it("has a name", async function () {
      await expect(await this.contract.name()).to.equal("PilotoFuture");
    });
    it("has a symbol", async function () {
      await expect(await this.contract.symbol()).to.equal("PILOF");
    });
    it("has 0 decimals", async function () {
      await expect((await this.contract.decimals()).toString()).to.equal("0");
    });
  });
  context("Minting Functions", function () {
    it("mint tokens", async function () {
      // Setup
      const futuresBought = 10;
      const ecoMint = futurePrice * futuresBought;
      await EcoBuxInstance.createEco(user, ecoMint, {from: admin});
      await EcoBuxInstance.approve(this.contract.address, ecoMint, {from: user});
      // Mint tokens
      await this.contract.buyFuture(futuresBought, {from: user});
      // Check if tokens were successfully minted
      expect((await this.contract.balanceOf(user)).toString()).to.equal(futuresBought.toString());
      // Check if ecobux was taken from account
      expect((await EcoBuxInstance.balanceOf(user)).toString()).to.equal(
        (ecoMint - futuresBought * futurePrice).toString()
      );
    });
    it("mint tokens with GSN", async function () {
      // Fund contracts to cover gas cost
      await gsn.fundRecipient(web3, {recipient: EcoBuxInstance.address});
      await gsn.fundRecipient(web3, {recipient: this.contract.address});
      const startEth = await web3.eth.getBalance(user);

      // Setup
      const futuresBought = 10;
      const ecoMint = futurePrice * futuresBought;
      await EcoBuxInstance.createEco(user, ecoMint, {from: admin});
      await EcoBuxInstance.approve(this.contract.address, ecoMint, {from: user, useGSN: true});
      // Mint tokens
      await this.contract.buyFuture(futuresBought, {from: user, useGSN: true});

      // Check if tokens were successfully minted
      await expect((await this.contract.balanceOf(user)).toString()).to.equal(
        futuresBought.toString()
      );
      // Check if ecobux was taken from account
      await expect((await EcoBuxInstance.balanceOf(user)).toString()).to.equal(
        (ecoMint - futuresBought * futurePrice).toString()
      );

      // Test if GSN worked
      // Note that we need to use strings to compare the 256 bit integers
      await expect((await web3.eth.getBalance(user)).toString()).to.equal(startEth);
    });
    it("give futures from admin", async function () {
      const futuresBought = 10;
      await this.contract.giveFuture(futuresBought, user, {from: admin});

      // Test if EcoBlock was purchased
      await expect((await this.contract.balanceOf(user)).toString()).to.equal(
        futuresBought.toString()
      );
    });
    it("fail to give Futures if not admin", async function () {
      await expectRevert(
        this.contract.giveFuture(1, user, {from: user}),
        "Only the owner can run this function"
      );
    });
    it("fail to mint when not enough ecobux", async function () {
      // Mint tokens
      await expectRevert(this.contract.buyFuture(1000, {from: accounts[1]}), "Not Enough EcoBux");
    });
  });
});
