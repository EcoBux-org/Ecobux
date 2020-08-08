// SPDX-License-Identifier: AGPL-3.0
pragma solidity >=0.6.0;

/**
 * @title Interface for contracts conforming to ERC-721
 */
// solhint-disable-next-line
abstract contract ERC721 {
    function approve(address _to, uint256 _tokenId) public virtual;

    function safeTransferFrom(
        address _from,
        address _to,
        uint256 _tokenId
    ) public virtual;

    function ownerOf(uint256 _tokenId) public virtual view returns (address _owner);

    function getApproved(uint256 _tokenId) public virtual view returns (address);

    function isApprovedForAll(address _owner, address _operator) public virtual view returns (bool);

    function supportsInterface(bytes4) public virtual view returns (bool);
}
