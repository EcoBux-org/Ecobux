// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.6.0;

// Import OpenZeppelin's ERC-721 Implementation
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
// OpenZeppelin's SafeMath Implementation is used to avoid overflows
import "@openzeppelin/contracts/math/SafeMath.sol";
// OpenZeppelin's GSN: Users dont need to hold ETH to transact ECOB
import "@openzeppelin/contracts/GSN/GSNRecipient.sol";

// Permission abstract contracts to control contract after deploy
import "./utils/Ownable.sol";
import "./utils/Pausable.sol";
// Interface contract to interact with EcoBux
import "./utils/Erc20.sol";

contract Piloto is ERC721, Ownable, Pausable, GSNRecipient {
    // Prevents overflows with uint256
    using SafeMath for uint256;

    // Struct to represent one EcoBlock of land
    struct EcoBlock {
        // Array of lat/lng points to represent the boundaries of a point.
        // Points use a linear transform to fit into uint16 values with neglible
        // loss in data, see the EcoBux GitHub page for info on converting these
        // values
        uint16[2][5] geoMap;
        // Array of microaddons for each EcoBlock
        // uint16 gives max 65535 possible unique microaddons
        uint16[] addons;
    }

    // List of EcoBlocks to store and iterate through
    EcoBlock[] internal ecoBlocks;

    // Struct defines microaddon properties for an EcoBlock
    struct MicroAddon {
        uint16 price;
        bool buyable;
    }

    // List of existing microAddons
    MicroAddon[] public microAddons;

    // Event emitted when a new mircoAddon is created
    event NewAddon(uint256 addonId, uint16 price, bool buyable);

    // Event emitted when a microAddon is added to an EcoBlock
    event AddedAddon(uint256 tokenId, uint16 addonId);

    // Define contract's token address
    ERC721 public nftAddress = ERC721(address(this));
    // Default to 25 ECOB per EcoBlock. Changed by setCurrentPrice()
    uint256 public currentPrice = 25;
    // Nonce is Theoretically predictable, but only used to pick EcoBlocks bought
    // https://medium.com/@tiagobertolo/how-to-safely-generate-random-numbers-in-solidity-contracts-bd8bd217ff7b
    uint256 private randomNonce;
    // Declare ecobux address
    ERC20 public ecoBuxAddress;

    // Start contract with EcoBux address as parameter
    constructor(address _ecoBuxAddress) public ERC721("Piloto", "PILO") {
        ecoBuxAddress = ERC20(_ecoBuxAddress);
    }

    /** @dev Function to group create EcoBlocks
     * @param _ecoBlocks an array of arrays of points for creating each EcoBlock bounds
     * Each lat lng point converts to having six decimal points, about 4 inches of precision.
     * They are stored compressed in uint16 to save space
     * And solidity does not handle fixed points well
     * (precision is not accuracy, note https://gis.stackexchange.com/a/8674 )
     * @return success bool if the EcoBlock generation was successful
     */
    function bulkCreateEcoBlocks(uint16[2][5][] calldata _ecoBlocks)
        external
        onlyOwner
        returns (bool success)
    {
        // For each EcoBlock in initial array
        for (uint256 i = 0; i < _ecoBlocks.length; i++) {
            _createEcoBlock(_ecoBlocks[i]);
        }
        return true;
    }

    /** @dev Function to buy EcoBlocks
     * @param _tokensDesired number of EcoBlocks to buy from contract
     * @param _to address to send bought EcoBlocks
     */
    function buyEcoBlocks(uint256 _tokensDesired, address _to) external whenNotPaused {
        require(
            availableECO(_msgSender()) >= currentPrice * _tokensDesired,
            "Not enough available Ecobux!"
        );

        // Take money from account before so no chance of re entry attacks
        takeEco(_msgSender(), currentPrice * _tokensDesired);

        // Create memory array of all tokens owned by the contract to pick randomly
        uint256[] memory contractTokens = this.ownedEcoBlocks(address(this));

        require(contractTokens.length >= _tokensDesired, "Not enough available tokens!");

        for (uint256 i = 0; i < _tokensDesired; i++) {
            // Select random token from owned contract tokens
            uint256 tokenId = contractTokens[random() % contractTokens.length];

            // Transfer token from contract to user
            nftAddress.safeTransferFrom(address(this), _to, tokenId);

            // Refresh the list of available EcoBlocks
            // cant use pop() because contrarctTokens is memory array, we just have to start from scratch
            // gas cost is negligible however
            contractTokens = this.ownedEcoBlocks(address(this));
        }
    }

    /** @dev Function to create a new type of microaddon
     * @param _price uint of the cost (in ecobux) of the new microaddon
     * @param _buyable bool determining if the new microaddon can be bought by users
     * @return The new addon's ID
     */
    function createMicro(uint16 _price, bool _buyable) external onlyOwner returns (uint256) {
        MicroAddon memory newAddon = MicroAddon({price: _price, buyable: _buyable});
        microAddons.push(newAddon);
        uint256 newAddonId = microAddons.length - 1;
        emit NewAddon(newAddonId, _price, _buyable);
        return newAddonId;
    }

    /** @dev Function to add vitrual microtransactions to an EcoBlock
     * @param tokenId id of the token to add the microtransactions to
     * @param addonId Desired name of the addon mapped to an id
     * @return All microtransactions on tokenId
     */
    function buyMicro(uint256 tokenId, uint16 addonId)
        external
        whenNotPaused
        returns (uint16[] memory)
    {
        require(
            microAddons[addonId].buyable,
            "Selected microaddon does not exist or is not buyable."
        );
        require(
            availableECO(_msgSender()) >= microAddons[addonId].price,
            "Not enough available EcoBux!"
        );
        require(_exists(tokenId), "Selected Token does not exist");

        // Take money from account before event emitted to prevent reentry attacks
        takeEco(_msgSender(), microAddons[addonId].price);

        ecoBlocks[tokenId].addons.push(addonId); // Add addonId to token array

        emit AddedAddon(tokenId, addonId);

        return ecoBlocks[tokenId].addons;
    }

    /** @dev Function to get a list of owned EcoBlock IDs
     * @param addr address to check owned EcoBlocks
     * @return A uint array which contains IDs of all owned EcoBlocks
     */
    function ownedEcoBlocks(address addr) external view returns (uint256[] memory) {
        // Get total EcoBlocks owned by user to iterate through
        uint256 ecoBlockCount = balanceOf(addr);
        // Exit if no owned blocks
        if (ecoBlockCount == 0) {
            return new uint256[](0);
        }

        // Declare memory array and pre allocate array size to save gas
        uint256[] memory result = new uint256[](ecoBlockCount);
        uint256 totalEcoBlocks = ecoBlocks.length;
        uint256 resultIndex = 0;
        uint256 ecoBlockId = 0;
        while (ecoBlockId < totalEcoBlocks) {
            if (ownerOf(ecoBlockId) == addr) {
                result[resultIndex] = ecoBlockId;
                resultIndex = resultIndex.add(1);
            }
            ecoBlockId = ecoBlockId.add(1);
        }
        return result;
    }

    /** @dev Function to retrieve a specific EcoBlock's details.
     * @param id ID of the EcoBlock who's details will be retrieved
     * @return Array id and geopoints of an EcoBlock with all addons.
     */
    function ecoBlockDetails(uint256 id)
        external
        view
        returns (
            uint256,
            uint16[2][5] memory,
            uint16[] memory
        )
    {
        return (id, ecoBlocks[id].geoMap, ecoBlocks[id].addons);
    }

    /** @dev Function to retrieve a specific EcoBlock's details.
     * @param id ID of the EcoBlock who's details will be retrieved
     * @return Array id and geopoints of an EcoBlock with all addons.
     */
    function microDetails(uint256 id)
        external
        view
        returns (
            uint256,
            uint16,
            bool
        )
    {
        return (id, microAddons[id].price, microAddons[id].buyable);
    }

    // Relay Functions to allow users to avoid needing a wallet
    // Required by GSN
    // TODO: LIMIT USE OF THIS; ANY USER CAN DRAIN
    function acceptRelayedCall(
        address relay,
        address from,
        bytes calldata encodedFunction,
        uint256 transactionFee,
        uint256 gasPrice,
        uint256 gasLimit,
        uint256 nonce,
        bytes calldata approvalData,
        uint256 maxPossibleCharge
    ) external override view returns (uint256, bytes memory) {
        return _approveRelayedCall();
    }

    /** @dev Function to update _currentPrice
     * @param _currentPrice new price of each EcoBlock
     */
    function setCurrentPrice(uint256 _currentPrice) public onlyOwner {
        currentPrice = _currentPrice;
    }

    /** @dev Function to update _ecoBuxAddress
     * @param _ecoBuxAddress new address of the EcoBux contract
     */
    function setEcoBuxAddress(address _ecoBuxAddress) public onlyOwner {
        ecoBuxAddress = ERC20(_ecoBuxAddress);
    }

    // Relay Requires this func even if unused
    // Required by GSN
    // TODO: Add stuff here
    // solhint-disable-next-line no-empty-blocks
    function _preRelayedCall(bytes memory context) internal override returns (bytes32) {
        // TODO
    }

    // Required by GSN
    // solhint-disable-next-line no-empty-blocks
    function _postRelayedCall(
        bytes memory context,
        bool,
        uint256 actualCharge,
        bytes32
    ) internal override {
        // TODO
    }

    // Required by GSN
    function _msgSender() internal override(Context, GSNRecipient) view returns (address payable) {
        return GSNRecipient._msgSender();
    }

    // Required by GSN
    function _msgData() internal override(Context, GSNRecipient) view returns (bytes memory) {
        return GSNRecipient._msgData();
    }

    /** @dev Function to verify user has enough ecobux to spend
     * @param user address of user to verify
     */
    function availableECO(address user) internal view returns (uint256) {
        return ecoBuxAddress.allowance(user, address(this));
    }

    /** @dev Function to take ecobux from user and transfer to this contract
     * @param _from address to take ecobux from
     * @param _amount how much ecobux (in atomic units) to take
     */
    function takeEco(address _from, uint256 _amount) internal {
        require(availableECO(_from) >= _amount, "Not Enough EcoBux"); // Requre enough EcoBux available
        require(
            ecoBuxAddress.transferFrom(_from, address(this), _amount),
            "Transfer of EcoBux failed"
        );
    }

    /** @dev Function to create radnom numbers
     * @dev True random numbers are not possible in eth, these numbers are predictable
     * @dev psuedoRandomness is okay here because it only determines block id
     * @dev cost to get an unpredictable number with oracles would be illogical and take away money from charity
     * @dev don't use this function for important number generation
     * @return a predictable psuedorandom number
     */
    /* solhint-disable not-rely-on-time */
    function random() internal returns (uint256) {
        uint256 randomNum = uint256(keccak256(abi.encodePacked(now, _msgSender(), randomNonce))) %
            100;
        randomNonce++;
        return randomNum;
    }
    /* solhint-enable not-rely-on-time */

    function _createEcoBlock(uint16[2][5] memory _EcoBlock) internal {
        // Need to initialize empty array to be used in EcoBlock struct
        uint16[] memory addons;
        // Create new struct containing geopoints and an empty array of addons
        EcoBlock memory newEcoBlock = EcoBlock({geoMap: _EcoBlock, addons: addons});
        // Set the new EcoBlock's id
        ecoBlocks.push(newEcoBlock);
        uint256 newEcoBlockId = ecoBlocks.length - 1;
        // Mint the EcoBlock
        super._mint(address(this), newEcoBlockId);
        emit Transfer(address(0), address(this), newEcoBlockId);
    }
}
