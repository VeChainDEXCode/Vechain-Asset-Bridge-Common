// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.0;

interface IFTBridgeControl {
    function master() external view returns (address);

    function governance() external view returns (address);

    function govLocked() external view returns (bool);

    function masterLocked() external view returns (bool);
}

struct TokenInfo {
    uint8 tokenType;
    address tToken;
    string tChainname;
    string tChainId;
    uint256 begin;
    uint256 end;
    uint16 reward;
}

contract FTBridgeTokens {
    address public bridgeControl;
    address public wrappedNativeToken;
    uint8 public constant ORIGINTOKEN = 1;
    uint8 public constant WRAPPEDTOKEN = 2;

    mapping(address => TokenInfo) public tokens;

    event TokenUpdated(address indexed _token);

    constructor(address _control) {
        bridgeControl = _control;
    }

    function setToken(
        address _token,
        uint8 _type,
        address _ttoken,
        string calldata _tchainname,
        string calldata _tchainid,
        uint256 _begin,
        uint256 _end,
        uint16 _reward
    ) external {
        require(
            IFTBridgeControl(bridgeControl).governance() == msg.sender,
            "Permission denied"
        );
        tokens[_token] = TokenInfo({
            tokenType: _type,
            tToken: _ttoken,
            tChainname: _tchainname,
            tChainId: _tchainid,
            begin: _begin,
            end: _end,
            reward: _reward
        });
        emit TokenUpdated(_token);
    }

    function setWrappedNativeCoin(
        address _token,
        address _ttoken,
        string calldata _tchainname,
        string calldata _tchainid,
        uint256 _begin,
        uint256 _end,
        uint16 _reward
    ) external {
        require(
            IFTBridgeControl(bridgeControl).governance() == msg.sender,
            "Permission denied"
        );
        wrappedNativeToken = _token;
        tokens[_token] = TokenInfo({
            tokenType: ORIGINTOKEN,
            tToken: _ttoken,
            tChainname: _tchainname,
            tChainId: _tchainid,
            begin: _begin,
            end: _end,
            reward: _reward
        });
        emit TokenUpdated(_token);
    }

    function tokenActivate(address _token) public view returns (bool) {
        return
            tokens[_token].tokenType != 0 &&
            (tokens[_token].begin <= block.number &&
                (tokens[_token].end >= block.number ||
                    tokens[_token].end == 0));
    }

    function amountReward(address _token, uint256 _amountIn)
        public
        view
        returns (uint256, uint256)
    {
        require(tokens[_token].tokenType != 0, "Token not exists");
        require(
            _amountIn >= 1000 || tokens[_token].reward == 0,
            "The amount is too little"
        );
        uint256 _amountOut = (_amountIn * 1000) -
            (_amountIn * tokens[_token].reward);
        _amountOut = _amountOut / 1000;
        uint256 _reward = _amountIn - _amountOut;
        return (_amountOut, _reward);
    }

    function getToken(address _token) external view returns(TokenInfo memory) {
        return tokens[_token];
    }
}
