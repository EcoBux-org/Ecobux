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
const EcoBuxFee = contract.fromArtifact('EcoBuxFee');
const MarketPlace = contract.fromArtifact('MarketPlace');
const PanamaJungle = contract.fromArtifact('PanamaJungle');

const [admin, seller, buyer, buyer2] = accounts;

// Start test block
describe('MarketPlace', function() {
  beforeEach(async function() {
    EcoBuxInstance = await EcoBux.new({from: admin});
    EcoBuxFeeInstance = await EcoBuxFee.new({from: admin});
    PanamaJungleInstance = await PanamaJungle.new(
        EcoBuxInstance.address,
        {from: admin},
    );
    this.contract = await MarketPlace.new(
        EcoBuxInstance.address,
        EcoBuxFeeInstance.address,
        {from: admin},
    );

    // Fund contracts to cover gas cost
    await gsn.fundRecipient(web3, {recipient: EcoBuxInstance.address});
    await gsn.fundRecipient(web3, {recipient: PanamaJungleInstance.address});
    await gsn.fundRecipient(web3, {recipient: this.contract.address});

    // Create a single allotment
    allotments = require('./utils/allotments.json');
    allotments = allotments.slice(0, 1);

    const {tx} = await PanamaJungleInstance.bulkCreateAllotment(
        allotments,
        {from: admin, useGSN: false},
    );
    await expectEvent.inTransaction(
        tx, PanamaJungle, 'Transfer',
        {from: ZERO_ADDRESS, to: PanamaJungleInstance.address},
    );
  });

  context('Create Order functions', async function() {
    it('create a new sell order', async function() {
      // Buy Allotment for seller
      const ecoMint = 25; // Amount of EcoBux to mint: Used to buy allotment
      const ecoPrice = 25; // Cost of sell order
      await EcoBuxInstance.createEco(seller, ecoMint, {from: admin});
      await EcoBuxInstance.approve(
          PanamaJungleInstance.address, ecoMint,
          {from: seller, useGSN: true},
      );
      await expect((
        await EcoBuxInstance.allowance(
            seller,
            PanamaJungleInstance.address,
        )).toString(),
      ).to.equal(ecoMint.toString());
      await PanamaJungleInstance.buyAllotments(
          1,
          seller,
          {from: seller, useGSN: true},
      );

      // Bought allotment 0
      const ownedAllotment = 0;

      // Approve MarketPlace Contract to manage asset
      await PanamaJungleInstance.approve(
          this.contract.address,
          ownedAllotment,
          {from: seller, useGSN: true},
      );

      // Create Sell Order
      const {tx} = await this.contract.createOrder(
          PanamaJungleInstance.address,
          ownedAllotment,
          ecoPrice,
          {from: seller, useGSN: false},
      );
      await expectEvent.inTransaction(
          tx,
          MarketPlace,
          'OrderCreated',
          {
            assetId: ownedAllotment.toString(),
            assetOwner: seller,
            subTokenAddress: PanamaJungleInstance.address,
            ecoPrice: ecoPrice.toString(),
          },
      );
    });
    it('fail to create order if subTokenAddr is not ERC721', async function() {
      // Bought allotment 0
      const ownedAllotment = 0;
      const ecoPrice = 25;

      await expectRevert(
          this.contract.createOrder(
              seller,
              ownedAllotment,
              ecoPrice,
              {from: seller},
          ),
          'Address must be a contract',
      );
    });
    it('fail to create sell order if contract owns asset', async function() {
      const ecoPrice = 25; // Cost of sell order

      // Allotment 0 is the only one available
      const ownedAllotment = 0;

      await expectRevert(
          this.contract.createOrder(
              PanamaJungleInstance.address,
              ownedAllotment,
              ecoPrice,
              {from: seller},
          ),
          'Only the owner can make orders',
      );
    });
    it('fail to create sell order if price doesnt cover fee', async function() {
      // Buy Allotment for seller
      const ecoMint = 25; // Amount of EcoBux to mint: Used to buy allotment
      const ecoPrice = 20; // Cost of sell order
      await EcoBuxInstance.createEco(seller, ecoMint, {from: admin});
      await EcoBuxInstance.approve(
          PanamaJungleInstance.address, ecoMint,
          {from: seller, useGSN: true},
      );
      await expect((
        await EcoBuxInstance.allowance(
            seller,
            PanamaJungleInstance.address,
        )).toString(),
      ).to.equal(ecoMint.toString());
      await PanamaJungleInstance.buyAllotments(
          1,
          seller,
          {from: seller, useGSN: true},
      );

      // Allotment 0 is the only one available
      const ownedAllotment = 0;

      // Approve MarketPlace Contract to manage asset
      await PanamaJungleInstance.approve(
          this.contract.address,
          ownedAllotment,
          {from: seller, useGSN: true},
      );

      await expectRevert(
          this.contract.createOrder(
              PanamaJungleInstance.address,
              ownedAllotment,
              ecoPrice,
              {from: seller},
          ),
          'Asset price does not cover fees',
      );
    });
    it('fail to create order if owner not approve contract', async function() {
      // Buy Allotment for seller
      const ecoMint = 25; // Amount of EcoBux to mint: Used to buy allotment
      const ecoPrice = 25; // Cost of sell order
      await EcoBuxInstance.createEco(seller, ecoMint, {from: admin});
      await EcoBuxInstance.approve(
          PanamaJungleInstance.address, ecoMint,
          {from: seller, useGSN: true},
      );
      await expect((
        await EcoBuxInstance.allowance(
            seller,
            PanamaJungleInstance.address,
        )).toString(),
      ).to.equal(ecoMint.toString());
      await PanamaJungleInstance.buyAllotments(
          1,
          seller,
          {from: seller, useGSN: true},
      );

      // Allotment 0 is the only one available
      const ownedAllotment = 0;

      await expectRevert(
          this.contract.createOrder(
              PanamaJungleInstance.address,
              ownedAllotment,
              ecoPrice,
              {from: seller},
          ),
          'The contract is not authorized to manage the asset',
      );
    });
  });
  context('Cancel Order functions', async function() {
    beforeEach(async function() {
      // Create Sell order from seller

      // Buy Allotment for seller
      const ecoMint = 25; // Amount of EcoBux to mint: Used to buy allotment
      const ecoPrice = 25; // Cost of sell order
      await EcoBuxInstance.createEco(seller, ecoMint, {from: admin});
      await EcoBuxInstance.approve(
          PanamaJungleInstance.address, ecoMint,
          {from: seller, useGSN: true},
      );
      await expect((
        await EcoBuxInstance.allowance(
            seller,
            PanamaJungleInstance.address,
        )).toString(),
      ).to.equal(ecoMint.toString());
      await PanamaJungleInstance.buyAllotments(
          1,
          seller,
          {from: seller, useGSN: true},
      );

      // Bought allotment 0
      ownedAllotment = 0;

      // Approve MarketPlace Contract to manage asset
      await PanamaJungleInstance.approve(
          this.contract.address,
          ownedAllotment,
          {from: seller, useGSN: true},
      );

      // Create Sell Order
      const {tx} = await this.contract.createOrder(
          PanamaJungleInstance.address,
          ownedAllotment,
          ecoPrice,
          {from: seller, useGSN: false},
      );
      await expectEvent.inTransaction(
          tx,
          MarketPlace,
          'OrderCreated',
          {
            assetId: ownedAllotment.toString(),
            assetOwner: seller,
            subTokenAddress: PanamaJungleInstance.address,
            ecoPrice: ecoPrice.toString(),
          },
      );
    });
    it('cancel sell order', async function() {
      // Create Sell Order
      const {tx} = await this.contract.cancelOrder(
          PanamaJungleInstance.address,
          ownedAllotment,
          {from: seller, useGSN: false},
      );
      // TODO: verify orderId is correct
      await expectEvent.inTransaction(
          tx,
          MarketPlace,
          'OrderCancelled',
          {
            assetId: ownedAllotment.toString(),
            seller: seller,
            subTokenAddress: PanamaJungleInstance.address,
          },
      );
    });
    it('fail to cancel sell order if not owner of order', async function() {
      await expectRevert(
          this.contract.cancelOrder(
              PanamaJungleInstance.address,
              ownedAllotment,
              {from: buyer},
          ),
          'Unauthorized user',
      );
    });
    it('fail to cancel sell order if asset not published', async function() {
      await expectRevert(
          this.contract.cancelOrder(
              PanamaJungleInstance.address,
              5138008,
              {from: buyer},
          ),
          'Asset not published',
      );
    });
  });
  context('Execute Order functions', async function() {
    beforeEach(async function() {
      // Create Sell order from seller

      // Buy Allotment for seller
      const ecoMint = 25; // Amount of EcoBux to mint: Used to buy allotment
      const ecoPrice = 25; // Cost of sell order
      await EcoBuxInstance.createEco(seller, ecoMint, {from: admin});
      await EcoBuxInstance.approve(
          PanamaJungleInstance.address, ecoMint,
          {from: seller, useGSN: true},
      );
      await expect((
        await EcoBuxInstance.allowance(
            seller,
            PanamaJungleInstance.address,
        )).toString(),
      ).to.equal(ecoMint.toString());
      await PanamaJungleInstance.buyAllotments(
          1,
          seller,
          {from: seller, useGSN: true},
      );

      // Bought allotment 0
      ownedAllotment = 0;

      // Approve MarketPlace Contract to manage asset
      await PanamaJungleInstance.approve(
          this.contract.address,
          ownedAllotment,
          {from: seller, useGSN: true},
      );

      // Create Sell Order
      const {tx} = await this.contract.createOrder(
          PanamaJungleInstance.address,
          ownedAllotment,
          ecoPrice,
          {from: seller, useGSN: false},
      );
      await expectEvent.inTransaction(
          tx,
          MarketPlace,
          'OrderCreated',
          {
            assetId: ownedAllotment.toString(),
            assetOwner: seller,
            subTokenAddress: PanamaJungleInstance.address,
            ecoPrice: ecoPrice.toString(),
          },
      );
    });
    it('execute sell order', async function() {
      const ecoPrice = 25;
      // Give buyer EcoBux
      await EcoBuxInstance.createEco(buyer, ecoPrice, {from: admin});
      await EcoBuxInstance.approve(
          this.contract.address, ecoPrice,
          {from: buyer, useGSN: true},
      );

      // Execute Sell Order
      const {tx} = await this.contract.executeOrder(
          PanamaJungleInstance.address,
          ownedAllotment,
          ecoPrice,
          {from: buyer, useGSN: false},
      );
      // TODO: verify orderId is correct
      await expectEvent.inTransaction(
          tx,
          MarketPlace,
          'OrderSuccessful',
          {
            assetId: ownedAllotment.toString(),
            seller: seller,
            subTokenAddress: PanamaJungleInstance.address,
            totalPrice: ecoPrice.toString(),
            buyer: buyer,
          },
      );
    });
    it('fail to execute order if asset not published', async function() {
      await expectRevert(
          this.contract.executeOrder(
              PanamaJungleInstance.address, // Subtoken Address
              5138008, // Asset ID
              1, // Price
              {from: buyer},
          ),
          'Asset not published',
      );
    });
    it('fail to execute order if seller tries to buy asset', async function() {
      await expectRevert(
          this.contract.executeOrder(
              PanamaJungleInstance.address, // Subtoken Address
              0, // Asset ID
              1, // Price
              {from: seller},
          ),
          'Seller cannot buy asset',
      );
    });
    it('fail to execute order if incorrect price', async function() {
      await expectRevert(
          this.contract.executeOrder(
              PanamaJungleInstance.address, // Subtoken Address
              ownedAllotment, // Asset ID
              1, // Price
              {from: buyer},
          ),
          'The price is not correct',
      );
    });
    it('fail to execute order if buyer does not have EcoBux', async function() {
      await expectRevert(
          this.contract.executeOrder(
              PanamaJungleInstance.address, // Subtoken Address
              ownedAllotment, // Asset ID
              25, // Price
              {from: buyer},
          ),
          'Not Enough EcoBux',
      );
    });
    it('fail to execute if seller is not owner of asset', async function() {
      // In this test, seller and buyer are corroborating to steal EcoBux

      // Approve buyer to take asset
      await PanamaJungleInstance.approve(buyer, ownedAllotment, {from: seller});
      // buyer takes asset
      await PanamaJungleInstance.safeTransferFrom(
          seller,
          buyer,
          ownedAllotment,
          {from: buyer},
      );

      // Buyer2 Can no longer execute order
      await expectRevert(
          this.contract.executeOrder(
              PanamaJungleInstance.address, // Subtoken Address
              ownedAllotment, // Asset ID
              25, // Price
              {from: buyer2},
          ),
          'The seller not the owner',
      );
    });
  });
});
