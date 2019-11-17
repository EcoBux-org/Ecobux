pragma solidity 0.5.10;
// Import OpenZeppelin's ERC-721 Implementation
import "openzeppelin-solidity/contracts/token/ERC721/ERC721.sol";
// Import OpenZeppelin's SafeMath Implementation
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "tabookey-gasless/contracts/RelayRecipient.sol";
import "./utils/Ownable.sol";
import "./utils/Pausable.sol";
import "./utils/Erc20.sol";


contract PanamaJungle is ERC721, Ownable, Pausable, RelayRecipient {

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

    // Define name and token symbol
    string public constant name = "PanamaJungle";
    string public constant symbol = "PAJ";

    ERC721 public nftAddress = ERC721(address(this));
    uint256 public currentPrice = 25; // Default to 2 ECOB per allotment. Changed by setCurrentPrice()
    uint private randomNonce; // Nonce for RNG. Can be predictable as it only determines which allotment to buy
    ERC20 public ecoBucksAddress;

    // Start contract with new EcoBucks address
    constructor(address _ecoBucksAddress) public ERC721() {
        ERC20 ecoBucksAddress = ERC20(_ecoBucksAddress);
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
    */
    function createAllotment(uint24[2][5][2701] calldata _allotments) external onlyOwner returns (bool success) {
        uint16[] memory addons;
        for (uint i = 0; i < _allotments.length; i++) {
            Allotment memory newAllotment = Allotment({
                geoMap: _allotments[i],
                addons: addons
            });
            uint256 newAllotmentId = allotments.push(newAllotment).sub(1);
            super._mint(address(this), newAllotmentId);
            emit Birth(
                address(this),
                newAllotmentId,
                newAllotment.geoMap,
                newAllotment.addons
            );
        }
        return true;
    }

    /** @dev Function to buy one or more allotments
    * @param _tokensDesired number of tokens desired
    */
    function buyAllotments(uint256 _tokensDesired, address _to) external whenNotPaused {
        require(get_sender() != address(0) && get_sender() != address(this)); // Only be used by users to buy allotments
        require(availableECO(get_sender()) >= currentPrice * _tokensDesired, "Not enough availalbe Ecobucks!");

        // Take money from account before so no chance of re entry
        takeEco(get_sender(), currentPrice * _tokensDesired);

        uint256[] memory contractTokens = this.ownedAllotments(address(this)); // Array of contract tokens for random selection

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
    * @param _price uint of the cost (in ecoBucks) of the new microaddon
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
        require(availableECO(get_sender()) > microAddons[addonID].price, "Not enough available Ecobucks!");
        require(_exists(tokenID), "Selected Token does not exist");

        // Take money from account
        takeEco(get_sender(), microAddons[addonID].price);

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
    function accept_relayed_call(
        address,    // Relay
        address,    // From
        bytes memory,      //encoded_function
        uint,       // gas_price
        uint        // transaction_fee
    ) public view returns(uint32) {
        // TODO: Only accept verified users
        return 0; // accept everything.
    }

    // Relay Requires this func even if unused
    function post_relayed_call(
        address, //relay
        address, //from
        bytes memory, //encoded_function
        bool, //success
        uint, //used_gas
        uint // transaction_fee
    ) public {
      // TODO: Add stuff here
    }

    function init_hub(RelayHub hubAddr) public onlyOwner {
        init_relay_hub(hubAddr);
    }

    /** @dev Function to update _currentPrice
    * @dev Throws if _currentPrice is zero
    */
    function setCurrentPrice(uint256 _currentPrice) public onlyOwner {
        require(_currentPrice > 0); // This shouldn't ever throw, but sanitization of inputs is never a bad thing
        currentPrice = _currentPrice;
    }

    /** @dev Function to update _ecoBucksAddress
      * @dev Throws if _ecoBucksAddress is not a contract address
      */
    function setEcoBucksAddress(address _ecoBucksAddress) public onlyOwner {
        ecoBucksAddress = ERC20(_ecoBucksAddress);
    }

    /** @dev Function to verify user has enough ecobucks to spend
    */
    function availableECO(address user) internal view returns (uint256) {
        return ecoBucksAddress.allowance(user, address(this));
    }

    /** @dev Function to take ecobucks from user and transfer to contract
     */
    function takeEco(address _from, uint256 _amount) internal {
        require(availableECO(_from) > _amount); // Requre enough ecoBucks available
        require(ecoBucksAddress.transferFrom(_from, address(this), _amount), "Transfer of EcoBucks failed");
        //emit EcoTransfer(_from, _amount);
    }

    /** @dev Function to create radnom numbers
      * @return psuedoRandom nnumbers
      */
    function random() internal returns(uint) {
        uint randomNum = uint(keccak256(abi.encodePacked(now, get_sender(), randomNonce))) % 100;
        randomNonce++;
        return randomNum;
    }
}
