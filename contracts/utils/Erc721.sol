pragma solidity >=0.6.0;


/**
 * @title Interface for contracts conforming to ERC-721
 */
// solhint-disable-next-line
abstract contract ERC721 {
    function ownerOf(uint256 _tokenId) public view virtual returns (address _owner);
    function approve(address _to, uint256 _tokenId) public virtual ;
    function getApproved(uint256 _tokenId) public view virtual returns (address);
    function isApprovedForAll(address _owner, address _operator) public view virtual returns (bool);
    function safeTransferFrom(address _from, address _to, uint256 _tokenId) public virtual ;
    function supportsInterface(bytes4) public view virtual returns (bool);
}
