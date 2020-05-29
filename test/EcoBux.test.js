const {accounts, contract, web3} = require('@openzeppelin/test-environment');
const {
  // expectEvent,
  expectRevert,
} = require('@openzeppelin/test-helpers');
const {expect} = require('chai');

// Load compiled artifacts
const EcoBux = contract.fromArtifact('EcoBux');

const [admin, user] = accounts;

// Start test block
describe('EcoBux', function() {
  beforeEach(async function() {
    this.contract = await EcoBux.new({from: admin});
  });

  context('Basic ERC20 Functions', function() {
    it('has a name', async function() {
      await expect(await this.contract.name()).to.equal('EcoBux');
    });
    it('has a symbol', async function() {
      await expect(await this.contract.symbol()).to.equal('ECOB');
    });
    it('has decimals', async function() {
      await expect((await this.contract.decimals())
          .toString()).to.equal('2');
    });
  });
  context('Minting Functions', function() {
    it('mint tokens', async function() {
      this.contract.createEco(admin, 1000, {from: admin});

      await expect((await this.contract.balanceOf(admin))
          .toString()).to.equal('1000');
    });
    it('verify only owners can mint tokens', async function() {
      await expectRevert(
          this.contract.createEco(admin, 1000, {from: user}),
          'Must be owner to mint',
      );
      await expect((await this.contract.balanceOf(admin))
          .toString()).to.equal('0');
    });
  });
});
