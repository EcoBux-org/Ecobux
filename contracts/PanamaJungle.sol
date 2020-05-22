pragma solidity ^0.6.0;
// Import OpenZeppelin's ERC-721 Implementation
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
// Import OpenZeppelin's SafeMath Implementation
import "@openzeppelin/contracts/math/SafeMath.sol";
// Now using new openzeppelin's gsn
import "@openzeppelin/contracts/GSN/GSNRecipient.sol";
// Permission abstract contracts to control contract
import "./utils/Ownable.sol";
import "./utils/Pausable.sol";
// Interface contract to interact with EcoBux
import "./utils/Erc20.sol";


contract PanamaJungle is ERC721, Ownable, Pausable, GSNRecipient {
    using SafeMath for uint256;

    // This struct will be used to represent one allotment of land
    struct Allotment {
        // Array of lat/lng points to represent the boundaries of a point.
        uint16[2][5] geoMap;
        // Array of microaddons for each allotment
        uint16[] addons;
    }

    // List of existing allotments
    Allotment[] internal allotments;

    // Struct defines the microaddons for an allotment.
    struct MicroAddon {
        uint16 price;
        bool buyable;
    }

    // List of existing microAddons
    MicroAddon[] public microAddons;

    // Event that will be emitted whenever a new allotment is created or ownership is transferred
    event Birth(
        address owner,
        uint256 allotmentId,
        uint16[2][5] geoMap,
        uint16[] addons
    );

    // Event emitted when a new mircoAddon is created
    event NewAddon(uint256 addonId, uint16 price, bool buyable);

    // Event emitted when a microAddon is added to an allotment
    event AddedAddon(
            uint256 tokenId,
            uint16 addonId
    );

    // Define non fungible token address
    ERC721 public nftAddress = ERC721(address(this));
    // Default to 25 ECOB per allotment. Changed by setCurrentPrice()
    uint256 public currentPrice = 25;
    // Nonce for RNG. Can be predictable, however it only determines which allotment to buy
    uint256 private randomNonce;
    // Declare ecobux address
    ERC20 public ecoBuxAddress;

    // Start contract with new EcoBux address as parameter
    constructor(address _ecoBuxAddress) public ERC721("PanamaJungle", "PAJ") {
        ecoBuxAddress = ERC20(_ecoBuxAddress);
    }

   /** @dev Function to group create allotments
     * @param _allotments an array of arrays of points for creating each allotment bounds
     * Each lat lng point converts to having six decimal points, about 4 inches of precision.
     * They are stored compressed in uint16 to save space
     * And solidity does not handle fixed points well
     * (precision is not accuracy, note https://gis.stackexchange.com/a/8674 )
     * @return success bool if the allotment generation was successful
     **/
    function bulkCreateAllotment(uint16[2][5][] calldata _allotments)
        external
        onlyOwner
        returns (bool success)
    {
        // For each allotment in initial array
        for (uint256 i = 0; i < _allotments.length; i++) {
            _createAllotment(_allotments[i]);
        }
        return true;
    }

  /** @dev Function to buy allotments
    * @param _tokensDesired number of allotments to buy from contract
    * @param _to address to send bought allotments
    */
    function buyAllotments(uint256 _tokensDesired, address _to)
        external
        whenNotPaused
    {
        require(
            availableECO(_msgSender()) >= currentPrice * _tokensDesired,
            "Not enough available Ecobux!"
        );

        // Take money from account before so no chance of re entry attacks
        takeEco(_msgSender(), currentPrice * _tokensDesired);

        uint256[] memory contractTokens = this.ownedAllotments(address(this));

        require(
            contractTokens.length >= _tokensDesired,
            "Not enough available tokens!"
        );

        for (uint256 i = 0; i < _tokensDesired; i++) {
            // Select random token from contract tokens
            uint256 tokenId = contractTokens[random() % contractTokens.length];
            nftAddress.safeTransferFrom(address(this), _to, tokenId); // Transfer token from contract to user
            // Refresh the list of available allotments
            // cant use pop() because its a memory array, we just have to start from scratch
            // gas cost is negligible however
            contractTokens = this.ownedAllotments(address(this));
        }
    }

    /** @dev Function to create a new type of microaddon
     * @param _price uint of the cost (in ecobux) of the new microaddon
     * @param _buyable bool determining if the new microaddon can be bought by users
     * @return The new addon's ID
     */
    function createMicro(uint16 _price, bool _buyable)
        external
        onlyOwner
        returns (uint256)
    {
        MicroAddon memory newAddon = MicroAddon({
            price: _price,
            buyable: _buyable
        });
        microAddons.push(newAddon);
        uint256 newAddonId = microAddons.length - 1;
        emit NewAddon(newAddonId, _price, _buyable);
        return newAddonId;
    }

    /** @dev Function to add vitrual microtransactions to an allotment
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

        // Take money from account
        takeEco(_msgSender(), microAddons[addonId].price);

        allotments[tokenId].addons.push(addonId); // Add addonId to token array

        emit AddedAddon(tokenId, addonId);

        return allotments[tokenId].addons;
    }

    /** @dev Function to get a list of owned allotment's IDs
      * @param addr address to check owned allotments
     * @return A uint array which contains IDs of all owned allotments
     */
    function ownedAllotments(address addr)
        external
        view
        returns (uint256[] memory)
    {
        uint256 allotmentCount = balanceOf(addr);
        if (allotmentCount == 0) {
            return new uint256[](0);
        } else {
            uint256[] memory result = new uint256[](allotmentCount);
            uint256 totalAllotments = allotments.length;
            uint256 resultIndex = 0;
            uint256 allotmentId = 0;
            while (allotmentId < totalAllotments) {
                if (ownerOf(allotmentId) == addr) {
                    result[resultIndex] = allotmentId;
                    resultIndex = resultIndex.add(1);
                }
                allotmentId = allotmentId.add(1);
            }
            return result;
        }
    }

    /** @dev Function to retrieve a specific allotment's details.
     * @param id ID of the allotment who's details will be retrieved
     * @return Array id and geopoints of an allotment with all addons.
     */
    function allotmentDetails(uint256 id)
        external
        view
        returns (
            uint256,
            uint16[2][5] memory,
            uint16[] memory
        )
    {
        return (id, allotments[id].geoMap, allotments[id].addons);
    }

    /** @dev Function to retrieve a specific allotment's details.
     * @param id ID of the allotment who's details will be retrieved
     * @return Array id and geopoints of an allotment with all addons.
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
    // GSN func
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
    ) external view override returns (uint256, bytes memory) {
        return _approveRelayedCall();
    }

    /** @dev Function to update _currentPrice
      * @param _currentPrice new price of each allotment
     */
    function setCurrentPrice(uint256 _currentPrice) public onlyOwner {
        currentPrice = _currentPrice;
    }

    /** @dev Function to update _ecoBuxAddress
     * @dev Throws if _ecoBuxAddress is not a contract address
     * @param _ecoBuxAddress new address of the EcoBux contract
     */
    function setEcoBuxAddress(address _ecoBuxAddress) public onlyOwner {
        ecoBuxAddress = ERC20(_ecoBuxAddress);
    }

    // Relay Requires this func even if unused
    // GSN Func
    // TODO: Add stuff here
    function _preRelayedCall(bytes memory context) internal override returns (bytes32) {
        // TODO
    }

    function _postRelayedCall(
        bytes memory context,
        bool,
        uint256 actualCharge,
        bytes32
    ) internal override {
        // TODO
    }

    // Needed by Openzeppelin GSN
    function _msgSender() internal view override(Context, GSNRecipient) returns (address payable) {
        return GSNRecipient._msgSender();
    }

    function _msgData() internal view override(Context, GSNRecipient) returns (bytes memory) {
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
     * @dev True random numbers are not possible in eth, these numbers are feasibly predictable
     * @dev Because the cost of predicting these numbers greatly outweighs the reward,
     * @dev psuedoRandomness is okay here
     * @dev Internal function only
     * @return psuedoRandom nnumbers
     */
    function random() internal returns (uint256) {
        uint256 randomNum = uint256(
            keccak256(abi.encodePacked(now, _msgSender(), randomNonce))
        ) % 100;
        randomNonce++;
        return randomNum;
    }

    function _createAllotment(uint16[2][5] memory _allotment) internal {
        uint16[] memory addons;
        // Create new struct containing geopoints and an empty array of addons
        Allotment memory newAllotment = Allotment({
            geoMap: _allotment,
            addons: addons
        });
        // Set the new allotment's id
        allotments.push(newAllotment);
        uint256 newAllotmentId = allotments.length - 1;
        // Mint the allotment
        super._mint(address(this), newAllotmentId);
        emit Transfer(address(0), address(this), newAllotmentId);
    }
}
