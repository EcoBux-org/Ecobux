pragma solidity 0.5.10;
// Import OpenZeppelin's ERC-721 Implementation
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
// Import OpenZeppelin's SafeMath Implementation
import "@openzeppelin/contracts/math/SafeMath.sol";
// Now using new openzeppelin's gsn
import "@openzeppelin/contracts/GSN/GSNRecipient.sol";
import "./utils/Ownable.sol";
import "./utils/Pausable.sol";
import "./utils/Erc20.sol";


contract PanamaJungle is ERC721, Ownable, Pausable, GSNRecipient {

    using SafeMath for uint256;

    // This struct will be used to represent one allotment of land
    struct Allotment {
        // Array of lat/lng points to represent the boundaries of a point.
        uint24[2][5] geoMap;
        // Array of microaddons for each allotment
        uint16[] addons;
    }

    // List of existing allotments
    Allotment[] internal allotments;

    // Struct defines the microaddons for an allotment.
    struct MicroAddon {
        uint16 price;
        bool purchasable;
    }

    // List of existing microAddons
    MicroAddon[] public microAddons;

    // Event that will be emitted whenever a new allotment is created or ownership is transferred
    event Birth(
        address owner,
        uint256 allotmentId,
        uint24[2][5] geoMap,
        uint16[] addons
    );

    // Event that will be emitted whenever ownership is transferred of a token
    event Transferred(
        address owner,
        uint256 allotmentId
    );

    // Event emitted when ECOB are transferred from user to contract
    /*event EcoTransfer(
        address owner,
        uint256 amount
    );*/

    // Event emitted when a new mircoAddon is created
    event NewAddon(
        uint256 addonId,
        uint256 price,
        bool purchasable
    );

    // TEST EVENT: TODO: DELETE
    event log(
        string msg,
        uint logID
    );

    // Define name and token symbol
    string public constant name = "PanamaJungle";
    string public constant symbol = "PAJ";

    // Defince non fungible token address
    ERC721 public nftAddress = ERC721(address(this));
    // Default to 25 ECOB per allotment. Changed by setCurrentPrice()
    uint256 public currentPrice = 25; 
    // Nonce for RNG. Can be predictable, however it only determines which allotment to buy
    uint private randomNonce; 
    // Declare ecobux address
    ERC20 public ecoBuxAddress;

    // Start contract with new EcoBux address as parameter
    constructor(address _ecoBuxAddress) public ERC721() {
        ecoBuxAddress = ERC20(_ecoBuxAddress);
    }

    // Fallback function
    // solhint-disable-next-line no-empty-blocks
    function() external {
    }

    /** @dev Function to group create allotments
    * @param _allotments an array of arrays of points for creating the allotment bounds
        * Each lat lng point has six decimal points, about 4 inches of precision.
        * (precision is not accuracy, note https://gis.stackexchange.com/a/8674 )
    * @return bool success if the allotment generation was successful 
    **/ 
    function createAllotment(uint24[2][5][10] calldata _allotments) external onlyOwner returns (bool success) {
        uint16[] memory addons;
        // For each allotment in initial array
        for (uint i = 0; i < _allotments.length; i++) {
            // Create new struct containing geopoints and an empty array of addons
            Allotment memory newAllotment = Allotment({
                geoMap: _allotments[i],
                addons: addons
            });
            // Set the new allotment's id
            uint256 newAllotmentId = allotments.push(newAllotment).sub(1);
            // Mint the allotment
            super._mint(address(this), newAllotmentId);
            // Declare the allotment "birthed"
            emit Transfer(
                address(0),
                address(this),
                newAllotmentId
            );
        }
        return true;
    }

    /** @dev Function to buy one or more allotments
    * @param _tokensDesired number of tokens desired
    */
    function buyAllotments(uint256 _tokensDesired, address _to) external whenNotPaused {
        require(_msgSender() != address(0) && _msgSender() != address(this)); // Only be used by users to buy allotments
        require(availableECO(_msgSender()) >= currentPrice * _tokensDesired, "Not enough available Ecobux!");

        // Take money from account before so no chance of re entry attacks
        takeEco(_msgSender(), currentPrice * _tokensDesired);
        
        // Array of contract tokens for random selection 
        uint256[] memory contractTokens = this.ownedAllotments(address(this));

        require(contractTokens.length > _tokensDesired, "Not enough available tokens!"); // Need enough tokens available

        for (uint i = 0; i < _tokensDesired; i++) {
            uint tokenId = contractTokens[random()%contractTokens.length]; // Select random token from contract tokens

            nftAddress.safeTransferFrom(address(this), _to, tokenId); // Transfer token from contract to user

            emit Transferred(
                _to,
                tokenId
            );
        }

    }

    /** @dev Function to create a new type of microaddon
    * @param _price uint of the cost (in ecobux) of the new microaddon
    * @param _purchasable bool determining if the new microaddon can be purchased by users
    * @return The new addon's ID
    */
    function createMicro(uint16 _price, bool _purchasable) external onlyOwner returns (uint256) {
        MicroAddon memory newAddon = MicroAddon({
            price: _price,
            purchasable: _purchasable
        });
        uint256 newAddonId = microAddons.push(newAddon).sub(1);
        emit NewAddon(
            newAddonId,
            _price,
            _purchasable
        );
        return newAddonId;
    }

    /** @dev Function to add vitrual microtransactions to an allotment
    * @param tokenID id of the token to add the microtransactions to
    * @param addonID Desired name of the addon mapped to an id
    * @return All microtransactions on tokenID
    */
    function purchaseMicro(uint256 tokenID, uint16 addonID) external whenNotPaused returns (uint16[] memory) {
        require(microAddons[addonID].purchasable, "Selected microaddon does not exist or is not purchasable.");
        require(availableECO(_msgSender()) > microAddons[addonID].price, "Not enough available EcoBux!");
        require(_exists(tokenID), "Selected Token does not exist");

        // Take money from account
        takeEco(_msgSender(), microAddons[addonID].price);

        allotments[tokenID].addons.push(addonID); // Add addonID to token array

        return allotments[tokenID].addons;
    }

    /** @dev Function to withdraw all ETH from contract to balance
    */
    function withdrawAll() external payable onlyOwner {
        uint bal = address(this).balance;
        address(owner).transfer(bal);
    }

    /** @dev Function to get a list of owned allotment's IDs
    * @return A uint array which contains IDs of all owned allotments
    */
    function ownedAllotments(address addy) external view returns(uint256[] memory) {
        uint256 allotmentCount = balanceOf(addy);
        if (allotmentCount == 0) {
            return new uint256[](0);
        } else {
            uint256[] memory result = new uint256[](allotmentCount);
            uint256 totalAllotments = allotments.length;
            uint256 resultIndex = 0;
            uint256 allotmentId = 0;
            while (allotmentId < totalAllotments) {
                if (ownerOf(allotmentId) == addy) {
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
    function allotmentDetails(uint256 id) external view returns (uint256, uint24[2][5] memory, uint16[] memory) {
        return (id, allotments[id].geoMap, allotments[id].addons);
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
    ) external view returns (uint256, bytes memory) {
        return _approveRelayedCall();
    }
  
    // Relay Requires this func even if unused
    // GSN Func
    // TODO: Add stuff here
    function _preRelayedCall(bytes memory context) internal returns (bytes32) {
    }

    function _postRelayedCall(bytes memory context, bool, uint256 actualCharge, bytes32) internal {
    }

    /** @dev Function to update _currentPrice
    * @dev Throws if _currentPrice is zero
    */
    function setCurrentPrice(uint256 _currentPrice) public onlyOwner {
        require(_currentPrice > 0); // This shouldn't ever throw, but sanitization of inputs is never a bad thing
        currentPrice = _currentPrice;
    }

    /** @dev Function to update _ecoBuxAddress
      * @dev Throws if _ecoBuxAddress is not a contract address
      */
    function setEcoBuxAddress(address _ecoBuxAddress) public onlyOwner {
        ecoBuxAddress = ERC20(_ecoBuxAddress);
    }

    /** @dev Function to verify user has enough ecobux to spend
      * @dev Internal function only
    */
    function availableECO(address user) internal view returns (uint256) {
        return ecoBuxAddress.allowance(user, address(this));
    }

    /** @dev Function to take ecobux from user and transfer to contract
      * @dev Internal function only
     */
    function takeEco(address _from, uint256 _amount) internal {
        require(availableECO(_from) > _amount); // Requre enough EcoBux available
        require(ecoBuxAddress.transferFrom(_from, address(this), _amount), "Transfer of EcoBux failed");
        //emit EcoTransfer(_from, _amount);
    }

    /** @dev Function to create radnom numbers
      * @dev True random numbers are not possible in eth, these numbers are feasibly predictable
      * @dev Because the cost of predicting these numbers greatly outweighs the reward,
      * @dev psuedoRandomness is okay here
      * @dev Internal function only
      * @return psuedoRandom nnumbers
      */
    function random() internal returns(uint) {
        uint randomNum = uint(keccak256(abi.encodePacked(now, _msgSender(), randomNonce))) % 100;
        randomNonce++;
        return randomNum;
    }
}
