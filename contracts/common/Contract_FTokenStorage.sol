// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.0;

contract FTokenStorage {
    address public bridge;

    struct TokenInfo {
        uint8 tokenType;
        address tToken;
        string tChainname;
        string tChainId;
        uint256 begin;
        uint256 end;
        address next;
    }

    uint8 public constant FREEZE = 0;
    uint8 public constant ORIGINTOKEN = 1;
    uint8 public constant WRAPPEDTOKEN = 2;

    mapping(address => TokenInfo) public tokens;
    address public firstToken;
    address public latestToken;

    modifier onlyBridge() {
        require(msg.sender == bridge,"Permission denied");
        _;
    }

    constructor(address _bridge) {
        bridge = _bridge;
    }

    function setToken(
        address _token,
        uint8 _type,
        address _ttoken,
        string calldata _tchainname,
        string calldata _tchainid,
        uint256 _begin,
        uint256 _end
    ) external onlyBridge {
        if (tokens[_token].tokenType == 0) {
            tokens[_token] = TokenInfo({
                tokenType: _type,
                tToken: _ttoken,
                tChainname: _tchainname,
                tChainId: _tchainid,
                begin: _begin,
                end: _end,
                next:address(0)
            });

            if(firstToken == address(0)){
                firstToken = _token;
            }

            if(latestToken != address(0)){
                tokens[latestToken].next = _token;
            }
            
            latestToken = _token;
        } else {
            TokenInfo storage info = tokens[_token];
            info.tokenType = _type;
            info.tToken = _ttoken;
            info.tChainname = _tchainname;
            info.tChainId = _tchainid;
            info.begin = _begin;
            info.end = _end;
        }
    }

    function tokenActivate(address _token) external view returns (bool) {
        return
            (tokens[_token].tokenType == ORIGINTOKEN ||
                tokens[_token].tokenType == WRAPPEDTOKEN) &&
            (tokens[_token].begin <= block.number &&
                (tokens[_token].end >= block.number ||
                    tokens[_token].end == 0));
    }

    function getToken(address _token) external view returns(TokenInfo memory) {
        require(tokens[_token].tToken != address(0),"Token not exist");
        return tokens[_token];
    }
}