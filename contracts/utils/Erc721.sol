pragma solidity >=0.6.0;


/**
 * @title Interface for contracts conforming to ERC-721
 */
contract ERC721 {
    function ownerOf(uint256 _tokenId) public view returns (address _owner);
    function approve(address _to, uint256 _tokenId) public;
    function getApproved(uint256 _tokenId) public view returns (address);
    function isApprovedForAll(address _owner, address _operator) public view returns (bool);
    function safeTransferFrom(address _from, address _to, uint256 _tokenId) public;
    function supportsInterface(bytes4) public view returns (bool);
}
