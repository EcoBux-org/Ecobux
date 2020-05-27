// Load dependencies
const {accounts, contract, web3} = require('@openzeppelin/test-environment');
const {
  expectEvent,
  expectRevert,
  constants,
} = require('@openzeppelin/test-helpers');
const gsn = require('@openzeppelin/gsn-helpers');
const {expect} = require('chai');
const {ZERO_ADDRESS} = constants;


// Load compiled artifacts
const EcoBux = contract.fromArtifact('EcoBux');
const PanamaJungle = contract.fromArtifact('PanamaJungle');

const [admin, user, user2] = accounts;

// Start test block
describe('PanamaJungle', function() {
  beforeEach(async function() {
    // Deploy a new PanamaJungle contract for each test
    EcoBuxInstance = await EcoBux.new({from: admin});
    this.contract = await PanamaJungle.new(
        EcoBuxInstance.address,
        {from: admin},
    );
  });

  context('Basic ERC721 Functions', function() {
    it('has a name', async function() {
      await expect(await this.contract.name()).to.equal('PanamaJungle');
    });
    it('has a symbol', async function() {
      await expect(await this.contract.symbol()).to.equal('PAJ');
    });
  });

  context('Allotment Creation Functions', function() {
    beforeEach(async function() {
      // Fund contracts to cover gas cost
      await gsn.fundRecipient(web3, {recipient: this.contract.address});

      // Create allotments
      allotments = require('./utils/allotments.json');
      allotments = allotments.slice(0, 5);

      const {tx} = await this.contract.bulkCreateAllotment(
          allotments,
          {from: admin, useGSN: false},
      );
      await expectEvent.inTransaction(
          tx, PanamaJungle, 'Transfer',
          {from: ZERO_ADDRESS, to: this.contract.address},
      );
    });
    /*
    it('creates all allotments', async function() {
      const allotments = require('./utils/allotments.json');
      for (i = 17; i< allotments.length; i+=17) {
        const {tx} = await this.contract.bulkCreateAllotment(
            allotments.slice(i, i+17),
            {from: admin, useGSN: false},
        );
        expectEvent.inTransaction(
            tx, PanamaJungle, 'Transfer',
            {from: ZERO_ADDRESS, to: this.contract.address},
        );
      }
    });
    */
    it('fails to create allotments if not owner', async function() {
      await expectRevert(
          this.contract.bulkCreateAllotment(allotments, {from: user}),
          'Only the owner can run this function',
      );
    });

    it('buy allotmnet with GSN', async function() {
      const ecoMint = 25;
      await EcoBuxInstance.createEco(user, ecoMint, {from: admin});
      await EcoBuxInstance.approve(
          this.contract.address, ecoMint,
          {from: user},
      );
      const startEth = await web3.eth.getBalance(user);
      await expect((await EcoBuxInstance.allowance(user, this.contract.address))
          .toString()).to.equal(ecoMint.toString());

      await this.contract.buyAllotments(
          1,
          user,
          {from: user, useGSN: true},
      );

      // Test if allotment was purchased
      await expect(await this.contract.ownedAllotments(user)).to.be.length(1);

      // Test if GSN worked
      // Note that we need to use strings to compare the 256 bit integers
      await expect((await web3.eth.getBalance(user))
          .toString()).to.equal(startEth);
    });

    it('buy multiple allotmnet', async function() {
      const ecoMint = 75;
      await EcoBuxInstance.createEco(user, ecoMint, {from: admin});
      await EcoBuxInstance.approve(
          this.contract.address, ecoMint,
          {from: user},
      );
      const startEth = await web3.eth.getBalance(user);
      await expect((await EcoBuxInstance.allowance(user, this.contract.address))
          .toString()).to.equal(ecoMint.toString());

      await this.contract.buyAllotments(
          3,
          user,
          {from: user, useGSN: true},
      );

      // Test if allotment was purchased
      await expect(await this.contract.ownedAllotments(user)).to.be.length(3);

      // Test if GSN worked
      // Note that we need to use strings to compare the 256 bit integers
      await expect((await web3.eth.getBalance(user))
          .toString()).to.equal(startEth);
    });

    it('fails to buy allotments if not enough EcoBux', async function() {
      await expectRevert(
          this.contract.buyAllotments(1, user, {from: user}),
          'Not enough available Ecobux!',
      );
    });
    it('fails to buy allotments if not enough Allotments', async function() {
      const ecoMint = 2500;
      await EcoBuxInstance.createEco(user, ecoMint, {from: admin});
      await EcoBuxInstance.approve(
          this.contract.address, ecoMint,
          {from: user},
      );

      await expectRevert(
          this.contract.buyAllotments(100, user, {from: user}),
          'Not enough available tokens!',
      );
    });
    it('return info about all owned allotments', async function() {
      // TODO: Figure out a way to track all owned allotments
      // const owned = await this.contract.ownedAllotments(user);
      // expect(owned.length).not.to.equal(0);
    });
  });
  context('Microaddons Functions', function() {
    beforeEach(async function() {
      // Fund contracts to cover gas cost
      await gsn.fundRecipient(web3, {recipient: this.contract.address});

      // Create a single allotment
      allotments = require('./utils/allotments.json');
      allotments = allotments.slice(0, 1);

      const {tx} = await this.contract.bulkCreateAllotment(
          allotments,
          {from: admin, useGSN: false},
      );
      await expectEvent.inTransaction(
          tx, PanamaJungle, 'Transfer',
          {from: ZERO_ADDRESS, to: this.contract.address},
      );
    });
    it('create a microaddon', async function() {
      const price = 10;
      const buyable = true;

      const {tx} = await this.contract.createMicro(
          price,
          buyable,
          {from: admin},
      );
      await expectEvent.inTransaction(
          tx, PanamaJungle, 'NewAddon',
          {addonId: '0', price: price.toString(), buyable: buyable},
      );
    });
    it('fail to create a microaddon if not owner', async function() {
      await expectRevert(
          this.contract.createMicro(1, 1, {from: user}),
          'Only the owner can run this function',
      );
    });
    it('buy a buyable microaddon', async function() {
      // Create a microaddon
      const price = 10;
      const buyable = true;

      await this.contract.createMicro(
          price,
          buyable,
          {from: admin},
      );

      // Mint EcoBux
      const ecoMint = 35;
      await EcoBuxInstance.createEco(user, ecoMint, {from: admin});
      await EcoBuxInstance.approve(
          this.contract.address, ecoMint,
          {from: user},
      );
      await expect((await EcoBuxInstance.allowance(user, this.contract.address))
          .toString()).to.equal(ecoMint.toString());

      // Buy the microaddon
      const {tx} = await this.contract.buyMicro(0, 0, {from: user});

      await expectEvent.inTransaction(
          tx, PanamaJungle, 'AddedAddon',
      );
    });
    it('fail to buy a microaddon if not buyable', async function() {
      // Create microaddon
      const price = 10;
      const buyable = false;

      await this.contract.createMicro(
          price,
          buyable,
          {from: admin},
      );

      // Buy the microaddon (and fail)
      await expectRevert(
          this.contract.buyMicro(0, 0, {from: user}),
          'Selected microaddon does not exist or is not buyable',
      );
    });
    it('fail to buy microaddon if not enough ecobux', async function() {
      // Create microaddon
      const price = 10;
      const buyable = true;

      await this.contract.createMicro(
          price,
          buyable,
          {from: admin},
      );

      // Buy the microaddon (and fail)
      await expectRevert(
          this.contract.buyMicro(0, 0, {from: user}),
          'Not enough available EcoBux!',
      );
    });
    it('fail to buy microaddon if token does not exist', async function() {
      // Create microaddon
      const price = 10;
      const buyable = true;

      await this.contract.createMicro(
          price,
          buyable,
          {from: admin},
      );

      // Mint EcoBux
      const ecoMint = 35;
      await EcoBuxInstance.createEco(user, ecoMint, {from: admin});
      await EcoBuxInstance.approve(
          this.contract.address, ecoMint,
          {from: user},
      );
      await expect((await EcoBuxInstance.allowance(user, this.contract.address))
          .toString()).to.equal(ecoMint.toString());

      // Buy the microaddon (and fail)
      await expectRevert(
          this.contract.buyMicro(2, 0, {from: user}),
          'Selected Token does not exist',
      );
    });
  });
  context('Admin Functions', function() {
    it('set a new allotment price', async function() {
      const newPrice = 1000;
      await this.contract.setCurrentPrice(newPrice, {from: admin});

      await expect((await this.contract.currentPrice.call()).toString())
          .to.equal(newPrice.toString());
    });
    it('fail to set a new price if not owner', async function() {
      const newPrice = 1000;
      await expectRevert(
          this.contract.setCurrentPrice(newPrice, {from: user}),
          'Only the owner can run this function',
      );
    });
    it('update EcoBux address', async function() {
      const newAddress = user2;
      await this.contract.setEcoBuxAddress(newAddress, {from: admin});

      await expect((await this.contract.ecoBuxAddress.call()).toString())
          .to.equal(newAddress.toString());
    });
    it('fail to update EcoBux address if not owner', async function() {
      const newAddress = user2;
      await expectRevert(
          this.contract.setEcoBuxAddress(newAddress, {from: user}),
          'Only the owner can run this function',
      );
    });
    it('transfer owership of contract', async function() {
      const newAddress = user2;
      const {tx} = await this.contract.transferOwnership(
          newAddress,
          {from: admin},
      );

      await expectEvent.inTransaction(
          tx, PanamaJungle,
          'OwnershipTransferred',
      );
    });
    it('fail to transfer ownership if to 0 address', async function() {
      const newAddress = ZERO_ADDRESS;
      await expectRevert(
          this.contract.transferOwnership(newAddress, {from: admin}),
          'Ownership cannot be transferred to zero address',
      );
    });
    it('fail to transfer ownership if not owner', async function() {
      const newAddress = user2;
      await expectRevert(
          this.contract.setEcoBuxAddress(newAddress, {from: user}),
          'Only the owner can run this function',
      );
    });
    it('fail to relinquish ownership if not owner', async function() {
      await expectRevert(
          this.contract.renounceOwnership({from: user}),
          'Only the owner can run this function',
      );
    });
    it('not allow contract functions if paused', async function() {
      // Pause contract
      await this.contract.pause({from: admin});
      // Cannot execute normal functions
      await expectRevert(
          this.contract.buyAllotments(0, user, {from: user}),
          'Function cannot be used while contract is paused',
      );
    });
    it('only allow contract functions if not paused', async function() {
      // Cannot execute pause only functions
      await expectRevert(
          this.contract.unpause({from: admin}),
          'Function cannot be used while contract is not paused',
      );
    });
    it('relinquish owership of contract', async function() {
      const {tx} = await this.contract.renounceOwnership(
          {from: admin},
      );

      await expectEvent.inTransaction(
          tx, PanamaJungle,
          'OwnershipRenounced',
      );
    });
  });
});
